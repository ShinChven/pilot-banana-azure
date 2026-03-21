using Pilot.Core.Domain;

namespace Pilot.Core.Repositories;


public interface ICampaignRepository
{
    Task<Campaign?> GetByIdAsync(string userId, string campaignId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Campaign>> ListByUserIdAsync(string userId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Campaign>> ListByChannelLinkIdAsync(string userId, string channelLinkId, CancellationToken cancellationToken = default);
    Task<(IReadOnlyList<Campaign> Items, int Total)> ListPaginatedByUserIdAsync(string userId, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Campaign>> ListByIdsAsync(string userId, IEnumerable<string> ids, CancellationToken cancellationToken = default);
    /// <summary>Cross-partition: list campaigns by status (e.g. Active for timer trigger).</summary>
    Task<IReadOnlyList<Campaign>> ListByStatusAsync(CampaignStatus status, CancellationToken cancellationToken = default);
    Task<Campaign> CreateAsync(Campaign campaign, CancellationToken cancellationToken = default);
    Task<Campaign> UpdateAsync(Campaign campaign, CancellationToken cancellationToken = default);
    Task DeleteAsync(string userId, string campaignId, CancellationToken cancellationToken = default);
}
