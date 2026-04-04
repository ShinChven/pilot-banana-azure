using Pilot.Core.Domain;

namespace Pilot.Core.Repositories;

public interface IUserApiClientRepository
{
    Task<UserApiClient?> GetByIdAsync(string clientId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<UserApiClient>> ListByUserIdAsync(string userId, CancellationToken cancellationToken = default);
    Task<(IReadOnlyList<UserApiClient> Items, int Total)> GetPaginatedByUserIdAsync(string userId, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<int> CountDynamicCreatedSinceAsync(DateTimeOffset since, CancellationToken cancellationToken = default);
    Task<int> CountDynamicCreatedSinceByIpAsync(string registrationIp, DateTimeOffset since, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<UserApiClient>> ListStaleDynamicUnlinkedAsync(DateTimeOffset createdBefore, int limit, CancellationToken cancellationToken = default);
    Task<UserApiClient> ReassignUserAsync(UserApiClient client, string newUserId, CancellationToken cancellationToken = default);
    Task<UserApiClient> CreateAsync(UserApiClient client, CancellationToken cancellationToken = default);
    Task<UserApiClient> UpdateAsync(UserApiClient client, CancellationToken cancellationToken = default);
    Task DeleteAsync(string userId, string clientId, CancellationToken cancellationToken = default);
}
