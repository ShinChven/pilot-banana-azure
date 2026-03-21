using Pilot.Core.Domain;

namespace Pilot.Core.Repositories;

public interface IPromptRepository
{
    Task<Prompt?> GetByIdAsync(string userId, string promptId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Prompt>> ListByUserIdAsync(string userId, CancellationToken cancellationToken = default);
    Task<(IReadOnlyList<Prompt> Items, int Total)> ListPaginatedByUserIdAsync(string userId, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<Prompt> CreateAsync(Prompt prompt, CancellationToken cancellationToken = default);
    Task<Prompt> UpdateAsync(Prompt prompt, CancellationToken cancellationToken = default);
    Task DeleteAsync(string userId, string promptId, CancellationToken cancellationToken = default);
}
