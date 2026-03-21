using Microsoft.Azure.Cosmos;
using Pilot.Core.Domain;
using Pilot.Core.Repositories;

namespace Pilot.Infrastructure.Cosmos;

public class ChannelLinkRepository : IChannelLinkRepository
{
    private readonly Container _container;

    public ChannelLinkRepository(CosmosContext context)
    {
        _container = context.ChannelLinks;
    }

    public async Task<ChannelLink?> GetByIdAsync(string userId, string linkId, CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _container.ReadItemAsync<ChannelLink>(linkId, new PartitionKey(userId), cancellationToken: cancellationToken);
            return response.Resource;
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task<IReadOnlyList<ChannelLink>> ListByUserIdAsync(string userId, CancellationToken cancellationToken = default)
    {
        var query = new QueryDefinition("SELECT * FROM c WHERE c.userId = @userId")
            .WithParameter("@userId", userId);
        var list = new List<ChannelLink>();
        var iterator = _container.GetItemQueryIterator<ChannelLink>(query, requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(userId) });
        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(cancellationToken);
            list.AddRange(page);
        }
        return list;
    }

    public async Task<IReadOnlyList<ChannelLink>> ListAllXChannelsAsync(CancellationToken cancellationToken = default)
    {
        var query = new QueryDefinition("SELECT * FROM c WHERE c.platform = 'x' AND c.isEnabled = true");
        var list = new List<ChannelLink>();
        var iterator = _container.GetItemQueryIterator<ChannelLink>(query);
        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(cancellationToken);
            list.AddRange(page);
        }
        return list;
    }

    public async Task<(IReadOnlyList<ChannelLink> Items, int Total)> ListPaginatedByUserIdAsync(string userId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var countQuery = new QueryDefinition("SELECT VALUE COUNT(1) FROM c WHERE c.userId = @userId")
            .WithParameter("@userId", userId);

        var countIterator = _container.GetItemQueryIterator<int>(countQuery, requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(userId) });
        int total = 0;
        if (countIterator.HasMoreResults)
        {
            total = (await countIterator.ReadNextAsync(cancellationToken)).FirstOrDefault();
        }

        var offset = (page - 1) * pageSize;
        var query = new QueryDefinition("SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC OFFSET @offset LIMIT @limit")
            .WithParameter("@userId", userId)
            .WithParameter("@offset", offset)
            .WithParameter("@limit", pageSize);

        var list = new List<ChannelLink>();
        var iterator = _container.GetItemQueryIterator<ChannelLink>(query, requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(userId) });
        while (iterator.HasMoreResults)
        {
            var resPage = await iterator.ReadNextAsync(cancellationToken);
            list.AddRange(resPage);
        }

        return (list, total);
    }

    public async Task<ChannelLink> CreateAsync(ChannelLink link, CancellationToken cancellationToken = default)
    {
        var response = await _container.CreateItemAsync(link, new PartitionKey(link.UserId), cancellationToken: cancellationToken);
        return response.Resource;
    }

    public async Task<ChannelLink> UpdateAsync(ChannelLink link, CancellationToken cancellationToken = default)
    {
        var response = await _container.UpsertItemAsync(link, new PartitionKey(link.UserId), cancellationToken: cancellationToken);
        return response.Resource;
    }

    public async Task DeleteAsync(string userId, string linkId, CancellationToken cancellationToken = default)
    {
        await _container.DeleteItemAsync<ChannelLink>(linkId, new PartitionKey(userId), cancellationToken: cancellationToken);
    }
}
