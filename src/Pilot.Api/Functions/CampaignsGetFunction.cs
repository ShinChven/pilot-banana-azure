using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Pilot.Api.Services;
using Pilot.Core.DTOs;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class CampaignsGetFunction
{
    private readonly ICampaignRepository _campaignRepository;
    private readonly RequestAuthHelper _authHelper;

    public CampaignsGetFunction(
        ICampaignRepository campaignRepository,
        RequestAuthHelper authHelper,
        ILoggerFactory loggerFactory)
    {
        _campaignRepository = campaignRepository;
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

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new CampaignResponse(
            campaign.Id, campaign.UserId, campaign.Name, campaign.Description,
            campaign.ChannelLinkIds ?? new List<string>(), campaign.Status.ToString(), campaign.CreatedAt, campaign.UpdatedAt
        ), cancellationToken);
        return response;
    }
}
