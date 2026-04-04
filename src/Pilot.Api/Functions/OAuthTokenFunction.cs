using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Pilot.Core.Domain;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class OAuthTokenFunction
{
    private readonly IUserApiClientRepository _apiClientRepository;
    private readonly IOAuthAuthorizationCodeRepository _codeRepository;
    private readonly IUserAccessTokenRepository _tokenRepository;

    public OAuthTokenFunction(
        IUserApiClientRepository apiClientRepository,
        IOAuthAuthorizationCodeRepository codeRepository,
        IUserAccessTokenRepository tokenRepository)
    {
        _apiClientRepository = apiClientRepository;
        _codeRepository = codeRepository;
        _tokenRepository = tokenRepository;
    }

    [Function("OAuthToken")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "api/oauth/token")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        // Claude typically sends this as application/x-www-form-urlencoded
        var bodyStr = await new StreamReader(req.Body).ReadToEndAsync(cancellationToken);
        var query = System.Web.HttpUtility.ParseQueryString(bodyStr);

        var grantType = query["grant_type"];
        var code = query["code"];
        var clientId = query["client_id"];
        var clientSecret = query["client_secret"];
        var codeVerifier = query["code_verifier"];
        var redirectUri = query["redirect_uri"];

        if (grantType != "authorization_code" || string.IsNullOrEmpty(code) || string.IsNullOrEmpty(clientId))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "invalid_request" }, cancellationToken);
            return bad;
        }

        // 1. Validate Client
        var client = await _apiClientRepository.GetByIdAsync(clientId, cancellationToken);
        if (client == null || client.IsRevoked)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "invalid_client" }, cancellationToken);
            return bad;
        }

        // If client_secret is provided, validate it (confidential client).
        // If not provided, this is a public client — PKCE will be validated below.
        if (!string.IsNullOrEmpty(clientSecret))
        {
            if (string.IsNullOrEmpty(client.SecretHash))
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { error = "invalid_client" }, cancellationToken);
                return bad;
            }

            var secretHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(clientSecret))).ToLowerInvariant();
            if (client.SecretHash != secretHash)
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { error = "invalid_client" }, cancellationToken);
                return bad;
            }
        }

        // 2. Validate Code
        var authCode = await _codeRepository.GetByCodeAsync(code, cancellationToken);
        if (authCode == null || authCode.IsUsed || authCode.ExpiresAt < DateTimeOffset.UtcNow || authCode.ClientId != clientId)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "invalid_grant" }, cancellationToken);
            return bad;
        }

        // 3. Validate redirect_uri matches the one used during authorization (RFC 6749 §4.1.3)
        if (!string.IsNullOrEmpty(redirectUri) && authCode.RedirectUri != redirectUri)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "invalid_grant", error_description = "redirect_uri mismatch" }, cancellationToken);
            return bad;
        }

        // 4. Validate PKCE code_verifier (RFC 7636)
        if (!string.IsNullOrEmpty(authCode.CodeChallenge))
        {
            if (string.IsNullOrEmpty(codeVerifier))
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { error = "invalid_grant", error_description = "code_verifier required" }, cancellationToken);
                return bad;
            }

            var computedChallenge = Base64UrlEncodeSha256(codeVerifier);
            if (computedChallenge != authCode.CodeChallenge)
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { error = "invalid_grant", error_description = "code_verifier invalid" }, cancellationToken);
                return bad;
            }
        }
        else if (string.IsNullOrEmpty(clientSecret))
        {
            // No PKCE and no client_secret — reject (public client must use PKCE)
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "invalid_request", error_description = "Public clients must use PKCE" }, cancellationToken);
            return bad;
        }

        // Mark code as used
        authCode.IsUsed = true;
        await _codeRepository.UpdateAsync(authCode, cancellationToken);

        // 5. Create a User Access Token
        var rawBytes = RandomNumberGenerator.GetBytes(32);
        var rawToken = "pat_" + Convert.ToBase64String(rawBytes).Replace("+", "-").Replace("/", "_").TrimEnd('=');
        var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken))).ToLowerInvariant();

        var accessToken = new UserAccessToken
        {
            Id = Guid.NewGuid().ToString(),
            UserId = authCode.UserId,
            Name = $"OAuth ({client.Name})",
            TokenHash = tokenHash,
            Prefix = rawToken[..12],
            CreatedAt = DateTimeOffset.UtcNow,
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(30)
        };

        await _tokenRepository.CreateAsync(accessToken, cancellationToken);

        // 6. Return the token in OAuth2 format
        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new
        {
            access_token = rawToken,
            token_type = "Bearer",
            expires_in = 30 * 24 * 3600, // 30 days
            scope = "mcp"
        }, cancellationToken);

        return response;
    }

    /// <summary>
    /// Computes BASE64URL(SHA256(input)) per RFC 7636 §4.2.
    /// </summary>
    private static string Base64UrlEncodeSha256(string input)
    {
        var hash = SHA256.HashData(Encoding.ASCII.GetBytes(input));
        return Convert.ToBase64String(hash)
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');
    }
}
