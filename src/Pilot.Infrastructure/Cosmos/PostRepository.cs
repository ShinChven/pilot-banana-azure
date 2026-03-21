using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Cosmos.Linq;
using Pilot.Core.Domain;
using Pilot.Core.Repositories;
using System.Collections.Generic;
using System.Linq;
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

        // 3. Get paginated items
        var offset = (page - 1) * pageSize;
        var itemsQueryDef = new QueryDefinition($"SELECT * FROM c {filterClause} ORDER BY c.createdAt DESC OFFSET @offset LIMIT @limit")
            .WithParameter("@offset", offset)
            .WithParameter("@limit", pageSize);
        foreach (var p in parameters) itemsQueryDef.WithParameter(p.Name, p.Value);

        var list = new List<Post>();
        var iterator = _container.GetItemQueryIterator<Post>(itemsQueryDef, requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(campaignId) });
        while (iterator.HasMoreResults)
        {
            var responsePage = await iterator.ReadNextAsync(cancellationToken);
            list.AddRange(responsePage);
        }

        return (list, total);
    }

    public async Task<(IReadOnlyList<Post> Items, int Total)> GetPaginatedByUserIdAsync(
        string userId,
        int page,
        int pageSize,
        string? status = null,
        string? search = null,
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

        // 3. Get paginated items
        var offset = (page - 1) * pageSize;
        var itemsQueryDef = new QueryDefinition($"SELECT * FROM c {filterClause} ORDER BY c.createdAt DESC OFFSET @offset LIMIT @limit")
            .WithParameter("@offset", offset)
            .WithParameter("@limit", pageSize);
        foreach (var p in parameters) itemsQueryDef.WithParameter(p.Name, p.Value);

        var list = new List<Post>();
        var iterator = _container.GetItemQueryIterator<Post>(itemsQueryDef);
        while (iterator.HasMoreResults)
        {
            var responsePage = await iterator.ReadNextAsync(cancellationToken);
            list.AddRange(responsePage);
        }

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

    public async Task<Post> UpdateAsync(Post post, CancellationToken cancellationToken = default)
    {
        var response = await _container.UpsertItemAsync(post, new PartitionKey(post.CampaignId), cancellationToken: cancellationToken);
        return response.Resource;
    }
}
