using Pilot.Core.Domain;
using Pilot.Core.DTOs;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Pilot.Core.Repositories;

public interface IPostHistoryRepository
{
    Task<PostHistoryItem> CreateAsync(PostHistoryItem item, CancellationToken cancellationToken = default);
    Task<(IReadOnlyList<PostHistoryItem> Items, int Total)> GetPaginatedByCampaignIdAsync(string campaignId, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<(IReadOnlyList<PostHistoryItem> Items, int Total)> GetPaginatedByUserIdAsync(string userId, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<(IReadOnlyList<PostHistoryItem> Items, int Total)> GetPaginatedGlobalAsync(int page, int pageSize, CancellationToken cancellationToken = default);
    Task<IEnumerable<PostCountByDate>> GetPostCountsByDateAsync(string userId, DateTimeOffset since, int timezoneOffsetMinutes, CancellationToken cancellationToken = default);
    Task<IReadOnlyDictionary<string, string>> GetLatestPostUrlsByPostIdsAsync(IEnumerable<string> postIds, CancellationToken cancellationToken = default);
}
