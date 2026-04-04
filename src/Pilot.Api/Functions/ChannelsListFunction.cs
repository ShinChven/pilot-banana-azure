using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Pilot.Api.Services;
using Pilot.Core.Domain;
using Pilot.Core.DTOs;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class ChannelsListFunction
{
    private readonly IChannelLinkRepository _channelLinkRepository;
    private readonly RequestAuthHelper _authHelper;

    public ChannelsListFunction(
        IChannelLinkRepository channelLinkRepository,
        RequestAuthHelper authHelper,
        ILoggerFactory loggerFactory)
    {
        _channelLinkRepository = channelLinkRepository;
        _authHelper = authHelper;
    }

    [Function("ListChannels")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "api/channels")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null)
        {
            var unauth = req.CreateResponse(HttpStatusCode.Unauthorized);
            await unauth.WriteAsJsonAsync(new { error = "Authorization required." }, cancellationToken);
            return unauth;
        }

        var queryDictionary = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
        int page = 1;
        int pageSize = 10;

        if (int.TryParse(queryDictionary["page"], out int parsedPage) && parsedPage > 0)
            page = parsedPage;
        if (int.TryParse(queryDictionary["pageSize"], out int parsedPageSize) && parsedPageSize > 0)
            pageSize = parsedPageSize;

        var (links, total) = await _channelLinkRepository.ListPaginatedByUserIdAsync(auth.Value.UserId, page, pageSize, cancellationToken);

        var dtos = links.Select(l => new ChannelLinkResponse(
            l.Id, l.UserId, l.Platform, l.ExternalId, l.DisplayName, l.Username, l.Note, l.IsEnabled,
            ProfileUrl(l.Platform, l.ExternalId), l.AvatarUrl, l.CreatedAt, l.UpdatedAt
        )).ToList();

        var result = new PaginatedList<ChannelLinkResponse>
        {
            Items = dtos,
            Total = total,
            Page = page,
            PageSize = pageSize
        };

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(result, cancellationToken);
        return response;
    }

    private static string? ProfileUrl(string platform, string externalId)
    {
        if (string.Equals(platform, ChannelPlatform.X, StringComparison.OrdinalIgnoreCase))
            return $"https://x.com/i/user/{externalId}";
        return null;
    }
}
