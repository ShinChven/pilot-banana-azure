# Blob storage (campaign assets)

- **Container**: `campaign-assets` (or `Blob:ContainerName`).
- **Path pattern**: `{userId}/{campaignId}/{assetId}.{ext}`.

Config: `Blob` section with `ConnectionString`, `ContainerName`.  
Container is created on first upload if it does not exist.
