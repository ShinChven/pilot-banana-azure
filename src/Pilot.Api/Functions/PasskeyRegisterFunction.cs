using System.Net;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Pilot.Api.Services;
using Pilot.Core.Domain;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class PasskeyRegisterFunction
{
    private readonly PasskeyChallengeService _challengeService;
    private readonly IUserRepository _userRepository;
    private readonly RequestAuthHelper _authHelper;

    public PasskeyRegisterFunction(
        PasskeyChallengeService challengeService,
        IUserRepository userRepository,
        RequestAuthHelper authHelper)
    {
        _challengeService = challengeService;
        _userRepository = userRepository;
        _authHelper = authHelper;
    }

    public class RegisterRequest
    {
        public string CredentialId { get; set; } = string.Empty;
        public string PublicKey { get; set; } = string.Empty;
        public string UserHandle { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
    }

    [Function("PasskeyRegister")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "auth/passkeys/register")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

        var challenge = _challengeService.GetChallenge(auth.Value.UserId);
        if (challenge == null)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Challenge expired or not found." });
            return bad;
        }

        var body = await JsonSerializer.DeserializeAsync<RegisterRequest>(req.Body, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }, cancellationToken);
        if (body == null || string.IsNullOrEmpty(body.CredentialId) || string.IsNullOrEmpty(body.PublicKey))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Invalid registration data." });
            return bad;
        }

        var user = await _userRepository.GetByIdAsync(auth.Value.UserId, cancellationToken);
        if (user == null) return req.CreateResponse(HttpStatusCode.NotFound);

        user.Passkeys ??= new List<UserPasskey>();
        user.Passkeys.Add(new UserPasskey
        {
            CredentialId = body.CredentialId,
            PublicKey = body.PublicKey,
            UserHandle = body.UserHandle,
            Label = string.IsNullOrEmpty(body.Label) ? "Passkey " + (user.Passkeys.Count + 1) : body.Label,
            CreatedAt = DateTimeOffset.UtcNow,
            SignatureCount = 0
        });

        await _userRepository.UpdateAsync(user, cancellationToken);

        return req.CreateResponse(HttpStatusCode.Created);
    }
}
