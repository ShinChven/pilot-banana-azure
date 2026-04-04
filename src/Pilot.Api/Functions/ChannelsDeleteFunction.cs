using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Pilot.Api.Services;
using Pilot.Core.Repositories;
using Pilot.Core.Services;

namespace Pilot.Api.Functions;

public class ChannelsDeleteFunction
{
    private readonly IChannelLinkRepository _channelLinkRepository;
    private readonly ICampaignRepository _campaignRepository;
    private readonly ISecretStore _secretStore;
    private readonly RequestAuthHelper _authHelper;

    public ChannelsDeleteFunction(
        IChannelLinkRepository channelLinkRepository,
        ICampaignRepository campaignRepository,
        ISecretStore secretStore,
        RequestAuthHelper authHelper,
        ILoggerFactory loggerFactory)
    {
        _channelLinkRepository = channelLinkRepository;
        _campaignRepository = campaignRepository;
        _secretStore = secretStore;
        _authHelper = authHelper;
    }

    [Function("DeleteChannel")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "api/channels/{id}")] HttpRequestData req,
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

        var link = await _channelLinkRepository.GetByIdAsync(auth.Value.UserId, id, cancellationToken);
        if (link == null)
        {
            var notFound = req.CreateResponse(HttpStatusCode.NotFound);
            await notFound.WriteAsJsonAsync(new { error = "Channel link not found." }, cancellationToken);
            return notFound;
        }

        // Clean up campaigns that reference this channel
        var campaigns = await _campaignRepository.ListByChannelLinkIdAsync(auth.Value.UserId, id, cancellationToken);
        foreach (var campaign in campaigns)
        {
            if (campaign.ChannelLinkIds != null && campaign.ChannelLinkIds.Contains(id))
            {
                campaign.ChannelLinkIds.Remove(id);
                campaign.UpdatedAt = DateTimeOffset.UtcNow;
                await _campaignRepository.UpdateAsync(campaign, cancellationToken);
            }
        }

        if (!string.IsNullOrEmpty(link.TokenSecretName))
        {
            await _secretStore.DeleteSecretAsync(link.TokenSecretName, cancellationToken);
        }

        await _channelLinkRepository.DeleteAsync(auth.Value.UserId, id, cancellationToken);
        return req.CreateResponse(HttpStatusCode.NoContent);
    }
}
