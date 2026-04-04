using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Pilot.Api.Options;
using Pilot.Api.Services;
using Pilot.Core.Domain;

namespace Pilot.Api.Functions;

/// <summary>
/// Returns the X OAuth 2.0 authorization URL (x.com, with PKCE and state). When XOAuth is not configured, returns a placeholder message.
/// </summary>
public class ChannelsConnectFunction
{
    private readonly RequestAuthHelper _authHelper;
    private readonly XOAuthStateService _stateService;
    private readonly XOAuthOptions _options;
    private readonly ILogger _logger;

    private const string XAuthorizeUrl = "https://x.com/i/oauth2/authorize";
    private static readonly string[] Scopes = new[]
    {
        "tweet.read",
        "tweet.write",
        "users.read",
        "media.write",
        "offline.access"
    };

    public ChannelsConnectFunction(
        RequestAuthHelper authHelper,
        XOAuthStateService stateService,
        IOptions<XOAuthOptions> options,
        ILoggerFactory loggerFactory)
    {
        _authHelper = authHelper;
        _stateService = stateService;
        _options = options.Value;
        _logger = loggerFactory.CreateLogger<ChannelsConnectFunction>();
    }

    [Function("ChannelsConnect")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "api/channels/connect/{platform}")] HttpRequestData req,
        string platform,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null)
        {
            var unauth = req.CreateResponse(HttpStatusCode.Unauthorized);
            await unauth.WriteAsJsonAsync(new { error = "Authorization required." }, cancellationToken);
            return unauth;
        }

        if (string.IsNullOrEmpty(platform) || !string.Equals(platform, ChannelPlatform.X, StringComparison.OrdinalIgnoreCase))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Supported platform: x (Twitter)." }, cancellationToken);
            return bad;
        }

        var missing = new List<string>();
        if (string.IsNullOrWhiteSpace(_options.ClientId)) missing.Add("XOAuth__ClientId");
        if (string.IsNullOrWhiteSpace(_options.ApiBaseUrl)) missing.Add("XOAuth__ApiBaseUrl");
        if (missing.Count > 0)
        {
            _logger.LogInformation("XOAuth not configured: missing {Missing}. Ensure local.settings.json Values (or app settings) are loaded.", string.Join(", ", missing));
            var placeholder = req.CreateResponse(HttpStatusCode.ServiceUnavailable);
            await placeholder.WriteAsJsonAsync(new
            {
                platform = "x",
                authUrl = (string?)null,
                message = "Connect X is not configured. Set in API: " + string.Join(", ", missing) + ". Also set XOAuth__ClientSecret and XOAuth__DashboardBaseUrl. Restart the API after changing local.settings.json."
            }, cancellationToken);
            return placeholder;
        }

        var redirectUri = _options.ApiBaseUrl.TrimEnd('/') + "/api/channels/callback/x";
        var codeVerifier = PkceHelper.GenerateCodeVerifier();
        var codeChallenge = PkceHelper.ComputeCodeChallengeS256(codeVerifier);
        var state = _stateService.CreateState(auth.Value.UserId, codeVerifier);

        var scopeString = string.Join(" ", Scopes);

        var query = new List<string>
        {
            "response_type=code",
            "client_id=" + Uri.EscapeDataString(_options.ClientId),
            "redirect_uri=" + Uri.EscapeDataString(redirectUri),
            "scope=" + Uri.EscapeDataString(scopeString),
            "state=" + Uri.EscapeDataString(state),
            "code_challenge=" + Uri.EscapeDataString(codeChallenge),
            "code_challenge_method=S256"
        };
        var authUrl = XAuthorizeUrl + "?" + string.Join("&", query);

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new { platform = "x", authUrl, state }, cancellationToken);
        return response;
    }
}
