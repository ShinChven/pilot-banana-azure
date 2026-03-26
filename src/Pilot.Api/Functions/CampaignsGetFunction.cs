using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Pilot.Api.Services;
using Pilot.Core.Domain;
using Pilot.Core.DTOs;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class CampaignsGetFunction
{
    private readonly ICampaignRepository _campaignRepository;
    private readonly IPostRepository _postRepository;
    private readonly RequestAuthHelper _authHelper;

    public CampaignsGetFunction(
        ICampaignRepository campaignRepository,
        IPostRepository postRepository,
        RequestAuthHelper authHelper,
        ILoggerFactory loggerFactory)
    {
        _campaignRepository = campaignRepository;
        _postRepository = postRepository;
        _authHelper = authHelper;
    }

    [Function("GetCampaign")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "campaigns/{id}")] HttpRequestData req,
        string id,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null)
        {
            var unauth = req.CreateResponse(HttpStatusCode.Unauthorized);
            await unauth.WriteAsJsonAsync(new { error = "Authorization required." }, cancellationToken);
            return unauth;
        }

        var campaign = await _campaignRepository.GetByIdAsync(auth.Value.UserId, id, cancellationToken);
        if (campaign == null)
        {
            var notFound = req.CreateResponse(HttpStatusCode.NotFound);
            await notFound.WriteAsJsonAsync(new { error = "Campaign not found." }, cancellationToken);
            return notFound;
        }

        var posts = await _postRepository.GetByCampaignIdAsync(id, cancellationToken);
        var totalPosts = posts.Count;
        var postedPosts = posts.Count(p => p.Status == PostStatus.Posted);
        var endDate = posts
            .Where(p => p.ScheduledTime.HasValue && (p.Status == PostStatus.Scheduled || p.Status == PostStatus.Posted))
            .MaxBy(p => p.ScheduledTime)
            ?.ScheduledTime;

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new CampaignResponse(
            campaign.Id, campaign.UserId, campaign.Name, campaign.Description,
            campaign.ChannelLinkIds ?? new List<string>(), campaign.Status.ToString(), campaign.CreatedAt, campaign.UpdatedAt,
            totalPosts, postedPosts, endDate
        ), cancellationToken);
        return response;
    }
}
