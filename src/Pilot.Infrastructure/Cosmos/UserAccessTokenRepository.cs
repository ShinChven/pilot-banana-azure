using Microsoft.Azure.Cosmos;
using Pilot.Core.Domain;
using Pilot.Core.Repositories;

namespace Pilot.Infrastructure.Cosmos;

public class UserAccessTokenRepository : IUserAccessTokenRepository
{
    private readonly Container _container;

    public UserAccessTokenRepository(CosmosContext context)
    {
        _container = context.UserAccessTokens;
    }

    public async Task<UserAccessToken?> GetByIdAsync(string id, string userId, CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _container.ReadItemAsync<UserAccessToken>(id, new PartitionKey(userId), cancellationToken: cancellationToken);
            return response.Resource;
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task<UserAccessToken?> GetByTokenHashAsync(string tokenHash, CancellationToken cancellationToken = default)
    {
        var query = new QueryDefinition("SELECT * FROM c WHERE c.tokenHash = @tokenHash AND c.isRevoked = false")
            .WithParameter("@tokenHash", tokenHash);
        var iterator = _container.GetItemQueryIterator<UserAccessToken>(query);
        if (!iterator.HasMoreResults)
            return null;
        var page = await iterator.ReadNextAsync(cancellationToken);
        return page.FirstOrDefault();
    }

    public async Task<IReadOnlyList<UserAccessToken>> ListByUserIdAsync(string userId, CancellationToken cancellationToken = default)
    {
        var query = new QueryDefinition("SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC")
            .WithParameter("@userId", userId);
        var list = new List<UserAccessToken>();
        var iterator = _container.GetItemQueryIterator<UserAccessToken>(query, requestOptions: new QueryRequestOptions
        {
            PartitionKey = new PartitionKey(userId)
        });
        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(cancellationToken);
            list.AddRange(page);
        }
        return list;
    }
    
    public async Task<(IReadOnlyList<UserAccessToken> Items, int Total)> GetPaginatedByUserIdAsync(string userId, int page, int pageSize, CancellationToken cancellationToken = default)
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
        var itemsQuery = new QueryDefinition("SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC OFFSET @offset LIMIT @limit")
            .WithParameter("@userId", userId)
            .WithParameter("@offset", offset)
            .WithParameter("@limit", pageSize);
        var itemsIterator = _container.GetItemQueryIterator<UserAccessToken>(itemsQuery, requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(userId) });
        var results = new List<UserAccessToken>();
        while (itemsIterator.HasMoreResults)
        {
            var response = await itemsIterator.ReadNextAsync(cancellationToken);
            results.AddRange(response);
        }

        return (results, total);
    }

    public async Task<UserAccessToken> CreateAsync(UserAccessToken token, CancellationToken cancellationToken = default)
    {
        var response = await _container.CreateItemAsync(token, new PartitionKey(token.UserId), cancellationToken: cancellationToken);
        return response.Resource;
    }

    public async Task<UserAccessToken> UpdateAsync(UserAccessToken token, CancellationToken cancellationToken = default)
    {
        var response = await _container.UpsertItemAsync(token, new PartitionKey(token.UserId), cancellationToken: cancellationToken);
        return response.Resource;
    }

    public async Task DeleteAsync(string id, string userId, CancellationToken cancellationToken = default)
    {
        await _container.DeleteItemAsync<UserAccessToken>(id, new PartitionKey(userId), cancellationToken: cancellationToken);
    }
}
