using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Pilot.Api.Services;
using Pilot.Core.Repositories;
using Pilot.Core.DTOs;
using Pilot.Core.Domain;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Pilot.Api.Functions;

public class GlobalHistoryListFunction
{
    private readonly ILogger _logger;
    private readonly IPostHistoryRepository _postHistoryRepository;
    private readonly IChannelLinkRepository _channelLinkRepository;
    private readonly ICampaignRepository _campaignRepository;
    private readonly RequestAuthHelper _authHelper;

    public GlobalHistoryListFunction(
        ILoggerFactory loggerFactory,
        IPostHistoryRepository postHistoryRepository,
        IChannelLinkRepository channelLinkRepository,
        ICampaignRepository campaignRepository,
        RequestAuthHelper authHelper)
    {
        _logger = loggerFactory.CreateLogger<GlobalHistoryListFunction>();
        _postHistoryRepository = postHistoryRepository;
        _channelLinkRepository = channelLinkRepository;
        _campaignRepository = campaignRepository;
        _authHelper = authHelper;
    }

    [Function("GlobalHistoryList")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "api/system/history")] HttpRequest req,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null || auth.Value.Role != UserRole.Admin)
            return new UnauthorizedResult();

        int.TryParse(req.Query["page"], out var page);
        if (page <= 0) page = 1;
        int.TryParse(req.Query["pageSize"], out var pageSize);
        if (pageSize <= 0) pageSize = 10;

        var (items, total) = await _postHistoryRepository.GetPaginatedGlobalAsync(page, pageSize, cancellationToken);

        var uniqueUserIds = items.Select(i => i.UserId).Distinct().ToList();
        var channelsDict = new Dictionary<string, List<ChannelLink>>();

        foreach (var userId in uniqueUserIds)
        {
            var userChannels = await _channelLinkRepository.ListByUserIdAsync(userId, cancellationToken);
            channelsDict[userId] = userChannels.ToList();
        }

        var uniqueCampaignIds = items.Select(i => (i.UserId, i.CampaignId)).Distinct().ToList();
        var campaignsDict = new Dictionary<string, string>();
        foreach (var (uid, cid) in uniqueCampaignIds)
        {
            var camp = await _campaignRepository.GetByIdAsync(uid, cid, cancellationToken);
            if (camp != null) campaignsDict[cid] = camp.Name;
        }

        var dtos = items.Select(i => {
            var userChannels = channelsDict.ContainsKey(i.UserId) ? channelsDict[i.UserId] : new List<ChannelLink>();
            var channel = userChannels.FirstOrDefault(c => c.Id == i.ChannelLinkId);
            return new PostHistoryDto(
                i.Id, i.CampaignId, i.UserId, i.PostId, i.ChannelLinkId, i.Platform, i.ExternalPostId, i.PostUrl, i.PostedAt, i.Status, i.ErrorMessage,
                AvatarUrl: channel?.AvatarUrl,
                DisplayName: channel?.DisplayName,
                Username: channel?.Username,
                CampaignName: campaignsDict.TryGetValue(i.CampaignId, out var name) ? name : null
            );
        }).ToList();

        return new OkObjectResult(new PaginatedList<PostHistoryDto>(dtos, total, page, pageSize));
    }
}
