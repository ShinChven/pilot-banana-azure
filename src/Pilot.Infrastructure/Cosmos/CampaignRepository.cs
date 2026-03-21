using Microsoft.Azure.Cosmos;
using Pilot.Core.Domain;
using Pilot.Core.Repositories;

namespace Pilot.Infrastructure.Cosmos;

public class CampaignRepository : ICampaignRepository
{
    private readonly Container _container;

    public CampaignRepository(CosmosContext context)
    {
        _container = context.Campaigns;
    }

    public async Task<Campaign?> GetByIdAsync(string userId, string campaignId, CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _container.ReadItemAsync<Campaign>(campaignId, new PartitionKey(userId), cancellationToken: cancellationToken);
            return response.Resource;
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task<IReadOnlyList<Campaign>> ListByUserIdAsync(string userId, CancellationToken cancellationToken = default)
    {
        var query = new QueryDefinition("SELECT * FROM c WHERE c.userId = @userId")
            .WithParameter("@userId", userId);
        var list = new List<Campaign>();
        var iterator = _container.GetItemQueryIterator<Campaign>(query, requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(userId) });
        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(cancellationToken);
            list.AddRange(page);
        }
        return list;
    }

    public async Task<IReadOnlyList<Campaign>> ListByChannelLinkIdAsync(string userId, string channelLinkId, CancellationToken cancellationToken = default)
    {
        var query = new QueryDefinition("SELECT * FROM c WHERE c.userId = @userId AND ARRAY_CONTAINS(c.channelLinkIds, @id)")
            .WithParameter("@userId", userId)
            .WithParameter("@id", channelLinkId);
        var list = new List<Campaign>();
        var iterator = _container.GetItemQueryIterator<Campaign>(query, requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(userId) });
        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(cancellationToken);
            list.AddRange(page);
        }
        return list;
    }

    public async Task<(IReadOnlyList<Campaign> Items, int Total)> ListPaginatedByUserIdAsync(string userId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        // 1. Get total count
        var countQuery = new QueryDefinition("SELECT VALUE COUNT(1) FROM c WHERE c.userId = @userId")
            .WithParameter("@userId", userId);

        var countIterator = _container.GetItemQueryIterator<int>(countQuery, requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(userId) });
        int total = 0;
        if (countIterator.HasMoreResults)
        {
            var response = await countIterator.ReadNextAsync(cancellationToken);
            total = response.FirstOrDefault();
        }

        // 2. Get paginated items
        var offset = (page - 1) * pageSize;
        var query = new QueryDefinition("SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC OFFSET @offset LIMIT @limit")
            .WithParameter("@userId", userId)
            .WithParameter("@offset", offset)
            .WithParameter("@limit", pageSize);

        var list = new List<Campaign>();
        var iterator = _container.GetItemQueryIterator<Campaign>(query, requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(userId) });
        while (iterator.HasMoreResults)
        {
            var responsePage = await iterator.ReadNextAsync(cancellationToken);
            list.AddRange(responsePage);
        }

        return (list, total);
    }

    public async Task<IReadOnlyList<Campaign>> ListByStatusAsync(CampaignStatus status, CancellationToken cancellationToken = default)
    {
        var query = new QueryDefinition("SELECT * FROM c WHERE c.status = @status")
            .WithParameter("@status", (int)status);
        var list = new List<Campaign>();
        var iterator = _container.GetItemQueryIterator<Campaign>(query);
        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(cancellationToken);
            list.AddRange(page);
        }
        return list;
    }

        public async Task<IReadOnlyList<Campaign>> ListByIdsAsync(string userId, IEnumerable<string> ids, CancellationToken cancellationToken = default)
        {
        if (ids == null || !ids.Any()) return new List<Campaign>();

        var query = new QueryDefinition("SELECT * FROM c WHERE c.userId = @userId AND ARRAY_CONTAINS(@ids, c.id)")
            .WithParameter("@userId", userId)
            .WithParameter("@ids", ids.ToArray());

        var list = new List<Campaign>();
        var iterator = _container.GetItemQueryIterator<Campaign>(query, requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(userId) });
        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(cancellationToken);
            list.AddRange(page);
        }
        return list;
        }

        public async Task<Campaign> CreateAsync(Campaign campaign, CancellationToken cancellationToken = default)

    {
        var response = await _container.CreateItemAsync(campaign, new PartitionKey(campaign.UserId), cancellationToken: cancellationToken);
        return response.Resource;
    }

    public async Task<Campaign> UpdateAsync(Campaign campaign, CancellationToken cancellationToken = default)
    {
        var response = await _container.UpsertItemAsync(campaign, new PartitionKey(campaign.UserId), cancellationToken: cancellationToken);
        return response.Resource;
    }

    public async Task DeleteAsync(string userId, string campaignId, CancellationToken cancellationToken = default)
    {
        await _container.DeleteItemAsync<Campaign>(campaignId, new PartitionKey(userId), cancellationToken: cancellationToken);
    }
}
