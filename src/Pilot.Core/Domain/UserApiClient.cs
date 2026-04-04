namespace Pilot.Core.Domain;

/// <summary>
/// API credentials for a user (Client ID + Client Secret).
/// Used for machine-to-machine access (e.g. MCP).
/// Partition key: userId.
/// </summary>
public class UserApiClient
{
    public string Id { get; set; } = string.Empty; // ClientId
    public string UserId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    /// <summary>Authorized callback URL (e.g. Claude callback).</summary>
    public string RedirectUri { get; set; } = string.Empty;
    /// <summary>SHA-256 hash of the client secret. Null for dynamic public clients.</summary>
    public string? SecretHash { get; set; }
    /// <summary>True if created via RFC 7591 dynamic client registration.</summary>
    public bool IsDynamic { get; set; }
    /// <summary>Optional source label from dynamic registration (e.g. "Claude Desktop").</summary>
    public string? RegistrationSource { get; set; }
    /// <summary>Source IP captured at registration time for abuse controls.</summary>
    public string? RegistrationIp { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? LastUsedAt { get; set; }
    public bool IsRevoked { get; set; }
}
