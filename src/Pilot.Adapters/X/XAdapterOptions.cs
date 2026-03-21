namespace Pilot.Adapters.X;

/// <summary>
/// Configuration for the X API adapter. Base URLs are now hardcoded in code to ensure X API v2 is always used.
/// Client ID and Secret are used for token refresh.
/// </summary>
public class XAdapterOptions
{
    public const string SectionName = "XOAuth";

    /// <summary>Base URL for all X API v2 interactions (tweets and media upload).</summary>
    public const string BaseUrl = "https://api.x.com";

    /// <summary>OAuth 2.0 Client ID (consistent with XOAuth__ClientId config).</summary>
    public string ClientId { get; set; } = "";

    /// <summary>OAuth 2.0 Client Secret (consistent with XOAuth__ClientSecret config).</summary>
    public string ClientSecret { get; set; } = "";
}
