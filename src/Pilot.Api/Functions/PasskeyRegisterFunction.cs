using System.Net;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Pilot.Api.Services;
using Pilot.Core.Domain;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class PasskeyRegisterFunction
{
    private readonly ILogger _logger;
    private readonly PasskeyChallengeService _challengeService;
    private readonly IUserRepository _userRepository;
    private readonly RequestAuthHelper _authHelper;

    public PasskeyRegisterFunction(
        PasskeyChallengeService challengeService,
        IUserRepository userRepository,
        RequestAuthHelper authHelper,
        ILoggerFactory loggerFactory)
    {
        _challengeService = challengeService;
        _userRepository = userRepository;
        _authHelper = authHelper;
        _logger = loggerFactory.CreateLogger<PasskeyRegisterFunction>();
    }

    public class RegisterRequest
    {
        public string Id { get; set; } = string.Empty;
        public string PublicKey { get; set; } = string.Empty;
        public string ClientDataJSON { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
    }

    private static byte[] DecodeBase64Url(string base64Url)
    {
        var base64 = base64Url.Replace('-', '+').Replace('_', '/');
        switch (base64.Length % 4)
        {
            case 2: base64 += "=="; break;
            case 3: base64 += "="; break;
        }
        return Convert.FromBase64String(base64);
    }

    [Function("PasskeyRegister")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "api/auth/passkeys/register")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

        var body = await JsonSerializer.DeserializeAsync<RegisterRequest>(req.Body, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }, cancellationToken);
        _logger.LogInformation("Registration attempt for user {UserId}. Body received: {IsBodyNull}", auth.Value.UserId, body == null);

        if (body == null || string.IsNullOrEmpty(body.Id) || string.IsNullOrEmpty(body.PublicKey) || string.IsNullOrEmpty(body.ClientDataJSON))
        {
            _logger.LogWarning("Invalid registration data. Missing fields: Id={Id}, PublicKey={Pk}, ClientData={Cd}", 
                string.IsNullOrEmpty(body?.Id), string.IsNullOrEmpty(body?.PublicKey), string.IsNullOrEmpty(body?.ClientDataJSON));
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Invalid registration data. Missing ID, PublicKey, or ClientDataJSON." });
            return bad;
        }

        _logger.LogInformation("Registering passkey {CredId} for user {UserId}", body.Id, auth.Value.UserId);

        var expectedChallenge = _challengeService.GetChallenge(auth.Value.UserId);
        if (expectedChallenge == null)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Challenge expired or not found. Please try again." });
            return bad;
        }

        // Verify challenge: clientDataJSON contains base64url-encoded challenge per WebAuthn spec
        try
        {
            var clientDataBytes = DecodeBase64Url(body.ClientDataJSON);
            var clientDataStr = System.Text.Encoding.UTF8.GetString(clientDataBytes);
            var clientData = JsonSerializer.Deserialize<JsonElement>(clientDataStr);
            var challengeFromClient = clientData.GetProperty("challenge").GetString();
            if (challengeFromClient == null)
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { error = "Challenge not found in clientDataJSON." });
                return bad;
            }
            // The challenge in clientDataJSON is base64url(UTF-8(originalChallenge))
            var decodedChallengeBytes = DecodeBase64Url(challengeFromClient);
            var decodedChallenge = System.Text.Encoding.UTF8.GetString(decodedChallengeBytes);
            if (decodedChallenge != expectedChallenge)
            {
                _logger.LogWarning("Challenge mismatch for user {UserId}. Expected: {Expected}, Got: {Got}", auth.Value.UserId, expectedChallenge, decodedChallenge);
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { error = "Challenge verification failed." });
                return bad;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to verify challenge for user {UserId}", auth.Value.UserId);
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Failed to decode clientDataJSON." });
            return bad;
        }

        var user = await _userRepository.GetByIdAsync(auth.Value.UserId, cancellationToken);
        if (user == null) return req.CreateResponse(HttpStatusCode.NotFound);

        user.Passkeys ??= new List<UserPasskey>();
        
        // Prevent duplicate credentials
        if (user.Passkeys.Any(p => p.CredentialId == body.Id))
        {
            _logger.LogWarning("Passkey {CredId} already registered for user {UserId}", body.Id, user.Id);
            var bad = req.CreateResponse(HttpStatusCode.Conflict);
            await bad.WriteAsJsonAsync(new { error = "This passkey is already registered." });
            return bad;
        }

        user.Passkeys.Add(new UserPasskey
        {
            CredentialId = body.Id,
            PublicKey = body.PublicKey,
            UserHandle = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(auth.Value.UserId)),
            Label = string.IsNullOrEmpty(body.Label) ? "Passkey " + (user.Passkeys.Count + 1) : body.Label,
            CreatedAt = DateTimeOffset.UtcNow,
            SignatureCount = 0
        });

        _logger.LogInformation("Saving user {UserId} with {PasskeyCount} passkeys", user.Id, user.Passkeys.Count);
        await _userRepository.UpdateAsync(user, cancellationToken);

        _logger.LogInformation("Registration successful for user {UserId}", user.Id);
        return req.CreateResponse(HttpStatusCode.Created);
    }
}
