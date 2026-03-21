using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Pilot.Api.Services;

namespace Pilot.Api.Functions;

public class PasskeyLoginOptionsFunction
{
    private readonly PasskeyChallengeService _challengeService;

    public PasskeyLoginOptionsFunction(PasskeyChallengeService challengeService)
    {
        _challengeService = challengeService;
    }

    [Function("PasskeyLoginOptions")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "auth/passkeys/login-options")] HttpRequestData req)
    {
        var sessionId = Guid.NewGuid().ToString("N");
        var challenge = _challengeService.CreateChallenge(sessionId);

        var options = new
        {
            sessionId,
            rpId = req.Url.Host == "localhost" ? "localhost" : req.Url.Host,
            challenge,
            timeout = 60000,
            userVerification = "preferred"
        };

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(options);
        return response;
    }
}
