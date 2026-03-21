using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Pilot.Api.Services;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class CampaignsDeleteFunction
{
    private readonly ICampaignRepository _campaignRepository;
    private readonly RequestAuthHelper _authHelper;

    public CampaignsDeleteFunction(
        ICampaignRepository campaignRepository,
        RequestAuthHelper authHelper,
        ILoggerFactory loggerFactory)
    {
        _campaignRepository = campaignRepository;
        _authHelper = authHelper;
    }

    [Function("DeleteCampaign")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "campaigns/{id}")] HttpRequestData req,
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

        await _campaignRepository.DeleteAsync(auth.Value.UserId, id, cancellationToken);
        return req.CreateResponse(HttpStatusCode.NoContent);
    }
}
