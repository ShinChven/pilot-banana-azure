namespace Pilot.Core.Services;

public interface IDistributedLockService
{
    /// <summary>
    /// Attempts to acquire a distributed lock. 
    /// </summary>
    /// <param name="lockName">The unique name/key for the lock.</param>
    /// <param name="duration">The duration of the lock (must be between 15 and 60 seconds for Azure Blob Leases).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A lock token if acquired, or null if the lock is already held by someone else.</returns>
    Task<string?> AcquireLockAsync(string lockName, TimeSpan duration, CancellationToken cancellationToken = default);

    /// <summary>
    /// Releases a previously acquired lock using its token.
    /// </summary>
    Task ReleaseLockAsync(string lockName, string lockToken, CancellationToken cancellationToken = default);
}
