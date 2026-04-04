using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Pilot.Api.Services;
using Pilot.Core.Domain;
using Pilot.Core.DTOs;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class AccessTokensCreateFunction
{
    private readonly RequestAuthHelper _authHelper;
    private readonly IUserAccessTokenRepository _tokenRepository;

    public AccessTokensCreateFunction(RequestAuthHelper authHelper, IUserAccessTokenRepository tokenRepository)
    {
        _authHelper = authHelper;
        _tokenRepository = tokenRepository;
    }

    [Function("AccessTokensCreate")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "api/auth/access-tokens")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null)
        {
            var unauth = req.CreateResponse(HttpStatusCode.Unauthorized);
            await unauth.WriteAsJsonAsync(new { error = "Authorization required." }, cancellationToken);
            return unauth;
        }

        CreateAccessTokenRequest? body;
        try
        {
            body = await JsonSerializer.DeserializeAsync<CreateAccessTokenRequest>(req.Body, cancellationToken: cancellationToken);
        }
        catch (JsonException)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Invalid JSON body." }, cancellationToken);
            return bad;
        }

        if (body == null || string.IsNullOrWhiteSpace(body.Name))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Name is required." }, cancellationToken);
            return bad;
        }

        // Generate a secure random token with pat_ prefix
        var rawBytes = RandomNumberGenerator.GetBytes(32);
        var rawToken = "pat_" + Convert.ToBase64String(rawBytes).Replace("+", "-").Replace("/", "_").TrimEnd('=');
        var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken))).ToLowerInvariant();
        var prefix = rawToken[..12];

        var now = DateTimeOffset.UtcNow;
        var accessToken = new UserAccessToken
        {
            Id = Guid.NewGuid().ToString(),
            UserId = auth.Value.UserId,
            Name = body.Name.Trim(),
            TokenHash = tokenHash,
            Prefix = prefix,
            CreatedAt = now,
            ExpiresAt = body.ExpiresInDays.HasValue ? now.AddDays(body.ExpiresInDays.Value) : null
        };

        await _tokenRepository.CreateAsync(accessToken, cancellationToken);

        var response = req.CreateResponse(HttpStatusCode.Created);
        await response.WriteAsJsonAsync(new AccessTokenCreatedResponse(
            accessToken.Id,
            accessToken.Name,
            rawToken,
            accessToken.Prefix,
            accessToken.CreatedAt,
            accessToken.ExpiresAt
        ), cancellationToken);
        return response;
    }
}
