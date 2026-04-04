using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Configuration;
using Pilot.Api.Services;

namespace Pilot.Api.Functions;

public class PasskeyLoginOptionsFunction
{
    private readonly PasskeyChallengeService _challengeService;
    private readonly string _rpId;

    public PasskeyLoginOptionsFunction(PasskeyChallengeService challengeService, IConfiguration configuration)
    {
        _challengeService = challengeService;
        var frontendUrl = configuration["FrontendBaseUrl"] ?? "";
        _rpId = Uri.TryCreate(frontendUrl, UriKind.Absolute, out var uri) ? uri.Host : "localhost";
    }

    [Function("PasskeyLoginOptions")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "api/auth/passkeys/login-options")] HttpRequestData req)
    {
        var sessionId = Guid.NewGuid().ToString("N");
        var challenge = _challengeService.CreateChallenge(sessionId);

        var options = new
        {
            sessionId,
            rpId = _rpId,
            challenge,
            timeout = 60000,
            userVerification = "preferred"
        };

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(options);
        return response;
    }
}
