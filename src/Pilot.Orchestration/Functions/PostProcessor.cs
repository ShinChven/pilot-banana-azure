using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using Pilot.Core.Adapters;
using Pilot.Core.Domain;
using Pilot.Core.Repositories;

namespace Pilot.Orchestration.Functions;

public class PostProcessor
{
    private readonly ILogger _logger;
    private readonly IPostRepository _postRepository;
    private readonly ICampaignRepository _campaignRepository;
    private readonly IChannelLinkRepository _channelLinkRepository;
    private readonly IPostHistoryRepository _historyRepository;
    private readonly IEnumerable<IPlatformAdapter> _adapters;
    private readonly IAssetBlobStore _blobStore;

    public PostProcessor(
        ILoggerFactory loggerFactory,
        IPostRepository postRepository,
        ICampaignRepository campaignRepository,
        IChannelLinkRepository channelLinkRepository,
        IPostHistoryRepository historyRepository,
        IEnumerable<IPlatformAdapter> adapters,
        IAssetBlobStore blobStore)
    {
        _logger = loggerFactory.CreateLogger<PostProcessor>();
        _postRepository = postRepository;
        _campaignRepository = campaignRepository;
        _channelLinkRepository = channelLinkRepository;
        _historyRepository = historyRepository;
        _adapters = adapters;
        _blobStore = blobStore;
    }

    [Function("PostProcessor")]
    public async Task Run(
        [QueueTrigger("scheduled-posts", Connection = "AzureWebJobsStorage")] string messageText, 
        CancellationToken cancellationToken)
    {
        var payload = JsonSerializer.Deserialize<PostDispatchMessage>(messageText, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        if (payload == null) return;

        _logger.LogInformation("Processing post {PostId}...", payload.PostId);

        // 1. Fetch Post and verify state
        var post = await _postRepository.GetByIdAsync(payload.CampaignId, payload.PostId, cancellationToken);
        if (post == null || post.Status != PostStatus.Scheduled)
        {
            _logger.LogWarning("Post {PostId} not found or not in Scheduled state. Skipping.", payload.PostId);
            return;
        }

        // 2. Fetch Campaign and verify it's still active
        var campaign = await _campaignRepository.GetByIdAsync(payload.UserId, payload.CampaignId, cancellationToken);
        if (campaign == null || campaign.Status != CampaignStatus.Active)
        {
            _logger.LogInformation("Campaign {CampaignId} is inactive. Marking post as Failed.", payload.CampaignId);
            await UpdateStatus(post, PostStatus.Failed, cancellationToken);
            return;
        }

        // 3. Resolve Channel Links
        var allUserLinks = await _channelLinkRepository.ListByUserIdAsync(payload.UserId, cancellationToken);
        var activeLinks = allUserLinks.Where(l => campaign.ChannelLinkIds.Contains(l.Id)).ToList();

        if (activeLinks.Count == 0)
        {
            _logger.LogError("No active channel links found for campaign {CampaignId}", payload.CampaignId);
            await UpdateStatus(post, PostStatus.Failed, cancellationToken);
            return;
        }

        // 4. Resolve Media URLs (convert internal blob paths to signed/absolute URLs if needed)
        var mediaUrls = await ResolveMediaUrls(post.MediaUrls, cancellationToken);

        // 5. Publish to all platforms
        bool anySuccess = false;
        foreach (var link in activeLinks)
        {
            var adapter = _adapters.FirstOrDefault(a => a.PlatformId == link.Platform);
            if (adapter == null)
            {
                _logger.LogWarning("No adapter found for platform {Platform}", link.Platform);
                continue;
            }

            var result = await adapter.PublishAsync(
                new PostRequest { Text = post.Text, MediaUrls = mediaUrls },
                link.Id,
                link.TokenSecretName,
                cancellationToken);

            // Record History
            var historyItem = new PostHistoryItem
            {
                Id = Guid.NewGuid().ToString(),
                CampaignId = post.CampaignId,
                UserId = post.UserId,
                PostId = post.Id,
                ChannelLinkId = link.Id,
                Platform = link.Platform,
                ExternalPostId = result.ExternalPostId,
                PostUrl = result.PostUrl,
                PostedAt = DateTimeOffset.UtcNow,
                Status = result.Success ? "Completed" : "Failed",
                ErrorMessage = result.ErrorMessage
            };

            try
            {
                await _historyRepository.CreateAsync(historyItem, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to save post history for post {PostId} on platform {Platform}", post.Id, link.Platform);
            }

            if (result.Success) anySuccess = true;
            else _logger.LogError("Failed to post to {Platform}: {Error}", link.Platform, result.ErrorMessage);
        }

        // 6. Final Status Update
        await UpdateStatus(post, anySuccess ? PostStatus.Posted : PostStatus.Failed, cancellationToken);
    }

    private async Task UpdateStatus(Post post, PostStatus status, CancellationToken ct)
    {
        post.Status = status;
        post.UpdatedAt = DateTimeOffset.UtcNow;
        await _postRepository.UpdateAsync(post, ct);
    }

    private async Task<List<string>> ResolveMediaUrls(List<string>? paths, CancellationToken ct)
    {
        var resolved = new List<string>();
        if (paths == null) return resolved;

        var containerSas = await _blobStore.GetContainerSasAsync(TimeSpan.FromHours(24), ct);

        foreach (var path in paths)
        {
            var uri = await _blobStore.GetBlobUriAsync(path, TimeSpan.FromHours(24), ct);
            var uriString = uri.ToString();

            // Check if GetBlobUriAsync already appended a token
            if (uriString.Contains("?"))
            {
                resolved.Add(uriString);
                continue;
            }

            // If not signed, and we have a container SAS, append it manually
            if (!string.IsNullOrEmpty(containerSas))
            {
                var connector = uriString.Contains("?") ? "&" : "?";
                uriString = $"{uriString}{connector}{containerSas}";
            }
            
            _logger.LogInformation("Resolved media URL for processing: {Url}", uriString);
            resolved.Add(uriString);
        }
        return resolved;
    }
}
