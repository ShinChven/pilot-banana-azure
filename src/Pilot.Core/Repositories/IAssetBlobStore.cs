namespace Pilot.Core.Repositories;

/// <summary>
/// Blob storage for campaign assets. Path pattern: {userId}/{campaignId}/{assetId}.{ext}.
/// </summary>
public interface IAssetBlobStore
{
    /// <summary>Upload a stream to the given blob path. Creates blob if not exists.</summary>
    Task<string> UploadAsync(string blobPath, Stream content, string? contentType, CancellationToken cancellationToken = default);

    /// <summary>List blob paths under the given prefix (e.g. userId/campaignId/).</summary>
    Task<IReadOnlyList<string>> ListPathsAsync(string prefix, CancellationToken cancellationToken = default);

    /// <summary>Get a URI for reading the blob (e.g. signed URL or direct).</summary>
    Task<Uri> GetBlobUriAsync(string blobPath, TimeSpan? expiry = null, CancellationToken cancellationToken = default);

    /// <summary>Generate a SAS token for the entire container to avoid per-blob signing overhead.</summary>
    Task<string> GetContainerSasAsync(TimeSpan? expiry = null, CancellationToken cancellationToken = default);

    /// <summary>Deletes the blob at the given path.</summary>
    Task DeleteAsync(string blobPath, CancellationToken cancellationToken = default);
}
