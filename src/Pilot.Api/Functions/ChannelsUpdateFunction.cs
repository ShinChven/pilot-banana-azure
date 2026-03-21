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

public class ChannelsUpdateFunction
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly IChannelLinkRepository _channelLinkRepository;
    private readonly RequestAuthHelper _authHelper;

    public ChannelsUpdateFunction(
        IChannelLinkRepository channelLinkRepository,
        RequestAuthHelper authHelper,
        ILoggerFactory loggerFactory)
    {
        _channelLinkRepository = channelLinkRepository;
        _authHelper = authHelper;
    }

    [Function("UpdateChannel")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "patch", Route = "channels/{id}")] HttpRequestData req,
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

        UpdateChannelLinkRequest? body;
        try
        {
            body = await JsonSerializer.DeserializeAsync<UpdateChannelLinkRequest>(req.Body, JsonOptions, cancellationToken);
        }
        catch (JsonException)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Invalid JSON. Expect { note?, isEnabled? }." }, cancellationToken);
            return bad;
        }

        if (body != null)
        {
            if (body.Note != null)
                link.Note = body.Note;
            if (body.IsEnabled.HasValue)
                link.IsEnabled = body.IsEnabled.Value;
        }

        link.UpdatedAt = DateTimeOffset.UtcNow;
        await _channelLinkRepository.UpdateAsync(link, cancellationToken);

        var profileUrl = string.Equals(link.Platform, ChannelPlatform.X, StringComparison.OrdinalIgnoreCase)
            ? $"https://x.com/i/user/{link.ExternalId}"
            : null;
        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new ChannelLinkResponse(
            link.Id, link.UserId, link.Platform, link.ExternalId, link.DisplayName, link.Username, link.Note, link.IsEnabled,
            profileUrl, link.AvatarUrl, link.CreatedAt, link.UpdatedAt), cancellationToken);
        return response;
    }
}
