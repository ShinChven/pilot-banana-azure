using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Configuration;
using Pilot.Api.Services;

namespace Pilot.Api.Functions;

public class PasskeyRegisterOptionsFunction
{
    private readonly PasskeyChallengeService _challengeService;
    private readonly RequestAuthHelper _authHelper;
    private readonly string _rpId;

    public PasskeyRegisterOptionsFunction(PasskeyChallengeService challengeService, RequestAuthHelper authHelper, IConfiguration configuration)
    {
        _challengeService = challengeService;
        _authHelper = authHelper;
        var frontendUrl = configuration["FrontendBaseUrl"] ?? "";
        _rpId = Uri.TryCreate(frontendUrl, UriKind.Absolute, out var uri) ? uri.Host : "localhost";
    }

    [Function("PasskeyRegisterOptions")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "api/auth/passkeys/register-options")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null)
        {
            return req.CreateResponse(HttpStatusCode.Unauthorized);
        }

        var challenge = _challengeService.CreateChallenge(auth.Value.UserId);

        var options = new
        {
            challenge,
            rp = new { name = "Pilot Banana", id = _rpId },
            user = new
            {
                id = auth.Value.UserId,
                name = auth.Value.Email,
                displayName = auth.Value.Email
            },
            pubKeyCredParams = new[]
            {
                new { type = "public-key", alg = -7 }, // ES256
                new { type = "public-key", alg = -257 } // RS256
            },
            timeout = 60000,
            attestation = "none",
            authenticatorSelection = new
            {
                userVerification = "preferred",
                residentKey = "preferred"
            }
        };

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(options);
        return response;
    }
}
