using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Pilot.Api.Services;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class ApiClientsDeleteFunction
{
    private readonly RequestAuthHelper _authHelper;
    private readonly IUserApiClientRepository _apiClientRepository;

    public ApiClientsDeleteFunction(RequestAuthHelper authHelper, IUserApiClientRepository apiClientRepository)
    {
        _authHelper = authHelper;
        _apiClientRepository = apiClientRepository;
    }

    [Function("ApiClientsDelete")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "api/auth/api-clients/{clientId}")] HttpRequestData req,
        string clientId,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null)
        {
            var unauth = req.CreateResponse(HttpStatusCode.Unauthorized);
            await unauth.WriteAsJsonAsync(new { error = "Authorization required." }, cancellationToken);
            return unauth;
        }

        var clients = await _apiClientRepository.ListByUserIdAsync(auth.Value.UserId, cancellationToken);
        var client = clients.FirstOrDefault(c => c.Id == clientId);
        if (client == null)
        {
            var notFound = req.CreateResponse(HttpStatusCode.NotFound);
            await notFound.WriteAsJsonAsync(new { error = "API client not found." }, cancellationToken);
            return notFound;
        }

        if (client.IsRevoked)
        {
            await _apiClientRepository.DeleteAsync(auth.Value.UserId, clientId, cancellationToken);
        }
        else
        {
            // Soft delete: mark as revoked
            client.IsRevoked = true;
            await _apiClientRepository.UpdateAsync(client, cancellationToken);
        }

        return req.CreateResponse(HttpStatusCode.NoContent);
    }
}
