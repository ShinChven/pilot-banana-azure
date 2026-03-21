using System.Text.Json.Serialization;

namespace Pilot.Core.Adapters;

/// <summary>
/// Container for OAuth 2.0 tokens.
/// </summary>
public class TokenData
{
    [JsonPropertyName("access_token")]
    public string AccessToken { get; set; } = "";

    [JsonPropertyName("refresh_token")]
    public string? RefreshToken { get; set; }

    /// <summary>
    /// Optional: when the token expires (if returned by platform).
    /// </summary>
    [JsonPropertyName("expires_at")]
    public DateTimeOffset? ExpiresAt { get; set; }

    /// <summary>
    /// Optional: seconds until the token expires (returned by X/Twitter and others).
    /// </summary>
    [JsonPropertyName("expires_in")]
    public int? ExpiresIn { get; set; }
}
