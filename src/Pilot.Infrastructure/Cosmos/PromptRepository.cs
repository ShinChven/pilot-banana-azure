using Microsoft.Azure.Cosmos;
using Pilot.Core.Domain;
using Pilot.Core.Repositories;

namespace Pilot.Infrastructure.Cosmos;

public class PromptRepository : IPromptRepository
{
    private readonly Container _container;

    public PromptRepository(CosmosContext context)
    {
        _container = context.Prompts;
    }

    public async Task<Prompt?> GetByIdAsync(string userId, string promptId, CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _container.ReadItemAsync<Prompt>(promptId, new PartitionKey(userId), cancellationToken: cancellationToken);
            return response.Resource;
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task<IReadOnlyList<Prompt>> ListByUserIdAsync(string userId, CancellationToken cancellationToken = default)
    {
        var query = new QueryDefinition("SELECT * FROM c WHERE c.userId = @userId")
            .WithParameter("@userId", userId);
        var list = new List<Prompt>();
        var iterator = _container.GetItemQueryIterator<Prompt>(query, requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(userId) });
        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(cancellationToken);
            list.AddRange(page);
        }
        return list;
    }

    public async Task<(IReadOnlyList<Prompt> Items, int Total)> ListPaginatedByUserIdAsync(string userId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var countQuery = new QueryDefinition("SELECT VALUE COUNT(1) FROM c WHERE c.userId = @userId")
            .WithParameter("@userId", userId);

        var countIterator = _container.GetItemQueryIterator<int>(countQuery, requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(userId) });
        int total = 0;
        if (countIterator.HasMoreResults)
        {
            var response = await countIterator.ReadNextAsync(cancellationToken);
            total = response.FirstOrDefault();
        }

        var offset = (page - 1) * pageSize;
        var query = new QueryDefinition("SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC OFFSET @offset LIMIT @limit")
            .WithParameter("@userId", userId)
            .WithParameter("@offset", offset)
            .WithParameter("@limit", pageSize);

        var list = new List<Prompt>();
        var iterator = _container.GetItemQueryIterator<Prompt>(query, requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(userId) });
        while (iterator.HasMoreResults)
        {
            var responsePage = await iterator.ReadNextAsync(cancellationToken);
            list.AddRange(responsePage);
        }

        return (list, total);
    }

    public async Task<Prompt> CreateAsync(Prompt prompt, CancellationToken cancellationToken = default)
    {
        var response = await _container.CreateItemAsync(prompt, new PartitionKey(prompt.UserId), cancellationToken: cancellationToken);
        return response.Resource;
    }

    public async Task<Prompt> UpdateAsync(Prompt prompt, CancellationToken cancellationToken = default)
    {
        var response = await _container.UpsertItemAsync(prompt, new PartitionKey(prompt.UserId), cancellationToken: cancellationToken);
        return response.Resource;
    }

    public async Task DeleteAsync(string userId, string promptId, CancellationToken cancellationToken = default)
    {
        await _container.DeleteItemAsync<Prompt>(promptId, new PartitionKey(userId), cancellationToken: cancellationToken);
    }
}
