namespace Pilot.Core.Domain;

/// <summary>
/// Temporary authorization code for OAuth2 flow.
/// Code is single-use and short-lived.
/// Partition key: code.
/// </summary>
public class OAuthAuthorizationCode
{
    public string Id { get; set; } = string.Empty; // The code itself
    public string ClientId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = string.Empty;
    public string? State { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public bool IsUsed { get; set; }
    /// <summary>PKCE code_challenge (S256 hash, base64url-encoded).</summary>
    public string? CodeChallenge { get; set; }
    /// <summary>PKCE code_challenge_method, typically "S256".</summary>
    public string? CodeChallengeMethod { get; set; }
}
