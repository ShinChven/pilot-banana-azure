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

public class CampaignsCreateFunction
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly ICampaignRepository _campaignRepository;
    private readonly RequestAuthHelper _authHelper;
    private readonly ILogger _logger;

    public CampaignsCreateFunction(
        ICampaignRepository campaignRepository,
        RequestAuthHelper authHelper,
        ILoggerFactory loggerFactory)
    {
        _campaignRepository = campaignRepository;
        _authHelper = authHelper;
        _logger = loggerFactory.CreateLogger<CampaignsCreateFunction>();
    }

    [Function("CreateCampaign")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "api/campaigns")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null)
        {
            var unauth = req.CreateResponse(HttpStatusCode.Unauthorized);
            await unauth.WriteAsJsonAsync(new { error = "Authorization required." }, cancellationToken);
            return unauth;
        }

        CreateCampaignRequest? body;
        try
        {
            body = await JsonSerializer.DeserializeAsync<CreateCampaignRequest>(req.Body, JsonOptions, cancellationToken: cancellationToken);
        }
        catch (JsonException)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Invalid JSON. Expect { name }." }, cancellationToken);
            return bad;
        }

        if (body == null || string.IsNullOrWhiteSpace(body.Name))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Name is required." }, cancellationToken);
            return bad;
        }

        var channelLinkIds = body.ChannelLinkIds?.ToList() ?? new List<string>();
        var campaign = new Campaign
        {
            Id = Guid.NewGuid().ToString("N"),
            UserId = auth.Value.UserId,
            Name = body.Name.Trim(),
            Description = (body.Description ?? string.Empty).Trim(),
            ChannelLinkIds = channelLinkIds,
            Status = CampaignStatus.Draft,
            CreatedAt = DateTimeOffset.UtcNow
        };
        await _campaignRepository.CreateAsync(campaign, cancellationToken);

        var response = req.CreateResponse(HttpStatusCode.Created);
        await response.WriteAsJsonAsync(new CampaignResponse(
            campaign.Id, campaign.UserId, campaign.Name, campaign.Description,
            campaign.ChannelLinkIds, campaign.Status.ToString(), campaign.CreatedAt, campaign.UpdatedAt
        ), cancellationToken);
        return response;
    }
}
