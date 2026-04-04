using Microsoft.Azure.Cosmos;
using Pilot.Core.Domain;
using Pilot.Core.Repositories;

namespace Pilot.Infrastructure.Cosmos;

public class UserApiClientRepository : IUserApiClientRepository
{
    private readonly Container _container;

    public UserApiClientRepository(CosmosContext context)
    {
        _container = context.UserApiClients;
    }

    public async Task<UserApiClient?> GetByIdAsync(string clientId, CancellationToken cancellationToken = default)
    {
        var query = new QueryDefinition("SELECT * FROM c WHERE c.id = @clientId")
            .WithParameter("@clientId", clientId);
        
        // Since id is the unique key, we search across partitions if we don't know the userId.
        // Usually, clientId itself might contain encoded userId or we just search.
        var iterator = _container.GetItemQueryIterator<UserApiClient>(query);
        if (iterator.HasMoreResults)
        {
            var response = await iterator.ReadNextAsync(cancellationToken);
            return response.FirstOrDefault();
        }
        return null;
    }

    public async Task<IReadOnlyList<UserApiClient>> ListByUserIdAsync(string userId, CancellationToken cancellationToken = default)
    {
        var query = new QueryDefinition("SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC")
            .WithParameter("@userId", userId);
        
        var iterator = _container.GetItemQueryIterator<UserApiClient>(query, requestOptions: new QueryRequestOptions
        {
            PartitionKey = new PartitionKey(userId)
        });

        var results = new List<UserApiClient>();
        while (iterator.HasMoreResults)
        {
            var response = await iterator.ReadNextAsync(cancellationToken);
            results.AddRange(response);
        }
        return results;
    }

    public async Task<(IReadOnlyList<UserApiClient> Items, int Total)> GetPaginatedByUserIdAsync(string userId, int page, int pageSize, CancellationToken cancellationToken = default)
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
        var itemsIterator = _container.GetItemQueryIterator<UserApiClient>(itemsQuery, requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(userId) });
        var results = new List<UserApiClient>();
        while (itemsIterator.HasMoreResults)
        {
            var response = await itemsIterator.ReadNextAsync(cancellationToken);
            results.AddRange(response);
        }

        return (results, total);
    }

    public async Task<int> CountDynamicCreatedSinceAsync(DateTimeOffset since, CancellationToken cancellationToken = default)
    {
        var query = new QueryDefinition("SELECT VALUE COUNT(1) FROM c WHERE c.isDynamic = true AND c.createdAt >= @since")
            .WithParameter("@since", since);
        return await ReadCountAsync(query, cancellationToken);
    }

    public async Task<int> CountDynamicCreatedSinceByIpAsync(string registrationIp, DateTimeOffset since, CancellationToken cancellationToken = default)
    {
        var query = new QueryDefinition("SELECT VALUE COUNT(1) FROM c WHERE c.isDynamic = true AND c.createdAt >= @since AND c.registrationIp = @registrationIp")
            .WithParameter("@since", since)
            .WithParameter("@registrationIp", registrationIp);
        return await ReadCountAsync(query, cancellationToken);
    }

    public async Task<IReadOnlyList<UserApiClient>> ListStaleDynamicUnlinkedAsync(DateTimeOffset createdBefore, int limit, CancellationToken cancellationToken = default)
    {
        var query = new QueryDefinition(
                "SELECT TOP @limit * FROM c WHERE c.isDynamic = true AND c.userId = @dynamicUserId AND c.createdAt < @createdBefore AND (NOT IS_DEFINED(c.lastUsedAt) OR IS_NULL(c.lastUsedAt)) ORDER BY c.createdAt ASC")
            .WithParameter("@limit", limit)
            .WithParameter("@dynamicUserId", "dynamic")
            .WithParameter("@createdBefore", createdBefore);

        var iterator = _container.GetItemQueryIterator<UserApiClient>(query);
        if (!iterator.HasMoreResults)
            return [];

        var page = await iterator.ReadNextAsync(cancellationToken);
        return page.ToList();
    }

    public async Task<UserApiClient> ReassignUserAsync(UserApiClient client, string newUserId, CancellationToken cancellationToken = default)
    {
        if (client.UserId == newUserId)
            return client;

        var oldUserId = client.UserId;
        var reassigned = new UserApiClient
        {
            Id = client.Id,
            UserId = newUserId,
            Name = client.Name,
            RedirectUri = client.RedirectUri,
            SecretHash = client.SecretHash,
            IsDynamic = client.IsDynamic,
            RegistrationSource = client.RegistrationSource,
            RegistrationIp = client.RegistrationIp,
            CreatedAt = client.CreatedAt,
            LastUsedAt = client.LastUsedAt,
            IsRevoked = client.IsRevoked
        };

        try
        {
            await _container.CreateItemAsync(reassigned, new PartitionKey(newUserId), cancellationToken: cancellationToken);
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.Conflict)
        {
            // If another request already linked the client to this user, treat as success.
        }

        try
        {
            await _container.DeleteItemAsync<UserApiClient>(client.Id, new PartitionKey(oldUserId), cancellationToken: cancellationToken);
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            // Already moved by another request.
        }

        return reassigned;
    }

    public async Task<UserApiClient> CreateAsync(UserApiClient client, CancellationToken cancellationToken = default)
    {
        var response = await _container.CreateItemAsync(client, new PartitionKey(client.UserId), cancellationToken: cancellationToken);
        return response.Resource;
    }

    public async Task<UserApiClient> UpdateAsync(UserApiClient client, CancellationToken cancellationToken = default)
    {
        var response = await _container.UpsertItemAsync(client, new PartitionKey(client.UserId), cancellationToken: cancellationToken);
        return response.Resource;
    }

    public async Task DeleteAsync(string userId, string clientId, CancellationToken cancellationToken = default)
    {
        await _container.DeleteItemAsync<UserApiClient>(clientId, new PartitionKey(userId), cancellationToken: cancellationToken);
    }

    private async Task<int> ReadCountAsync(QueryDefinition query, CancellationToken cancellationToken)
    {
        var iterator = _container.GetItemQueryIterator<int>(query);
        if (!iterator.HasMoreResults)
            return 0;

        var page = await iterator.ReadNextAsync(cancellationToken);
        return page.FirstOrDefault();
    }
}
