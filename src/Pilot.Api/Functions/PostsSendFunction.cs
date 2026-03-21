using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Pilot.Api.Services;
using Pilot.Core.Repositories;
using Pilot.Core.Adapters;
using Pilot.Core.Domain;
using System;
using System.Linq;
using System.Threading;
using System.Collections.Generic;
using Pilot.Core.DTOs;
using System.Threading.Tasks;

namespace Pilot.Api.Functions;

public class PostsSendFunction
{
    private readonly ILogger _logger;
    private readonly IPostRepository _postRepository;
    private readonly IPostHistoryRepository _postHistoryRepository;
    private readonly ICampaignRepository _campaignRepository;
    private readonly IChannelLinkRepository _channelLinkRepository;
    private readonly IEnumerable<IPlatformAdapter> _adapters;
    private readonly RequestAuthHelper _authHelper;
    private readonly IAssetBlobStore _blobStore;

    public PostsSendFunction(
        ILoggerFactory loggerFactory,
        IPostRepository postRepository,
        IPostHistoryRepository postHistoryRepository,
        ICampaignRepository campaignRepository,
        IChannelLinkRepository channelLinkRepository,
        IEnumerable<IPlatformAdapter> adapters,
        RequestAuthHelper authHelper,
        IAssetBlobStore blobStore)
    {
        _logger = loggerFactory.CreateLogger<PostsSendFunction>();
        _postRepository = postRepository;
        _postHistoryRepository = postHistoryRepository;
        _campaignRepository = campaignRepository;
        _channelLinkRepository = channelLinkRepository;
        _adapters = adapters;
        _authHelper = authHelper;
        _blobStore = blobStore;
    }

    [Function("SendPost")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "users/{userId}/campaigns/{campaignId}/posts/{id}/send")] Microsoft.AspNetCore.Http.HttpRequest req,
        string userId, string campaignId, string id, CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null || auth.Value.UserId != userId)
            return new UnauthorizedResult();

        var post = await _postRepository.GetByIdAsync(campaignId, id, cancellationToken);
        if (post == null)
            return new NotFoundResult();

        var campaign = await _campaignRepository.GetByIdAsync(userId, campaignId, cancellationToken);
        if (campaign == null)
        {
            return new NotFoundObjectResult(new { error = "Campaign not found" });
        }

        if (campaign.ChannelLinkIds == null || campaign.ChannelLinkIds.Count == 0)
        {
            _logger.LogWarning("No channels attached to campaign {CampaignId}", campaignId);
            return new BadRequestObjectResult(new { error = "No channels attached to campaign." });
        }

        var allLinks = await _channelLinkRepository.ListByUserIdAsync(userId, cancellationToken);
        var channelLinks = allLinks.Where(l => campaign.ChannelLinkIds.Contains(l.Id)).ToList();

        if (channelLinks.Count == 0)
        {
            _logger.LogWarning("No valid channels found for campaign {CampaignId} among user's {UserId} channels.", campaignId, userId);
            return new BadRequestObjectResult(new { error = "No valid channels found for this campaign. Please check your campaign settings and channel connections." });
        }

        var containerSas = await _blobStore.GetContainerSasAsync(TimeSpan.FromHours(24), cancellationToken);

        var absoluteMediaUrls = new List<string>();
        if (post.MediaUrls != null)
        {
            foreach (var path in post.MediaUrls)
            {
                var uri = await _blobStore.GetBlobUriAsync(path, TimeSpan.FromHours(24), cancellationToken);

                if (!string.IsNullOrEmpty(containerSas) && string.IsNullOrEmpty(uri.Query))
                {
                    var uriBuilder = new UriBuilder(uri) { Query = containerSas };
                    uri = uriBuilder.Uri;
                }
                absoluteMediaUrls.Add(uri.ToString());
            }
        }

        bool anySuccess = false;
        var errorMessages = new List<string>();

        foreach (var link in channelLinks)
        {
            var adapter = _adapters.FirstOrDefault(a => a.PlatformId == link.Platform);
            if (adapter == null)
            {
                _logger.LogWarning("No adapter found for platform {Platform}", link.Platform);
                errorMessages.Add($"No adapter found for platform {link.Platform}");
                continue;
            }

            var request = new PostRequest { Text = post.Text, MediaUrls = absoluteMediaUrls };
            var result = await adapter.PublishAsync(
                request,
                link.Id,
                link.TokenSecretName,
                cancellationToken
            );

            // Log history
            var historyItem = new PostHistoryItem
            {
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
            await _postHistoryRepository.CreateAsync(historyItem, cancellationToken);

            if (result.Success)
            {
                anySuccess = true;
                _logger.LogInformation("Successfully manually posted to {Platform} for account link {LinkId}", link.Platform, link.Id);
            }
            else
            {
                errorMessages.Add($"Failed for {link.Platform}: {result.ErrorMessage}");
                _logger.LogError("Failed to manually post to {Platform} for account link {LinkId}: {Error}", link.Platform, link.Id, result.ErrorMessage);
            }
        }

        post.Status = anySuccess ? PostStatus.Posted : PostStatus.Failed;
        post.UpdatedAt = DateTimeOffset.UtcNow;
        await _postRepository.UpdateAsync(post, cancellationToken);

        if (!anySuccess)
        {
            var combinedError = errorMessages.Any() ? string.Join("; ", errorMessages) : "Failed to post to any channels.";
            return new BadRequestObjectResult(new { error = combinedError });
        }

        var responseData = new PostResponse(
            post.Id,
            post.CampaignId,
            post.UserId,
            post.Text,
            absoluteMediaUrls,
            post.ScheduledTime,
            post.Status,
            post.PlatformData,
            post.CreatedAt,
            post.UpdatedAt
        );

        return new OkObjectResult(responseData);
    }
}
