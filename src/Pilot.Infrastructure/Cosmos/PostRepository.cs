using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Cosmos.Linq;
using Pilot.Core.Domain;
using Pilot.Core.Repositories;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Threading;
using System.Threading.Tasks;

namespace Pilot.Infrastructure.Cosmos;

public class PostRepository : IPostRepository
{
    private readonly Container _container;

    public PostRepository(CosmosContext context)
    {
        _container = context.Posts;
    }

    public async Task<Post> CreateAsync(Post post, CancellationToken cancellationToken = default)
    {
        var response = await _container.CreateItemAsync(post, new PartitionKey(post.CampaignId), cancellationToken: cancellationToken);
        return response.Resource;
    }

    public async Task<IReadOnlyList<Post>> ListAllAsync(CancellationToken cancellationToken = default)
    {
        var query = new QueryDefinition("SELECT * FROM c");

        var list = new List<Post>();
        var iterator = _container.GetItemQueryIterator<Post>(query);
        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(cancellationToken);
            list.AddRange(page);
        }
        return list;
    }

    public async Task DeleteAsync(string campaignId, string id, CancellationToken cancellationToken = default)
    {
        await _container.DeleteItemAsync<Post>(id, new PartitionKey(campaignId), cancellationToken: cancellationToken);
    }

    public async Task DeleteByCampaignIdAsync(string campaignId, CancellationToken cancellationToken = default)
    {
        // Cosmos DB supports transactional batch or just looping for partitioned data.
        // Since we are partitioned by CampaignId, we can query and delete.
        // For a more robust implementation at scale, consider Change Feed or a bulk delete SP.
        // For now, listing and deleting is safe for typical campaign sizes (<100 posts).
        var query = new QueryDefinition("SELECT c.id FROM c WHERE c.campaignId = @campaignId")
            .WithParameter("@campaignId", campaignId);

        var iterator = _container.GetItemQueryIterator<Post>(query, requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(campaignId) });
        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(cancellationToken);
            foreach (var post in page)
            {
                await _container.DeleteItemAsync<Post>(post.Id, new PartitionKey(campaignId), cancellationToken: cancellationToken);
            }
        }
    }

    public async Task<IReadOnlyList<Post>> GetByCampaignIdAsync(string campaignId, CancellationToken cancellationToken = default)
    {
        var query = new QueryDefinition("SELECT * FROM c WHERE c.campaignId = @campaignId")
            .WithParameter("@campaignId", campaignId);

        var list = new List<Post>();
        var iterator = _container.GetItemQueryIterator<Post>(query, requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(campaignId) });
        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(cancellationToken);
            list.AddRange(page);
        }
        return list;
    }

    public async Task<(IReadOnlyList<Post> Items, int Total)> GetPaginatedByCampaignIdAsync(
        string campaignId,
        int page,
        int pageSize,
        string? status = null,
        string? search = null,
        string? sortBy = null,
        string? sortOrder = "desc",
        CancellationToken cancellationToken = default)
    {
        // 1. Build filter clause
        var queryBuilder = new System.Text.StringBuilder("WHERE c.campaignId = @campaignId");
        var parameters = new List<(string Name, object Value)> { ("@campaignId", campaignId) };

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<PostStatus>(status, true, out var statusEnum))
        {
            queryBuilder.Append(" AND c.status = @status");
            parameters.Add(("@status", (int)statusEnum));
        }

        if (!string.IsNullOrEmpty(search))
        {
            queryBuilder.Append(" AND CONTAINS(LOWER(c.text), @search)");
            parameters.Add(("@search", search.ToLowerInvariant()));
        }

        var filterClause = queryBuilder.ToString();

        // 2. Get total count
        var countQueryDef = new QueryDefinition($"SELECT VALUE COUNT(1) FROM c {filterClause}");
        foreach (var p in parameters) countQueryDef.WithParameter(p.Name, p.Value);

        var countIterator = _container.GetItemQueryIterator<int>(countQueryDef, requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(campaignId) });
        int total = 0;
        if (countIterator.HasMoreResults)
        {
            var response = await countIterator.ReadNextAsync(cancellationToken);
            total = response.FirstOrDefault();
        }

        var list = await GetSortedPageAsync(
            filterClause,
            parameters,
            page,
            pageSize,
            sortBy,
            sortOrder,
            new QueryRequestOptions { PartitionKey = new PartitionKey(campaignId) },
            cancellationToken);

        return (list, total);
    }

    public async Task<(IReadOnlyList<Post> Items, int Total)> GetPaginatedByUserIdAsync(
        string userId,
        int page,
        int pageSize,
        string? status = null,
        string? search = null,
        string? sortBy = null,
        string? sortOrder = "desc",
        CancellationToken cancellationToken = default)
    {
        // 1. Build filter clause
        var queryBuilder = new System.Text.StringBuilder("WHERE c.userId = @userId");
        var parameters = new List<(string Name, object Value)> { ("@userId", userId) };

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<PostStatus>(status, true, out var statusEnum))
        {
            queryBuilder.Append(" AND c.status = @status");
            parameters.Add(("@status", (int)statusEnum));
        }

        if (!string.IsNullOrEmpty(search))
        {
            queryBuilder.Append(" AND CONTAINS(LOWER(c.text), @search)");
            parameters.Add(("@search", search.ToLowerInvariant()));
        }

        var filterClause = queryBuilder.ToString();

        // 2. Get total count
        var countQueryDef = new QueryDefinition($"SELECT VALUE COUNT(1) FROM c {filterClause}");
        foreach (var p in parameters) countQueryDef.WithParameter(p.Name, p.Value);

        var countIterator = _container.GetItemQueryIterator<int>(countQueryDef);
        int total = 0;
        if (countIterator.HasMoreResults)
        {
            var response = await countIterator.ReadNextAsync(cancellationToken);
            total = response.FirstOrDefault();
        }

        var list = await GetSortedPageAsync(
            filterClause,
            parameters,
            page,
            pageSize,
            sortBy,
            sortOrder,
            requestOptions: null,
            cancellationToken);

        return (list, total);
    }

    public async Task<Post?> GetByIdAsync(string campaignId, string id, CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _container.ReadItemAsync<Post>(id, new PartitionKey(campaignId), cancellationToken: cancellationToken);
            return response.Resource;
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task<IReadOnlyList<Post>> GetReadyToPublishAsync(DateTimeOffset upToTime, PostStatus status = PostStatus.Scheduled, CancellationToken cancellationToken = default)
    {
        // This query requires a cross-partition query since we are scanning all campaigns for ready posts.
        // For production, you might consider indexing strategies or a different partition key (like a fixed "scheduler" partition or partition by date)
        // to avoid expensive cross-partition queries if the dataset grows very large.
        var query = new QueryDefinition("SELECT * FROM c WHERE c.status = @status AND c.scheduledTime <= @time")
            .WithParameter("@status", (int)status)
            .WithParameter("@time", upToTime);

        var list = new List<Post>();
        var iterator = _container.GetItemQueryIterator<Post>(query);
        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(cancellationToken);
            list.AddRange(page);
        }
        return list;
    }

    public async Task<IReadOnlyList<Post>> GetStaleByStatusAsync(PostStatus status, DateTimeOffset updatedBefore, CancellationToken cancellationToken = default)
    {
        var query = new QueryDefinition("SELECT * FROM c WHERE c.status = @status AND IS_DEFINED(c.updatedAt) AND c.updatedAt <= @updatedBefore")
            .WithParameter("@status", (int)status)
            .WithParameter("@updatedBefore", updatedBefore);

        var list = new List<Post>();
        var iterator = _container.GetItemQueryIterator<Post>(query);
        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(cancellationToken);
            list.AddRange(page);
        }
        return list;
    }

    public async Task<Post> UpdateAsync(Post post, CancellationToken cancellationToken = default)
    {
        var response = await _container.UpsertItemAsync(post, new PartitionKey(post.CampaignId), cancellationToken: cancellationToken);
        return response.Resource;
    }

    public async Task<bool> TryTransitionStatusAsync(string campaignId, string id, PostStatus expectedStatus, PostStatus newStatus, CancellationToken cancellationToken = default)
    {
        var operations = new[]
        {
            PatchOperation.Set("/status", (int)newStatus),
            PatchOperation.Set("/updatedAt", DateTimeOffset.UtcNow)
        };

        try
        {
            await _container.PatchItemAsync<Post>(
                id,
                new PartitionKey(campaignId),
                operations,
                new PatchItemRequestOptions
                {
                    FilterPredicate = $"FROM c WHERE c.status = {(int)expectedStatus}"
                },
                cancellationToken);
            return true;
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.PreconditionFailed || ex.StatusCode == HttpStatusCode.NotFound)
        {
            return false;
        }
    }

    private async Task<IReadOnlyList<Post>> GetSortedPageAsync(
        string filterClause,
        IEnumerable<(string Name, object Value)> parameters,
        int page,
        int pageSize,
        string? sortBy,
        string? sortOrder,
        QueryRequestOptions? requestOptions,
        CancellationToken cancellationToken)
    {
        var normalizedSortBy = sortBy?.ToLowerInvariant();
        var isAscending = sortOrder?.ToLowerInvariant() == "asc";
        var offset = (page - 1) * pageSize;

        if (normalizedSortBy == "scheduledtime")
        {
            // Sorting scheduled times in-memory avoids Cosmos ordering inconsistencies for DateTimeOffset values.
            var allItemsQueryDef = new QueryDefinition($"SELECT * FROM c {filterClause}");
            foreach (var p in parameters) allItemsQueryDef.WithParameter(p.Name, p.Value);

            var allItems = await ReadPostsAsync(allItemsQueryDef, requestOptions, cancellationToken);

            var ordered = isAscending
                ? allItems.OrderBy(p => p.ScheduledTime ?? DateTimeOffset.MaxValue).ThenBy(p => p.CreatedAt)
                : allItems.OrderByDescending(p => p.ScheduledTime ?? DateTimeOffset.MinValue).ThenByDescending(p => p.CreatedAt);

            return ordered.Skip(offset).Take(pageSize).ToList();
        }

        var sortDir = isAscending ? "ASC" : "DESC";
        var itemsQueryDef = new QueryDefinition($"SELECT * FROM c {filterClause} ORDER BY c.createdAt {sortDir} OFFSET @offset LIMIT @limit")
            .WithParameter("@offset", offset)
            .WithParameter("@limit", pageSize);
        foreach (var p in parameters) itemsQueryDef.WithParameter(p.Name, p.Value);

        return await ReadPostsAsync(itemsQueryDef, requestOptions, cancellationToken);
    }

    private async Task<List<Post>> ReadPostsAsync(
        QueryDefinition query,
        QueryRequestOptions? requestOptions,
        CancellationToken cancellationToken)
    {
        var list = new List<Post>();
        var iterator = _container.GetItemQueryIterator<Post>(query, requestOptions: requestOptions);
        while (iterator.HasMoreResults)
        {
            var responsePage = await iterator.ReadNextAsync(cancellationToken);
            list.AddRange(responsePage);
        }

        return list;
    }

    public async Task<(IReadOnlyList<Post> Items, int Total)> GetPostsWithoutTextAsync(string campaignId, int page, int pageSize, PostStatus? status = null, CancellationToken cancellationToken = default)
    {
        var filterBuilder = new System.Text.StringBuilder("WHERE c.campaignId = @campaignId AND (IS_NULL(c.text) OR c.text = \"\")");
        var parameters = new List<(string Name, object Value)> { ("@campaignId", campaignId) };

        if (status.HasValue)
        {
            filterBuilder.Append(" AND c.status = @status");
            parameters.Add(("@status", (int)status.Value));
        }

        var filterClause = filterBuilder.ToString();

        // 1. Get total count
        var countQueryDef = new QueryDefinition($"SELECT VALUE COUNT(1) FROM c {filterClause}");
        foreach (var p in parameters) countQueryDef.WithParameter(p.Name, p.Value);

        var countIterator = _container.GetItemQueryIterator<int>(countQueryDef, requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(campaignId) });
        int total = 0;
        if (countIterator.HasMoreResults)
        {
            var resp = await countIterator.ReadNextAsync(cancellationToken);
            total = resp.FirstOrDefault();
        }

        // 2. Get paginated page
        var offset = (page - 1) * pageSize;
        var queryDef = new QueryDefinition($"SELECT * FROM c {filterClause} ORDER BY c.createdAt DESC OFFSET @offset LIMIT @limit")
            .WithParameter("@offset", offset)
            .WithParameter("@limit", pageSize);
        foreach (var p in parameters) queryDef.WithParameter(p.Name, p.Value);

        var list = await ReadPostsAsync(queryDef, new QueryRequestOptions { PartitionKey = new PartitionKey(campaignId) }, cancellationToken);

        return (list, total);
    }
}
