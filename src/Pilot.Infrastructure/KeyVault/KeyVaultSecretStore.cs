using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
using Microsoft.Extensions.Options;
using Pilot.Core.Services;

namespace Pilot.Infrastructure.KeyVault;

public class KeyVaultSecretStore : ISecretStore
{
    private readonly SecretClient _client;

    public KeyVaultSecretStore(SecretClient client)
    {
        _client = client;
    }

    public async Task<string?> GetSecretAsync(string secretName, CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _client.GetSecretAsync(secretName, cancellationToken: cancellationToken);
            return response.Value?.Value;
        }
        catch (Azure.RequestFailedException ex) when (ex.Status == 404)
        {
            return null;
        }
    }

    public async Task SetSecretAsync(string secretName, string value, CancellationToken cancellationToken = default)
    {
        await _client.SetSecretAsync(secretName, value, cancellationToken);
    }

    public async Task DeleteSecretAsync(string secretName, CancellationToken cancellationToken = default)
    {
        try
        {
            await _client.StartDeleteSecretAsync(secretName, cancellationToken);
        }
        catch (Azure.RequestFailedException ex) when (ex.Status == 404)
        {
            // Already gone
        }
    }
}
