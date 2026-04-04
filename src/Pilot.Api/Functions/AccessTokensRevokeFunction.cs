using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Pilot.Api.Services;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class AccessTokensRevokeFunction
{
    private readonly RequestAuthHelper _authHelper;
    private readonly IUserAccessTokenRepository _tokenRepository;

    public AccessTokensRevokeFunction(RequestAuthHelper authHelper, IUserAccessTokenRepository tokenRepository)
    {
        _authHelper = authHelper;
        _tokenRepository = tokenRepository;
    }

    [Function("AccessTokensRevoke")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "api/auth/access-tokens/{tokenId}")] HttpRequestData req,
        string tokenId,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null)
        {
            var unauth = req.CreateResponse(HttpStatusCode.Unauthorized);
            await unauth.WriteAsJsonAsync(new { error = "Authorization required." }, cancellationToken);
            return unauth;
        }

        var token = await _tokenRepository.GetByIdAsync(tokenId, auth.Value.UserId, cancellationToken);
        if (token == null)
        {
            var notFound = req.CreateResponse(HttpStatusCode.NotFound);
            await notFound.WriteAsJsonAsync(new { error = "Access token not found." }, cancellationToken);
            return notFound;
        }

        if (token.IsRevoked)
        {
            await _tokenRepository.DeleteAsync(tokenId, auth.Value.UserId, cancellationToken);
        }
        else
        {
            token.IsRevoked = true;
            await _tokenRepository.UpdateAsync(token, cancellationToken);
        }

        return req.CreateResponse(HttpStatusCode.NoContent);
    }
}
