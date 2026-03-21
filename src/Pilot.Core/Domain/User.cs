namespace Pilot.Core.Domain;

/// <summary>
/// User account for login and role-based access. No self-registration; admins add users.
/// Partition key: id (or fixed partition per plan).
/// </summary>
public class User
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string AvatarSeed { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    /// <summary>Password hash (if app-managed) or null when using external IdP.</summary>
    public string? PasswordHash { get; set; }
    /// <summary>External identity provider subject/id when using OAuth/OpenID.</summary>
    public string? ExternalIdpRef { get; set; }
    public bool Disabled { get; set; }
    public bool IsDeleted { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
    public List<UserPasskey> Passkeys { get; set; } = new();
}

public class UserPasskey
{
    public string CredentialId { get; set; } = string.Empty;
    public string PublicKey { get; set; } = string.Empty;
    public string UserHandle { get; set; } = string.Empty;
    public uint SignatureCount { get; set; }
    public string CredType { get; set; } = "public-key";
    public string Label { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
}
