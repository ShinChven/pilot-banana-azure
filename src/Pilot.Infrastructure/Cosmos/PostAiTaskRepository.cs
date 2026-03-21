using Microsoft.Azure.Cosmos;
using Pilot.Core.Domain;
using Pilot.Core.Repositories;

namespace Pilot.Infrastructure.Cosmos;

public class PostAiTaskRepository : IPostAiTaskRepository
{
    private readonly Container _container;

    public PostAiTaskRepository(CosmosContext context)
    {
        _container = context.PostAiTasks;
    }

    public async Task<PostAiTask?> GetByIdAsync(string userId, string id, CancellationToken ct = default)
    {
        try
        {
            var response = await _container.ReadItemAsync<PostAiTask>(id, new PartitionKey(userId), cancellationToken: ct);
            return response.Resource;
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task CreateAsync(PostAiTask task, CancellationToken ct = default)
    {
        await _container.CreateItemAsync(task, new PartitionKey(task.UserId), cancellationToken: ct);
    }

    public async Task UpdateAsync(PostAiTask task, CancellationToken ct = default)
    {
        await _container.UpsertItemAsync(task, new PartitionKey(task.UserId), cancellationToken: ct);
    }

    public async Task DeleteAsync(string userId, string id, CancellationToken ct = default)
    {
        await _container.DeleteItemAsync<PostAiTask>(id, new PartitionKey(userId), cancellationToken: ct);
    }

    public async Task<IReadOnlyList<PostAiTask>> ListByUserIdAsync(string userId, AiTaskStatus? status = null, CancellationToken ct = default)
    {
        var query = new QueryDefinition("SELECT * FROM c WHERE c.userId = @userId" + (status.HasValue ? " AND c.status = @status" : ""))
            .WithParameter("@userId", userId);
            
        if (status.HasValue)
            query = query.WithParameter("@status", (int)status.Value);

        var iterator = _container.GetItemQueryIterator<PostAiTask>(query, requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(userId) });
        var results = new List<PostAiTask>();
        while (iterator.HasMoreResults)
        {
            var response = await iterator.ReadNextAsync(ct);
            results.AddRange(response);
        }
        return results;
    }

    public async Task<(IReadOnlyList<PostAiTask> Items, int Total)> GetPaginatedByUserIdAsync(string userId, int page, int pageSize, AiTaskStatus? status = null, CancellationToken ct = default)
    {
        var filter = "WHERE c.userId = @userId" + (status.HasValue ? " AND c.status = @status" : "");
        var countQuery = new QueryDefinition($"SELECT VALUE COUNT(1) FROM c {filter}")
            .WithParameter("@userId", userId);
        if (status.HasValue)
            countQuery = countQuery.WithParameter("@status", (int)status.Value);

        var countIterator = _container.GetItemQueryIterator<int>(countQuery, requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(userId) });
        int total = 0;
        if (countIterator.HasMoreResults)
        {
            var response = await countIterator.ReadNextAsync(ct);
            total = response.FirstOrDefault();
        }

        var offset = (page - 1) * pageSize;
        var itemsQuery = new QueryDefinition($"SELECT * FROM c {filter} ORDER BY c.createdAt DESC OFFSET @offset LIMIT @limit")
            .WithParameter("@userId", userId)
            .WithParameter("@offset", offset)
            .WithParameter("@limit", pageSize);
        if (status.HasValue)
            itemsQuery = itemsQuery.WithParameter("@status", (int)status.Value);

        var itemsIterator = _container.GetItemQueryIterator<PostAiTask>(itemsQuery, requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(userId) });
        var results = new List<PostAiTask>();
        while (itemsIterator.HasMoreResults)
        {
            var response = await itemsIterator.ReadNextAsync(ct);
            results.AddRange(response);
        }

        return (results, total);
    }
}
