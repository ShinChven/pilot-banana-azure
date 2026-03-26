using Pilot.Core.Domain;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Pilot.Core.Repositories;

public interface IPostRepository
{
    Task<Post> CreateAsync(Post post, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Post>> ListAllAsync(CancellationToken cancellationToken = default);
    Task<Post?> GetByIdAsync(string campaignId, string id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Post>> GetByCampaignIdAsync(string campaignId, CancellationToken cancellationToken = default);
    Task<(IReadOnlyList<Post> Items, int Total)> GetPaginatedByCampaignIdAsync(string campaignId, int page, int pageSize, string? status = null, string? search = null, string? sortBy = null, string? sortOrder = "desc", CancellationToken cancellationToken = default);
    Task<(IReadOnlyList<Post> Items, int Total)> GetPaginatedByUserIdAsync(string userId, int page, int pageSize, string? status = null, string? search = null, string? sortBy = null, string? sortOrder = "desc", CancellationToken cancellationToken = default);
    Task<Post> UpdateAsync(Post post, CancellationToken cancellationToken = default);
    Task<bool> TryTransitionStatusAsync(string campaignId, string id, PostStatus expectedStatus, PostStatus newStatus, CancellationToken cancellationToken = default);
    Task DeleteAsync(string campaignId, string id, CancellationToken cancellationToken = default);
    Task DeleteByCampaignIdAsync(string campaignId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets all posts where ScheduledTime is less than or equal to the provided time and Status is equal to the given status (usually Scheduled).
    /// </summary>
    Task<IReadOnlyList<Post>> GetReadyToPublishAsync(DateTimeOffset upToTime, PostStatus status = PostStatus.Scheduled, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Post>> GetStaleByStatusAsync(PostStatus status, DateTimeOffset updatedBefore, CancellationToken cancellationToken = default);
}
