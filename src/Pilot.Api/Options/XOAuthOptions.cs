namespace Pilot.Api.Options;

/// <summary>
/// X (Twitter) OAuth 2.0 settings. Set in config (e.g. XOAuth section); do not commit secrets.
/// </summary>
public class XOAuthOptions
{
    public const string SectionName = "XOAuth";

    public string ClientId { get; set; } = "";
    public string ClientSecret { get; set; } = "";
    /// <summary>Base URL for the API (e.g. https://your-api.azurewebsites.net or http://localhost:7071). Used to build redirect_uri.</summary>
    public string ApiBaseUrl { get; set; } = "";
    /// <summary>Optional: secret to sign OAuth state (defaults to Auth:Jwt:Secret if empty).</summary>
    public string StateSigningSecret { get; set; } = "";
    /// <summary>Where to redirect after OAuth (e.g. https://your-app.azurestaticapps.net or http://localhost:5173).</summary>
    public string DashboardBaseUrl { get; set; } = "http://localhost:5173";
}
