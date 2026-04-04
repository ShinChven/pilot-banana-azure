using Pilot.Core.Domain;

namespace Pilot.Core.Repositories;

public interface IUserAccessTokenRepository
{
    Task<UserAccessToken?> GetByIdAsync(string id, string userId, CancellationToken cancellationToken = default);
    Task<UserAccessToken?> GetByTokenHashAsync(string tokenHash, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<UserAccessToken>> ListByUserIdAsync(string userId, CancellationToken cancellationToken = default);
    Task<(IReadOnlyList<UserAccessToken> Items, int Total)> GetPaginatedByUserIdAsync(string userId, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<UserAccessToken> CreateAsync(UserAccessToken token, CancellationToken cancellationToken = default);
    Task<UserAccessToken> UpdateAsync(UserAccessToken token, CancellationToken cancellationToken = default);
    Task DeleteAsync(string id, string userId, CancellationToken cancellationToken = default);
}
