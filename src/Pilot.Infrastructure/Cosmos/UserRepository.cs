using Microsoft.Azure.Cosmos;
using Pilot.Core.Repositories;
using UserEntity = Pilot.Core.Domain.User;

namespace Pilot.Infrastructure.Cosmos;

public class UserRepository : IUserRepository
{
    private readonly Container _container;

    public UserRepository(CosmosContext context)
    {
        _container = context.Users;
    }

    public async Task<UserEntity?> GetByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _container.ReadItemAsync<UserEntity>(id, new PartitionKey(id), cancellationToken: cancellationToken);
            var user = response.Resource;
            return user != null && !user.IsDeleted ? user : null;
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task<UserEntity?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        var query = new QueryDefinition("SELECT * FROM c WHERE c.email = @email AND (NOT IS_DEFINED(c.isDeleted) OR c.isDeleted = false)")
            .WithParameter("@email", email);
        var iterator = _container.GetItemQueryIterator<UserEntity>(query);
        if (!iterator.HasMoreResults)
            return null;
        var page = await iterator.ReadNextAsync(cancellationToken);
        return page.FirstOrDefault();
    }

    public async Task<IReadOnlyList<UserEntity>> ListAllAsync(CancellationToken cancellationToken = default)
    {
        var query = new QueryDefinition("SELECT * FROM c WHERE (NOT IS_DEFINED(c.isDeleted) OR c.isDeleted = false)");
        var list = new List<UserEntity>();
        var iterator = _container.GetItemQueryIterator<UserEntity>(query);
        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(cancellationToken);
            list.AddRange(page);
        }
        return list;
    }

    public async Task<(IReadOnlyList<UserEntity> Items, int Total)> ListPaginatedAllAsync(int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var countQuery = new QueryDefinition("SELECT VALUE COUNT(1) FROM c WHERE (NOT IS_DEFINED(c.isDeleted) OR c.isDeleted = false)");
        var countIterator = _container.GetItemQueryIterator<int>(countQuery);
        int total = 0;
        if (countIterator.HasMoreResults)
        {
            total = (await countIterator.ReadNextAsync(cancellationToken)).FirstOrDefault();
        }

        var offset = (page - 1) * pageSize;
        var query = new QueryDefinition("SELECT * FROM c WHERE (NOT IS_DEFINED(c.isDeleted) OR c.isDeleted = false) ORDER BY c.createdAt DESC OFFSET @offset LIMIT @limit")
            .WithParameter("@offset", offset)
            .WithParameter("@limit", pageSize);

        var list = new List<UserEntity>();
        var iterator = _container.GetItemQueryIterator<UserEntity>(query);
        while (iterator.HasMoreResults)
        {
            var p = await iterator.ReadNextAsync(cancellationToken);
            list.AddRange(p);
        }
        return (list, total);
    }

    public async Task<UserEntity> CreateAsync(UserEntity user, CancellationToken cancellationToken = default)
    {
        var response = await _container.CreateItemAsync(user, new PartitionKey(user.Id), cancellationToken: cancellationToken);
        return response.Resource;
    }

    public async Task<UserEntity> UpdateAsync(UserEntity user, CancellationToken cancellationToken = default)
    {
        var response = await _container.UpsertItemAsync(user, new PartitionKey(user.Id), cancellationToken: cancellationToken);
        return response.Resource;
    }
}
