using System.Net;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Pilot.Api.Services;
using Pilot.Core.Domain;
using Pilot.Core.DTOs;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class CampaignsUpdateFunction
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly ICampaignRepository _campaignRepository;
    private readonly RequestAuthHelper _authHelper;

    public CampaignsUpdateFunction(
        ICampaignRepository campaignRepository,
        RequestAuthHelper authHelper,
        ILoggerFactory loggerFactory)
    {
        _campaignRepository = campaignRepository;
        _authHelper = authHelper;
    }

    [Function("UpdateCampaign")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "patch", Route = "api/campaigns/{id}")] HttpRequestData req,
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

        UpdateCampaignRequest? body;
        try
        {
            body = await JsonSerializer.DeserializeAsync<UpdateCampaignRequest>(req.Body, JsonOptions, cancellationToken: cancellationToken);
        }
        catch (JsonException)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Invalid JSON." }, cancellationToken);
            return bad;
        }

        if (body != null)
        {
            if (body.Name != null)
            {
                var name = body.Name.Trim();
                if (string.IsNullOrEmpty(name))
                {
                    var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                    await bad.WriteAsJsonAsync(new { error = "Name cannot be empty." }, cancellationToken);
                    return bad;
                }
                campaign.Name = name;
            }
            if (body.Description != null) campaign.Description = body.Description.Trim();
            if (body.ChannelLinkIds != null) campaign.ChannelLinkIds = body.ChannelLinkIds.ToList();
            if (body.Status != null && Enum.TryParse<CampaignStatus>(body.Status, ignoreCase: true, out var status))
                campaign.Status = status;
            campaign.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await _campaignRepository.UpdateAsync(campaign, cancellationToken);

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new CampaignResponse(
            campaign.Id, campaign.UserId, campaign.Name, campaign.Description,
            campaign.ChannelLinkIds ?? new List<string>(), campaign.Status.ToString(), campaign.CreatedAt, campaign.UpdatedAt
        ), cancellationToken);
        return response;
    }
}
