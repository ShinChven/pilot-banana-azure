using Pilot.Core.Services;

namespace Pilot.Infrastructure.KeyVault;

/// <summary>
/// No-op implementation when Key Vault is not configured (e.g. local dev). Get returns null; Set does nothing.
/// </summary>
public class NoOpSecretStore : ISecretStore
{
    public Task<string?> GetSecretAsync(string secretName, CancellationToken cancellationToken = default)
        => Task.FromResult<string?>(null);

    public Task SetSecretAsync(string secretName, string value, CancellationToken cancellationToken = default)
        => Task.CompletedTask;

    public Task DeleteSecretAsync(string secretName, CancellationToken cancellationToken = default)
        => Task.CompletedTask;
}
