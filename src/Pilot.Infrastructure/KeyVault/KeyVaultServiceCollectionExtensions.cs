using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Pilot.Core.Services;

namespace Pilot.Infrastructure.KeyVault;

public static class KeyVaultServiceCollectionExtensions
{
    /// <summary>
    /// Registers Key Vault options and ISecretStore. Uses DefaultAzureCredential when TenantId/ClientId/ClientSecret are not set.
    /// </summary>
    public static IServiceCollection AddPilotKeyVault(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<KeyVaultOptions>(configuration.GetSection(KeyVaultOptions.SectionName));

        services.AddSingleton<ISecretStore>(sp =>
        {
            var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<KeyVaultOptions>>().Value;
            if (string.IsNullOrWhiteSpace(options.VaultUri))
                return new LocalFileSecretStore();

            var uri = new Uri(options.VaultUri.TrimEnd('/') + "/");
            SecretClient client;
            if (!string.IsNullOrEmpty(options.TenantId) && !string.IsNullOrEmpty(options.ClientId) && !string.IsNullOrEmpty(options.ClientSecret))
            {
                var credential = new ClientSecretCredential(options.TenantId, options.ClientId, options.ClientSecret);
                client = new SecretClient(uri, credential);
            }
            else
            {
                client = new SecretClient(uri, new DefaultAzureCredential());
            }
            return new KeyVaultSecretStore(client);
        });
        return services;
    }
}
