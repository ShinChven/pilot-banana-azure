using System.Net;
using System.Security.Cryptography;
using System.Web;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Configuration;
using Pilot.Api.Services;
using Pilot.Core.Domain;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class OAuthAuthorizeFunction
{
    private static readonly System.Text.Json.JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly RequestAuthHelper _authHelper;
    private readonly IUserApiClientRepository _apiClientRepository;
    private readonly IOAuthAuthorizationCodeRepository _codeRepository;
    private readonly string? _frontendBaseUrl;

    public OAuthAuthorizeFunction(
        RequestAuthHelper authHelper,
        IUserApiClientRepository apiClientRepository,
        IOAuthAuthorizationCodeRepository codeRepository,
        IConfiguration configuration)
    {
        _authHelper = authHelper;
        _apiClientRepository = apiClientRepository;
        _codeRepository = codeRepository;
        _frontendBaseUrl = configuration["FrontendBaseUrl"];
    }

    /// <summary>
    /// OAuth2 Authorization Endpoint.
    /// If user is already authenticated (Bearer token), issues auth code and redirects.
    /// If user is not authenticated, redirects to frontend /oauth/authorize page to login and approve.
    /// </summary>
    [Function("OAuthAuthorize")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "api/oauth/authorize")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        var clientId = req.Query["client_id"];
        var redirectUri = req.Query["redirect_uri"];
        var responseType = req.Query["response_type"];
        var state = req.Query["state"];
        var scope = req.Query["scope"];
        var codeChallenge = req.Query["code_challenge"];
        var codeChallengeMethod = req.Query["code_challenge_method"];

        if (string.IsNullOrEmpty(clientId) || responseType != "code")
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync("Invalid request parameters. Required: client_id, response_type=code");
            return bad;
        }

        var client = await _apiClientRepository.GetByIdAsync(clientId, cancellationToken);
        if (client == null || client.IsRevoked)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync("Invalid client_id.");
            return bad;
        }

        // Validate redirect_uri
        if (!string.IsNullOrEmpty(redirectUri) && client.RedirectUri != redirectUri)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync("Invalid redirect_uri.");
            return bad;
        }

        // Check if user is authenticated
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null)
        {
            // Redirect to frontend authorize page with all OAuth params preserved
            var frontendBase = _frontendBaseUrl?.TrimEnd('/') ?? req.Url.GetLeftPart(UriPartial.Authority);
            var qs = HttpUtility.ParseQueryString(string.Empty);
            qs["client_id"] = clientId;
            qs["redirect_uri"] = redirectUri ?? client.RedirectUri;
            qs["response_type"] = responseType;
            if (!string.IsNullOrEmpty(state)) qs["state"] = state;
            if (!string.IsNullOrEmpty(scope)) qs["scope"] = scope;
            if (!string.IsNullOrEmpty(codeChallenge)) qs["code_challenge"] = codeChallenge;
            if (!string.IsNullOrEmpty(codeChallengeMethod)) qs["code_challenge_method"] = codeChallengeMethod;

            var authorizePageUrl = $"{frontendBase}/oauth/authorize?{qs}";
            var redirect = req.CreateResponse(HttpStatusCode.Redirect);
            redirect.Headers.Add("Location", authorizePageUrl);
            return redirect;
        }

        // User is authenticated — issue authorization code
        if (!CanUserAuthorizeClient(client, auth.Value.UserId))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync("Invalid client_id.");
            return bad;
        }

        client = await EnsureDynamicClientAssociationAsync(client, auth.Value.UserId, cancellationToken);

        return await IssueAuthorizationCode(req, auth.Value.UserId, clientId, redirectUri ?? client.RedirectUri, state, codeChallenge, codeChallengeMethod, cancellationToken);
    }

    /// <summary>
    /// Called by frontend after user approves. User must be authenticated.
    /// POST /api/oauth/authorize with JSON body { clientId, redirectUri, state }.
    /// Returns { redirectUrl } for the frontend to navigate to.
    /// </summary>
    [Function("OAuthAuthorizeApprove")]
    public async Task<HttpResponseData> Approve(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "api/oauth/authorize")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null)
        {
            var unauth = req.CreateResponse(HttpStatusCode.Unauthorized);
            await unauth.WriteAsJsonAsync(new { error = "Authorization required." }, cancellationToken);
            return unauth;
        }

        var body = await System.Text.Json.JsonSerializer.DeserializeAsync<ApproveRequest>(req.Body, JsonOptions, cancellationToken);
        if (body == null || string.IsNullOrEmpty(body.ClientId))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "clientId is required." }, cancellationToken);
            return bad;
        }

        var client = await _apiClientRepository.GetByIdAsync(body.ClientId, cancellationToken);
        if (client == null || client.IsRevoked)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Invalid client_id." }, cancellationToken);
            return bad;
        }

        if (!CanUserAuthorizeClient(client, auth.Value.UserId))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Invalid client_id." }, cancellationToken);
            return bad;
        }

        client = await EnsureDynamicClientAssociationAsync(client, auth.Value.UserId, cancellationToken);

        if (!string.IsNullOrEmpty(body.RedirectUri) && !string.Equals(body.RedirectUri, client.RedirectUri, StringComparison.Ordinal))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Invalid redirect_uri." }, cancellationToken);
            return bad;
        }

        var effectiveRedirectUri = body.RedirectUri ?? client.RedirectUri;

        // Generate authorization code
        var codeValue = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
        var authCode = new OAuthAuthorizationCode
        {
            Id = codeValue,
            ClientId = body.ClientId,
            UserId = auth.Value.UserId,
            RedirectUri = effectiveRedirectUri,
            State = body.State,
            ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(10),
            IsUsed = false,
            CodeChallenge = body.CodeChallenge,
            CodeChallengeMethod = body.CodeChallengeMethod
        };

        await _codeRepository.CreateAsync(authCode, cancellationToken);

        var callbackUrl = $"{effectiveRedirectUri}?code={authCode.Id}";
        if (!string.IsNullOrEmpty(body.State))
            callbackUrl += $"&state={HttpUtility.UrlEncode(body.State)}";

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new { redirectUrl = callbackUrl }, cancellationToken);
        return response;
    }

    private static bool CanUserAuthorizeClient(UserApiClient client, string userId)
    {
        return string.Equals(client.UserId, userId, StringComparison.Ordinal)
            || (client.IsDynamic && string.Equals(client.UserId, "dynamic", StringComparison.Ordinal));
    }

    private async Task<UserApiClient> EnsureDynamicClientAssociationAsync(UserApiClient client, string userId, CancellationToken cancellationToken)
    {
        if (!client.IsDynamic || !string.Equals(client.UserId, "dynamic", StringComparison.Ordinal))
            return client;

        client.LastUsedAt = DateTimeOffset.UtcNow;
        return await _apiClientRepository.ReassignUserAsync(client, userId, cancellationToken);
    }

    private async Task<HttpResponseData> IssueAuthorizationCode(
        HttpRequestData req, string userId, string clientId, string redirectUri, string? state,
        string? codeChallenge, string? codeChallengeMethod,
        CancellationToken cancellationToken)
    {
        var codeValue = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
        var authCode = new OAuthAuthorizationCode
        {
            Id = codeValue,
            ClientId = clientId,
            UserId = userId,
            RedirectUri = redirectUri,
            State = state,
            ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(10),
            IsUsed = false,
            CodeChallenge = codeChallenge,
            CodeChallengeMethod = codeChallengeMethod
        };

        await _codeRepository.CreateAsync(authCode, cancellationToken);

        var callbackUrl = $"{redirectUri}?code={authCode.Id}";
        if (!string.IsNullOrEmpty(state))
            callbackUrl += $"&state={HttpUtility.UrlEncode(state)}";

        var redirect = req.CreateResponse(HttpStatusCode.Redirect);
        redirect.Headers.Add("Location", callbackUrl);
        return redirect;
    }

    public record ApproveRequest
    {
        public string ClientId { get; init; } = string.Empty;
        public string? RedirectUri { get; init; }
        public string? State { get; init; }
        public string? CodeChallenge { get; init; }
        public string? CodeChallengeMethod { get; init; }
    }
}
