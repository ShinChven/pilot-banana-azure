using Pilot.Core.Domain;

namespace Pilot.Core.Repositories;

public interface IChannelLinkRepository
{
    Task<ChannelLink?> GetByIdAsync(string userId, string linkId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ChannelLink>> ListByUserIdAsync(string userId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ChannelLink>> ListAllXChannelsAsync(CancellationToken cancellationToken = default);
    Task<(IReadOnlyList<ChannelLink> Items, int Total)> ListPaginatedByUserIdAsync(string userId, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<ChannelLink> CreateAsync(ChannelLink link, CancellationToken cancellationToken = default);
    Task<ChannelLink> UpdateAsync(ChannelLink link, CancellationToken cancellationToken = default);
    Task DeleteAsync(string userId, string linkId, CancellationToken cancellationToken = default);
}
