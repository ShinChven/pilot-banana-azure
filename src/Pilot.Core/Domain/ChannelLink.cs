namespace Pilot.Core.Domain;

/// <summary>
/// Linked social account: platform, external id, token reference (Key Vault or encrypted).
/// Partition key: userId.
/// </summary>
public class ChannelLink
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    /// <summary>Platform identifier, e.g. <see cref="ChannelPlatform.X"/>.</summary>
    public string Platform { get; set; } = string.Empty;
    /// <summary>External account id on the platform.</summary>
    public string ExternalId { get; set; } = string.Empty;
    /// <summary>Display name from the platform.</summary>
    public string? DisplayName { get; set; }
    /// <summary>Handle or username from the platform (e.g. @username).</summary>
    public string? Username { get; set; }
    /// <summary>User-managed internal note for this linked account.</summary>
    public string? Note { get; set; }
    /// <summary>Public avatar image URL from the platform profile.</summary>
    public string? AvatarUrl { get; set; }
    /// <summary>Key Vault secret name for access/refresh tokens, or reference to stored token.</summary>
    public string? TokenSecretName { get; set; }
    /// <summary>When false, this link is not used for posting.</summary>
    public bool IsEnabled { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
}
