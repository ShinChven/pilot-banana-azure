using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Pilot.Api.Services;
using Pilot.Core.Adapters;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class ChannelsRefreshFunction
{
    private readonly IChannelLinkRepository _channelLinkRepository;
    private readonly IEnumerable<IPlatformAdapter> _adapters;
    private readonly RequestAuthHelper _authHelper;
    private readonly ILogger _logger;

    public ChannelsRefreshFunction(
        IChannelLinkRepository channelLinkRepository,
        IEnumerable<IPlatformAdapter> adapters,
        RequestAuthHelper authHelper,
        ILoggerFactory loggerFactory)
    {
        _channelLinkRepository = channelLinkRepository;
        _adapters = adapters;
        _authHelper = authHelper;
        _logger = loggerFactory.CreateLogger<ChannelsRefreshFunction>();
    }

    [Function("RefreshChannelToken")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "channels/{id}/refresh")] HttpRequestData req,
        string id,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null)
            return req.CreateResponse(HttpStatusCode.Unauthorized);

        var channel = await _channelLinkRepository.GetByIdAsync(auth.Value.UserId, id, cancellationToken);
        if (channel == null)
            return req.CreateResponse(HttpStatusCode.NotFound);

        var adapter = _adapters.FirstOrDefault(a => string.Equals(a.PlatformId, channel.Platform, StringComparison.OrdinalIgnoreCase));
        if (adapter == null)
        {
            var res = req.CreateResponse(HttpStatusCode.BadRequest);
            await res.WriteAsJsonAsync(new { error = $"No adapter found for platform {channel.Platform}" }, cancellationToken);
            return res;
        }

        try
        {
            var success = await adapter.RefreshTokenAsync(channel.Id, channel.TokenSecretName, cancellationToken);
            var response = req.CreateResponse(success ? HttpStatusCode.OK : HttpStatusCode.BadRequest);
            await response.WriteAsJsonAsync(new { success }, cancellationToken);
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to refresh token manually for channel {Id}", id);
            var err = req.CreateResponse(HttpStatusCode.InternalServerError);
            await err.WriteAsJsonAsync(new { error = ex.Message }, cancellationToken);
            return err;
        }
    }
}
