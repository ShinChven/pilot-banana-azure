using Microsoft.Azure.Cosmos;
using Pilot.Core.Domain;
using Pilot.Core.Repositories;
using Pilot.Core.DTOs;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Pilot.Infrastructure.Cosmos;

public class PostHistoryRepository : IPostHistoryRepository
{
    private readonly Container _container;

    public PostHistoryRepository(CosmosContext context)
    {
        _container = context.PostHistory;
    }

    public async Task<PostHistoryItem> CreateAsync(PostHistoryItem item, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(item.Id)) item.Id = Guid.NewGuid().ToString();
        var response = await _container.CreateItemAsync(item, new PartitionKey(item.CampaignId), cancellationToken: cancellationToken);
        return response.Resource;
    }

    public async Task<(IReadOnlyList<PostHistoryItem> Items, int Total)> GetPaginatedByCampaignIdAsync(string campaignId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        // 1. Get total count
        var countQuery = new QueryDefinition("SELECT VALUE COUNT(1) FROM c WHERE c.campaignId = @campaignId")
            .WithParameter("@campaignId", campaignId);

        var countIterator = _container.GetItemQueryIterator<int>(countQuery, requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(campaignId) });
        int total = 0;
        if (countIterator.HasMoreResults)
        {
            var response = await countIterator.ReadNextAsync(cancellationToken);
            total = response.FirstOrDefault();
        }

        // 2. Get paginated items
        var offset = (page - 1) * pageSize;
        var query = new QueryDefinition("SELECT * FROM c WHERE c.campaignId = @campaignId ORDER BY c.postedAt DESC OFFSET @offset LIMIT @limit")
            .WithParameter("@campaignId", campaignId)
            .WithParameter("@offset", offset)
            .WithParameter("@limit", pageSize);

        var list = new List<PostHistoryItem>();
        var iterator = _container.GetItemQueryIterator<PostHistoryItem>(query, requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(campaignId) });
        while (iterator.HasMoreResults)
        {
            var responsePage = await iterator.ReadNextAsync(cancellationToken);
            list.AddRange(responsePage);
        }

        return (list, total);
    }

    public async Task<(IReadOnlyList<PostHistoryItem> Items, int Total)> GetPaginatedByUserIdAsync(string userId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        // Cross-partition count
        var countQuery = new QueryDefinition("SELECT VALUE COUNT(1) FROM c WHERE c.userId = @userId")
            .WithParameter("@userId", userId);

        var countIterator = _container.GetItemQueryIterator<int>(countQuery);
        int total = 0;
        if (countIterator.HasMoreResults)
        {
            var response = await countIterator.ReadNextAsync(cancellationToken);
            total = response.FirstOrDefault();
        }

        var offset = (page - 1) * pageSize;
        var query = new QueryDefinition("SELECT * FROM c WHERE c.userId = @userId ORDER BY c.postedAt DESC OFFSET @offset LIMIT @limit")
            .WithParameter("@userId", userId)
            .WithParameter("@offset", offset)
            .WithParameter("@limit", pageSize);

        var list = new List<PostHistoryItem>();
        var iterator = _container.GetItemQueryIterator<PostHistoryItem>(query);
        while (iterator.HasMoreResults)
        {
            var responsePage = await iterator.ReadNextAsync(cancellationToken);
            list.AddRange(responsePage);
        }

        return (list, total);
    }

    public async Task<(IReadOnlyList<PostHistoryItem> Items, int Total)> GetPaginatedGlobalAsync(int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var countQuery = new QueryDefinition("SELECT VALUE COUNT(1) FROM c");

        var countIterator = _container.GetItemQueryIterator<int>(countQuery);
        int total = 0;
        if (countIterator.HasMoreResults)
        {
            var response = await countIterator.ReadNextAsync(cancellationToken);
            total = response.FirstOrDefault();
        }

        var offset = (page - 1) * pageSize;
        var query = new QueryDefinition("SELECT * FROM c ORDER BY c.postedAt DESC OFFSET @offset LIMIT @limit")
            .WithParameter("@offset", offset)
            .WithParameter("@limit", pageSize);

        var list = new List<PostHistoryItem>();
        var iterator = _container.GetItemQueryIterator<PostHistoryItem>(query);
        while (iterator.HasMoreResults)
        {
            var responsePage = await iterator.ReadNextAsync(cancellationToken);
            list.AddRange(responsePage);
        }

        return (list, total);
    }

    public async Task<IEnumerable<PostCountByDate>> GetPostCountsByDateAsync(string userId, DateTimeOffset since, CancellationToken cancellationToken = default)
    {
        var query = new QueryDefinition(@"
            SELECT c.date, c.count FROM (
                SELECT SUBSTRING(c.postedAt, 0, 10) as date, COUNT(1) as count
                FROM c
                WHERE c.userId = @userId AND c.postedAt >= @since AND c.status = 'Completed'
                GROUP BY SUBSTRING(c.postedAt, 0, 10)
            ) c")
            .WithParameter("@userId", userId)
            .WithParameter("@since", since.ToString("O"));

        var iterator = _container.GetItemQueryIterator<PostCountByDate>(query);
        var result = new List<PostCountByDate>();
        while (iterator.HasMoreResults)
        {
            var response = await iterator.ReadNextAsync(cancellationToken);
            result.AddRange(response);
        }
        return result.OrderBy(r => r.Date);
    }

    public async Task<IReadOnlyDictionary<string, string>> GetLatestPostUrlsByPostIdsAsync(IEnumerable<string> postIds, CancellationToken cancellationToken = default)
    {
        if (postIds == null || !postIds.Any()) return new Dictionary<string, string>();

        var query = new QueryDefinition(@"
            SELECT c.postId, c.postUrl
            FROM c
            WHERE ARRAY_CONTAINS(@postIds, c.postId) AND c.status = 'Completed' AND IS_DEFINED(c.postUrl)")
            .WithParameter("@postIds", postIds.ToArray());

        var iterator = _container.GetItemQueryIterator<PostUrlResult>(query);
        var result = new Dictionary<string, string>();
        while (iterator.HasMoreResults)
        {
            var response = await iterator.ReadNextAsync(cancellationToken);
            foreach (var item in response)
            {
                if (!string.IsNullOrEmpty(item.PostUrl) && !result.ContainsKey(item.PostId))
                {
                    result[item.PostId] = item.PostUrl;
                }
            }
        }
        return result;
    }

    private class PostUrlResult
    {
        public string PostId { get; set; } = string.Empty;
        public string PostUrl { get; set; } = string.Empty;
    }
}
