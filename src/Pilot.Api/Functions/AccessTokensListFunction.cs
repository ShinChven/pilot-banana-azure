using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Pilot.Api.Services;
using Pilot.Core.DTOs;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class AccessTokensListFunction
{
    private readonly RequestAuthHelper _authHelper;
    private readonly IUserAccessTokenRepository _tokenRepository;

    public AccessTokensListFunction(RequestAuthHelper authHelper, IUserAccessTokenRepository tokenRepository)
    {
        _authHelper = authHelper;
        _tokenRepository = tokenRepository;
    }

    [Function("AccessTokensList")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "api/auth/access-tokens")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null)
        {
            var unauth = req.CreateResponse(HttpStatusCode.Unauthorized);
            await unauth.WriteAsJsonAsync(new { error = "Authorization required." }, cancellationToken);
            return unauth;
        }

        int page = 1;
        int pageSize = 10;

        var query = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
        if (int.TryParse(query["page"], out int p) && p > 0) page = p;
        if (int.TryParse(query["pageSize"], out int ps) && ps > 0) pageSize = ps;

        var (tokens, total) = await _tokenRepository.GetPaginatedByUserIdAsync(auth.Value.UserId, page, pageSize, cancellationToken);
        var items = tokens.Select(t => new AccessTokenResponse(
            t.Id,
            t.Name,
            t.Prefix,
            t.CreatedAt,
            t.ExpiresAt,
            t.LastUsedAt,
            t.IsRevoked
        )).ToList();

        var result = new PaginatedList<AccessTokenResponse>(items, total, page, pageSize);

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(result, cancellationToken);
        return response;
    }
}
