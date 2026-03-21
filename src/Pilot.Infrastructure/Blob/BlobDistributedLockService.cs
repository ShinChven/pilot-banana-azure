using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Specialized;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Pilot.Core.Services;

namespace Pilot.Infrastructure.Blob;

public class BlobDistributedLockService : IDistributedLockService
{
    private readonly BlobContainerClient _container;
    private readonly ILogger<BlobDistributedLockService> _logger;

    public BlobDistributedLockService(
        BlobServiceClient client, 
        IOptions<BlobOptions> options,
        ILogger<BlobDistributedLockService> logger)
    {
        // Use a dedicated container for locks or reuse the existing one, but a dedicated prefix is best.
        _container = client.GetBlobContainerClient(options.Value.ContainerName);
        _logger = logger;
    }

    public async Task<string?> AcquireLockAsync(string lockName, TimeSpan duration, CancellationToken cancellationToken = default)
    {
        try
        {
            // Ensure container exists
            await _container.CreateIfNotExistsAsync(cancellationToken: cancellationToken);

            // Create a 0-byte blob for the lock if it doesn't exist
            var blobPath = $"locks/{lockName}.lock";
            var blobClient = _container.GetBlobClient(blobPath);
            
            if (!await blobClient.ExistsAsync(cancellationToken))
            {
                try
                {
                    using var stream = new MemoryStream();
                    await blobClient.UploadAsync(stream, overwrite: false, cancellationToken);
                }
                catch (RequestFailedException ex) when (ex.ErrorCode == "BlobAlreadyExists")
                {
                    // Ignore, someone else created it
                }
            }

            var leaseClient = blobClient.GetBlobLeaseClient();
            
            // Acquire lease
            var lease = await leaseClient.AcquireAsync(duration, cancellationToken: cancellationToken);
            return lease.Value.LeaseId;
        }
        catch (RequestFailedException ex) when (ex.ErrorCode == "LeaseAlreadyPresent")
        {
            _logger.LogInformation("Lock {LockName} is already held by another process.", lockName);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to acquire lock {LockName}", lockName);
            return null;
        }
    }

    public async Task ReleaseLockAsync(string lockName, string lockToken, CancellationToken cancellationToken = default)
    {
        try
        {
            var blobPath = $"locks/{lockName}.lock";
            var blobClient = _container.GetBlobClient(blobPath);
            var leaseClient = blobClient.GetBlobLeaseClient(lockToken);

            await leaseClient.ReleaseAsync(cancellationToken: cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to release lock {LockName}", lockName);
        }
    }
}
