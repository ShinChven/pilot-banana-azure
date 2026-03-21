using Pilot.Core.Domain;

namespace Pilot.Core.Repositories;

public interface IPostAiTaskRepository
{
    Task<PostAiTask?> GetByIdAsync(string userId, string id, CancellationToken ct = default);
    Task CreateAsync(PostAiTask task, CancellationToken ct = default);
    Task UpdateAsync(PostAiTask task, CancellationToken ct = default);
    Task DeleteAsync(string userId, string id, CancellationToken ct = default);
    Task<IReadOnlyList<PostAiTask>> ListByUserIdAsync(string userId, AiTaskStatus? status = null, CancellationToken ct = default);
    Task<(IReadOnlyList<PostAiTask> Items, int Total)> GetPaginatedByUserIdAsync(string userId, int page, int pageSize, AiTaskStatus? status = null, CancellationToken ct = default);
}
