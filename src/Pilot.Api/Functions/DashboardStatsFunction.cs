using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Pilot.Core.Repositories;
using Pilot.Api.Services;
using Pilot.Core.DTOs;
using System.Net;

namespace Pilot.Api.Functions;

public class DashboardStatsFunction
{
    private readonly ILogger<DashboardStatsFunction> _logger;
    private readonly RequestAuthHelper _authHelper;
    private readonly ICampaignRepository _campaignRepo;
    private readonly IPostRepository _postRepo;
    private readonly IChannelLinkRepository _channelRepo;
    private readonly IPostHistoryRepository _historyRepo;

    public DashboardStatsFunction(
        ILogger<DashboardStatsFunction> logger,
        RequestAuthHelper authHelper,
        ICampaignRepository campaignRepo,
        IPostRepository postRepo,
        IChannelLinkRepository channelRepo,
        IPostHistoryRepository historyRepo)
    {
        _logger = logger;
        _authHelper = authHelper;
        _campaignRepo = campaignRepo;
        _postRepo = postRepo;
        _channelRepo = channelRepo;
        _historyRepo = historyRepo;
    }

    [Function("DashboardStats")]
    public async Task<HttpResponseData> RunAsync(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "stats")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null || string.IsNullOrEmpty(auth.Value.UserId))
            return req.CreateResponse(HttpStatusCode.Unauthorized);

        var userId = auth.Value.UserId;
        _logger.LogInformation("Fetching dashboard stats for user {UserId}", userId);

        // 1. Get campaigns
        var campaigns = await _campaignRepo.ListByUserIdAsync(userId, cancellationToken);
        var activeCampaigns = campaigns.Count(c => c.Status == Core.Domain.CampaignStatus.Active);
        _logger.LogInformation("Found {Count} campaigns ({ActiveCount} active) for user {UserId}", campaigns.Count, activeCampaigns, userId);

        // 2. Scheduled Posts - count posts in active campaigns that are scheduled or draft
        long scheduledPosts = 0;
        foreach (var campaign in campaigns.Where(c => c.Status == Core.Domain.CampaignStatus.Active))
        {
            var posts = await _postRepo.GetByCampaignIdAsync(campaign.Id, cancellationToken);
            scheduledPosts += posts.Count(p => p.Status == Core.Domain.PostStatus.Scheduled || p.Status == Core.Domain.PostStatus.Draft);
        }
        _logger.LogInformation("Found {Count} scheduled/draft posts for user {UserId}", scheduledPosts, userId);

        // 3. Connected Channels
        var channels = await _channelRepo.ListByUserIdAsync(userId, cancellationToken);
        var connectedChannels = channels.Count;
        _logger.LogInformation("Found {Count} connected channels for user {UserId}", connectedChannels, userId);

        // 4. Recent History
        var (historyItems, totalHistory) = await _historyRepo.GetPaginatedByUserIdAsync(userId, 1, 5, cancellationToken);
        _logger.LogInformation("Found {Count} recent history items (total {Total}) for user {UserId}", historyItems.Count, totalHistory, userId);
        
        var recentHistory = historyItems.Select(i => {
            var channel = channels.FirstOrDefault(c => c.Id == i.ChannelLinkId);
            return new PostHistoryDto(
                i.Id, i.CampaignId, i.UserId, i.PostId, i.ChannelLinkId, i.Platform, i.ExternalPostId, i.PostUrl, i.PostedAt, i.Status, i.ErrorMessage,
                AvatarUrl: channel?.AvatarUrl,
                DisplayName: channel?.DisplayName,
                Username: channel?.Username
            );
        }).ToList();

        // 5. Automation Overview (Last 30 days)
        var thirtyDaysAgo = DateTimeOffset.UtcNow.AddDays(-30);
        var counts = await _historyRepo.GetPostCountsByDateAsync(userId, thirtyDaysAgo, cancellationToken);
        var automationOverview = counts.ToList();

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new DashboardStatsResponse(
            ActiveCampaigns: activeCampaigns,
            ScheduledPosts: scheduledPosts,
            ConnectedChannels: connectedChannels,
            RecentHistory: recentHistory,
            AutomationOverview: automationOverview
        ), cancellationToken);

        return response;
    }
}
