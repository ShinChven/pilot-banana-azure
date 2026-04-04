using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Pilot.Adapters.X;
using Pilot.Api.Options;
using Pilot.Api.Services;
using Pilot.Core.Adapters;
using Pilot.Core.Domain;
using Pilot.Core.Repositories;
using Pilot.Core.Services;

namespace Pilot.Api.Functions;

/// <summary>
/// X OAuth 2.0 callback: exchange code for token, store in Key Vault, create ChannelLink, redirect to dashboard.
/// </summary>
public class ChannelsCallbackFunction
{
    private static readonly string XTokenUrl = $"{XAdapterOptions.BaseUrl}/2/oauth2/token";
    private static readonly string XUsersMeUrl = $"{XAdapterOptions.BaseUrl}/2/users/me?user.fields=name,username,profile_image_url";

    private readonly XOAuthStateService _stateService;
    private readonly ISecretStore _secretStore;
    private readonly IChannelLinkRepository _channelLinkRepository;
    private readonly HttpClient _httpClient;
    private readonly XOAuthOptions _options;
    private readonly ILogger _logger;

    public ChannelsCallbackFunction(
        XOAuthStateService stateService,
        ISecretStore secretStore,
        IChannelLinkRepository channelLinkRepository,
        IHttpClientFactory httpClientFactory,
        IOptions<XOAuthOptions> options,
        ILoggerFactory loggerFactory)
    {
        _stateService = stateService;
        _secretStore = secretStore;
        _channelLinkRepository = channelLinkRepository;
        _httpClient = httpClientFactory.CreateClient("Pilot.XOAuth");
        _options = options.Value;
        _logger = loggerFactory.CreateLogger<ChannelsCallbackFunction>();
    }

