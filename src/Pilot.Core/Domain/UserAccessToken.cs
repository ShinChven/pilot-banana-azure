namespace Pilot.Core.Domain;

/// <summary>
/// Personal access token created by a user for API access.
/// Partition key: userId.
/// </summary>
public class UserAccessToken
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    /// <summary>SHA-256 hash of the token value. The plain token is only shown once at creation.</summary>
    public string TokenHash { get; set; } = string.Empty;
    /// <summary>First 8 characters of the token for identification (e.g. "pat_abc1...").</summary>
    public string Prefix { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }
    public DateTimeOffset? LastUsedAt { get; set; }
    public bool IsRevoked { get; set; }
}
