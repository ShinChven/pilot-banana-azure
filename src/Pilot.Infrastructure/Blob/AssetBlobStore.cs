using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Sas;
using Microsoft.Extensions.Options;
using Pilot.Core.Repositories;

using Microsoft.Extensions.Logging;

namespace Pilot.Infrastructure.Blob;

public class AssetBlobStore : IAssetBlobStore
{
    private readonly BlobContainerClient _container;
    private readonly ILogger<AssetBlobStore> _logger;

    public AssetBlobStore(BlobServiceClient client, IOptions<BlobOptions> options, ILogger<AssetBlobStore> logger)
    {
        var name = options.Value.ContainerName;
        _container = client.GetBlobContainerClient(name);
        _logger = logger;
    }

    public async Task<string> UploadAsync(string blobPath, Stream content, string? contentType, CancellationToken cancellationToken = default)
    {
        await _container.CreateIfNotExistsAsync(publicAccessType: PublicAccessType.None, cancellationToken: cancellationToken);
        var blob = _container.GetBlobClient(blobPath);
        
        if (content.CanSeek && content.Position != 0)
        {
            content.Position = 0;
        }

        var headers = new BlobHttpHeaders();
        if (!string.IsNullOrEmpty(contentType))
            headers.ContentType = contentType;
            
        await blob.UploadAsync(content, new BlobUploadOptions { HttpHeaders = headers }, cancellationToken);
        return blob.Uri.ToString();
    }

    public async Task<IReadOnlyList<string>> ListPathsAsync(string prefix, CancellationToken cancellationToken = default)
    {
        var list = new List<string>();
        await foreach (var item in _container.GetBlobsAsync(prefix: prefix, cancellationToken: cancellationToken))
            list.Add(item.Name);
        return list;
    }

    public Task<string> GetContainerSasAsync(TimeSpan? expiry = null, CancellationToken cancellationToken = default)
    {
        if (_container.CanGenerateSasUri)
        {
            var sasBuilder = new BlobSasBuilder(BlobSasPermissions.Read, DateTimeOffset.UtcNow.Add(expiry ?? TimeSpan.FromHours(24)))
            {
                BlobContainerName = _container.Name,
                Resource = "c",
                StartsOn = DateTimeOffset.UtcNow.AddMinutes(-5)
            };
            var sasUri = _container.GenerateSasUri(sasBuilder);
            return Task.FromResult(sasUri.Query.TrimStart('?'));
        }

        _logger.LogWarning("Cannot generate container SAS for {Container}. CanGenerateSasUri is false. Check if connection string has AccountKey.", _container.Name);
        return Task.FromResult(string.Empty);
    }

    public Task<Uri> GetBlobUriAsync(string blobPath, TimeSpan? expiry = null, CancellationToken cancellationToken = default)
    {
        if (Uri.TryCreate(blobPath, UriKind.Absolute, out var uri))
        {
            if (!string.IsNullOrEmpty(uri.Query)) return Task.FromResult(uri);
        }

        string? actualBlobName = ResolveBlobName(blobPath);
        if (actualBlobName == null) // Not our container, return original absolute URI
        {
            return Task.FromResult(new Uri(blobPath));
        }
        
        var blob = _container.GetBlobClient(actualBlobName);
        
        if (blob.CanGenerateSasUri)
        {
            var sasBuilder = new BlobSasBuilder(BlobSasPermissions.Read, DateTimeOffset.UtcNow.Add(expiry ?? TimeSpan.FromHours(1)))
            {
                BlobContainerName = blob.BlobContainerName,
                BlobName = blob.Name,
                Resource = "b",
                StartsOn = DateTimeOffset.UtcNow.AddMinutes(-5)
            };
            var sasUri = blob.GenerateSasUri(sasBuilder);
            return Task.FromResult(sasUri);
        }
        
        return Task.FromResult(blob.Uri);
    }

    private string? ResolveBlobName(string blobPath)
    {
        if (Uri.TryCreate(blobPath, UriKind.Absolute, out var uri))
        {
            // If it's already signed (contains a SAS token), we return the path as is but we don't want to re-sign
            // However, this method returns the BLOB NAME.
            try
            {
                var builder = new BlobUriBuilder(uri);
                if (builder.BlobContainerName == _container.Name)
                {
                    return builder.BlobName;
                }
                return null; // Not our container
            }
            catch
            {
                return null; // Failed to parse
            }
        }
        return blobPath; // Already a relative path
    }

    public async Task DeleteAsync(string blobPath, CancellationToken cancellationToken = default)
    {
        if (Uri.TryCreate(blobPath, UriKind.Absolute, out var uri))
        {
            var builder = new BlobUriBuilder(uri);
            blobPath = builder.BlobName;
        }

        var blob = _container.GetBlobClient(blobPath);
        await blob.DeleteIfExistsAsync(DeleteSnapshotsOption.IncludeSnapshots, cancellationToken: cancellationToken);
    }

    public async Task DeleteFolderAsync(string prefix, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(prefix)) return;
        
        // Ensure prefix ends with / to avoid partial matches (e.g. "camp" matching "campaign1")
        if (!prefix.EndsWith("/")) prefix += "/";

        _logger.LogInformation("Deleting all blobs under prefix: {Prefix}", prefix);

        var blobs = _container.GetBlobsAsync(prefix: prefix, cancellationToken: cancellationToken);
        await foreach (var blob in blobs)
        {
            try
            {
                await _container.DeleteBlobIfExistsAsync(blob.Name, DeleteSnapshotsOption.IncludeSnapshots, cancellationToken: cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete blob {BlobName} during folder cleanup.", blob.Name);
            }
        }
    }
}
