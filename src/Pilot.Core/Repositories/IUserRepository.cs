using Pilot.Core.Domain;

namespace Pilot.Core.Repositories;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<User>> ListAllAsync(CancellationToken cancellationToken = default);
    Task<(IReadOnlyList<User> Items, int Total)> ListPaginatedAllAsync(int page, int pageSize, CancellationToken cancellationToken = default);
    Task<User> CreateAsync(User user, CancellationToken cancellationToken = default);
    Task<User> UpdateAsync(User user, CancellationToken cancellationToken = default);
}
