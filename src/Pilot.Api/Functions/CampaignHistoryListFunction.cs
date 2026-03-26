using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Pilot.Api.Services;
using Pilot.Core.Repositories;
using Pilot.Core.DTOs;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Pilot.Api.Functions;

public class CampaignHistoryListFunction
{
    private readonly ILogger _logger;
    private readonly IPostHistoryRepository _postHistoryRepository;
    private readonly IChannelLinkRepository _channelLinkRepository;
    private readonly ICampaignRepository _campaignRepository;
    private readonly RequestAuthHelper _authHelper;

    public CampaignHistoryListFunction(
        ILoggerFactory loggerFactory,
        IPostHistoryRepository postHistoryRepository,
        IChannelLinkRepository channelLinkRepository,
        ICampaignRepository campaignRepository,
        RequestAuthHelper authHelper)
    {
        _logger = loggerFactory.CreateLogger<CampaignHistoryListFunction>();
        _postHistoryRepository = postHistoryRepository;
        _channelLinkRepository = channelLinkRepository;
        _campaignRepository = campaignRepository;
        _authHelper = authHelper;
    }

    [Function("CampaignHistoryList")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "users/{userId}/campaigns/{campaignId}/history")] HttpRequest req,
        string userId, string campaignId, CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null)
            return new UnauthorizedResult();

        var isAdmin = auth.Value.Role == Pilot.Core.Domain.UserRole.Admin;
        if (auth.Value.UserId != userId && !isAdmin)
            return new ForbidResult();

        // Data Isolation: Ensure the campaign belongs to the user
        var campaign = await _campaignRepository.GetByIdAsync(userId, campaignId, cancellationToken);
        if (campaign == null)
            return new NotFoundObjectResult(new { error = "Campaign not found or does not belong to this user." });

        int.TryParse(req.Query["page"], out var page);
        if (page <= 0) page = 1;
        int.TryParse(req.Query["pageSize"], out var pageSize);
        if (pageSize <= 0) pageSize = 10;

        var (items, total) = await _postHistoryRepository.GetPaginatedByCampaignIdAsync(campaignId, page, pageSize, cancellationToken);

        var channels = await _channelLinkRepository.ListByUserIdAsync(userId, cancellationToken);

        var dtos = items.Select(i => {
            var channel = channels.FirstOrDefault(c => c.Id == i.ChannelLinkId);
            return new PostHistoryDto(
                i.Id, i.CampaignId, i.UserId, i.PostId, i.ChannelLinkId, i.Platform, i.ExternalPostId, i.PostUrl, i.PostedAt, i.Status, i.ErrorMessage,
                AvatarUrl: channel?.AvatarUrl,
                DisplayName: channel?.DisplayName,
                Username: channel?.Username,
                CampaignName: campaign.Name
            );
        }).ToList();

        return new OkObjectResult(new PaginatedList<PostHistoryDto>(dtos, total, page, pageSize));
    }
}
