namespace Pilot.Core.Services;

/// <summary>
/// Store and retrieve secrets (e.g. OAuth tokens, API keys). Backed by Azure Key Vault in production.
/// </summary>
public interface ISecretStore
{
    /// <summary>Get secret value by name. Returns null if not found.</summary>
    Task<string?> GetSecretAsync(string secretName, CancellationToken cancellationToken = default);

    /// <summary>Set or overwrite a secret value.</summary>
    Task SetSecretAsync(string secretName, string value, CancellationToken cancellationToken = default);

    /// <summary>Delete a secret value by name.</summary>
    Task DeleteSecretAsync(string secretName, CancellationToken cancellationToken = default);
}
