using System.Net;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Pilot.Api.Services;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class ApiClientsListFunction
{
    private readonly RequestAuthHelper _authHelper;
    private readonly IUserApiClientRepository _apiClientRepository;

    public ApiClientsListFunction(RequestAuthHelper authHelper, IUserApiClientRepository apiClientRepository)
    {
        _authHelper = authHelper;
        _apiClientRepository = apiClientRepository;
    }

    [Function("ApiClientsList")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "api/auth/api-clients")] HttpRequestData req,
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

        var (clients, total) = await _apiClientRepository.GetPaginatedByUserIdAsync(auth.Value.UserId, page, pageSize, cancellationToken);
        var items = clients.Select(c => new
        {
            clientId = c.Id,
            name = c.Name,
            redirectUri = c.RedirectUri,
            createdAt = c.CreatedAt,
            lastUsedAt = c.LastUsedAt,
            isRevoked = c.IsRevoked
        }).ToList();

        var result = new
        {
            items = items,
            total = total,
            page = page,
            pageSize = pageSize
        };

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(result, cancellationToken);
        
        return response;
    }
}
