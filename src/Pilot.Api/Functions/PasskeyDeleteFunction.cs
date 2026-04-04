using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Pilot.Api.Services;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class PasskeyDeleteFunction
{
    private readonly IUserRepository _userRepository;
    private readonly RequestAuthHelper _authHelper;

    public PasskeyDeleteFunction(IUserRepository userRepository, RequestAuthHelper authHelper)
    {
        _userRepository = userRepository;
        _authHelper = authHelper;
    }

    [Function("DeletePasskey")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "api/auth/passkeys/{credentialId}")] HttpRequestData req,
        string credentialId,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null)
        {
            return req.CreateResponse(HttpStatusCode.Unauthorized);
        }

        var user = await _userRepository.GetByIdAsync(auth.Value.UserId, cancellationToken);
        if (user == null)
        {
            return req.CreateResponse(HttpStatusCode.NotFound);
        }

        if (user.Passkeys == null || !user.Passkeys.Any(p => p.CredentialId == credentialId))
        {
            var notFound = req.CreateResponse(HttpStatusCode.NotFound);
            await notFound.WriteAsJsonAsync(new { error = "Passkey not found." }, cancellationToken);
            return notFound;
        }

        user.Passkeys.RemoveAll(p => p.CredentialId == credentialId);
        user.UpdatedAt = DateTimeOffset.UtcNow;
        
        await _userRepository.UpdateAsync(user, cancellationToken);

        return req.CreateResponse(HttpStatusCode.NoContent);
    }
}