    [Function("ChannelsCallback")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "api/channels/callback/{platform}")] HttpRequestData req,
        string platform,
        CancellationToken cancellationToken)
    {
        var dashboardUrl = _options.DashboardBaseUrl.TrimEnd('/') + "/channels";
        var redirectError = dashboardUrl + "?error=access_denied";

        if (string.IsNullOrEmpty(platform) || !string.Equals(platform, ChannelPlatform.X, StringComparison.OrdinalIgnoreCase))
        {
            return Redirect(req, redirectError);
        }

        var query = ParseQueryString(req.Url.Query);
        var error = query.GetValueOrDefault("error");
        if (!string.IsNullOrEmpty(error))
        {
            _logger.LogWarning("OAuth callback error from X: {Error}", error);
            return Redirect(req, dashboardUrl + "?error=" + Uri.EscapeDataString(error));
        }

        var code = query.GetValueOrDefault("code");
        var state = query.GetValueOrDefault("state");
        if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(state))
        {
            return Redirect(req, redirectError);
        }

        var stateResult = _stateService.ValidateState(state);
        if (stateResult == null)
        {
            _logger.LogWarning("Invalid or expired OAuth state.");
            return Redirect(req, redirectError);
        }

        var (userId, codeVerifier) = stateResult.Value;

        if (string.IsNullOrEmpty(_options.ClientId) || string.IsNullOrEmpty(_options.ClientSecret))
        {
            _logger.LogWarning("XOAuth not configured for token exchange.");
            return Redirect(req, redirectError);
        }

        var redirectUri = _options.ApiBaseUrl.TrimEnd('/') + "/api/channels/callback/x";
        var tokenResponse = await ExchangeCodeForTokenAsync(code, codeVerifier, redirectUri, cancellationToken);
        if (tokenResponse == null)
        {
            return Redirect(req, redirectError);
        }

        var meResponse = await GetXUserMeAsync(tokenResponse.AccessToken, cancellationToken);
        if (meResponse == null)
        {
            return Redirect(req, redirectError);
        }

        var linkId = Guid.NewGuid().ToString("N");
        var secretName = "channellink-" + linkId;

        var tokenData = new TokenData
        {
            AccessToken = tokenResponse.AccessToken,
            RefreshToken = tokenResponse.RefreshToken,
            ExpiresAt = tokenResponse.ExpiresIn.HasValue 
                ? DateTimeOffset.UtcNow.AddSeconds(tokenResponse.ExpiresIn.Value) 
                : null
        };
        var tokenValue = JsonSerializer.Serialize(tokenData);
        await _secretStore.SetSecretAsync(secretName, tokenValue, cancellationToken);

        var link = new ChannelLink
        {
            Id = linkId,
            UserId = userId,
            Platform = ChannelPlatform.X,
            ExternalId = meResponse.Id,
            DisplayName = meResponse.Name,
            Username = meResponse.Username,
            AvatarUrl = meResponse.ProfileImageUrl,
            Note = null,
            TokenSecretName = secretName,
            CreatedAt = DateTimeOffset.UtcNow
        };
        await _channelLinkRepository.CreateAsync(link, cancellationToken);

        _logger.LogInformation("Connected X account {ExternalId} for user {UserId}", link.ExternalId, userId);
        return Redirect(req, dashboardUrl + "?connected=x");
    }

    private async Task<TokenResponse?> ExchangeCodeForTokenAsync(string code, string codeVerifier, string redirectUri, CancellationToken ct)
    {
        var basicAuth = Convert.ToBase64String(Encoding.UTF8.GetBytes(_options.ClientId + ":" + _options.ClientSecret));

        var body = new Dictionary<string, string>
        {
            ["grant_type"] = "authorization_code",
            ["code"] = code,
            ["redirect_uri"] = redirectUri,
            ["code_verifier"] = codeVerifier
        };
        var content = new FormUrlEncodedContent(body);
        using var req = new HttpRequestMessage(HttpMethod.Post, XTokenUrl) { Content = content };
        req.Headers.Authorization = new AuthenticationHeaderValue("Basic", basicAuth);

        var response = await _httpClient.SendAsync(req, ct);
        var json = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Token exchange failed: {Status} {Body}", response.StatusCode, json);
            return null;
        }

        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var accessToken = root.TryGetProperty("access_token", out var at) ? at.GetString() : null;
        var refreshToken = root.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : null;
        var expiresIn = root.TryGetProperty("expires_in", out var ei) && ei.ValueKind == JsonValueKind.Number ? ei.GetInt32() : (int?)null;
        if (string.IsNullOrEmpty(accessToken)) return null;
        return new TokenResponse(accessToken, refreshToken, expiresIn);
    }

    private async Task<XUserMeResponse?> GetXUserMeAsync(string accessToken, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, XUsersMeUrl);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        var response = await _httpClient.SendAsync(req, ct);
        var json = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Users/me failed: {Status} {Body}", response.StatusCode, json);
            return null;
        }

        using var doc = JsonDocument.Parse(json);
        var data = doc.RootElement.TryGetProperty("data", out var d) ? d : (JsonElement?)null;
        if (data == null) return null;
        var id = data.Value.TryGetProperty("id", out var idProp) ? idProp.GetString() : null;
        var name = data.Value.TryGetProperty("name", out var n) ? n.GetString() : null;
        var username = data.Value.TryGetProperty("username", out var u) ? u.GetString() : null;
        var profileImageUrl = data.Value.TryGetProperty("profile_image_url", out var p) ? p.GetString() : null;
        if (string.IsNullOrEmpty(id)) return null;
        return new XUserMeResponse(id, name, username, profileImageUrl);
    }

    private static Dictionary<string, string> ParseQueryString(string? queryString)
    {
        var d = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrEmpty(queryString)) return d;
        foreach (var pair in queryString.TrimStart('?').Split('&'))
        {
            var idx = pair.IndexOf('=');
            if (idx < 0) continue;
            var key = Uri.UnescapeDataString(pair[..idx].Replace('+', ' '));
            var value = Uri.UnescapeDataString(pair[(idx + 1)..].Replace('+', ' '));
            d[key] = value;
        }
        return d;
    }

    private static HttpResponseData Redirect(HttpRequestData req, string url)
    {
        var res = req.CreateResponse(HttpStatusCode.Redirect);
        res.Headers.Add("Location", url);
        return res;
    }

    private record TokenResponse(string AccessToken, string? RefreshToken, int? ExpiresIn);
    private record XUserMeResponse(string Id, string? Name, string? Username, string? ProfileImageUrl);
}
