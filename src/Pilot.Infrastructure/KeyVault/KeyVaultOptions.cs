namespace Pilot.Infrastructure.KeyVault;

public class KeyVaultOptions
{
    public const string SectionName = "KeyVault";

    /// <summary>Key Vault URI, e.g. https://my-vault.vault.azure.net/</summary>
    public string VaultUri { get; set; } = string.Empty;

    /// <summary>If set, use client secret instead of DefaultAzureCredential (e.g. for local dev).</summary>
    public string? TenantId { get; set; }
    public string? ClientId { get; set; }
    public string? ClientSecret { get; set; }
}
