# Key Vault

- **Purpose:** Store OAuth tokens and API keys (e.g. X/Twitter). No secrets in code or config.
- **Access:** Managed Identity in Azure; for local dev set `KeyVault:VaultUri` and use `DefaultAzureCredential` (Azure CLI login) or TenantId/ClientId/ClientSecret.
- **Optional:** If `VaultUri` is empty, `ISecretStore` is a no-op (get returns null, set does nothing) so the app runs without Key Vault.

Config: `KeyVault` section with `VaultUri`, and optionally `TenantId`, `ClientId`, `ClientSecret`.
