using Microsoft.Azure.Cosmos;
using Pilot.Core.Domain;
using Pilot.Core.Repositories;

namespace Pilot.Infrastructure.Cosmos;

public class OAuthAuthorizationCodeRepository : IOAuthAuthorizationCodeRepository
{
    private readonly Container _container;

    public OAuthAuthorizationCodeRepository(CosmosContext context)
    {
        _container = context.OAuthAuthorizationCodes;
    }

    public async Task<OAuthAuthorizationCode?> GetByCodeAsync(string code, CancellationToken cancellationToken = default)
    {
        // Partition key is /clientId, so we need a cross-partition query to find by code (id)
        var query = new QueryDefinition("SELECT * FROM c WHERE c.id = @code")
            .WithParameter("@code", code);
        var iterator = _container.GetItemQueryIterator<OAuthAuthorizationCode>(query);
        if (iterator.HasMoreResults)
        {
            var response = await iterator.ReadNextAsync(cancellationToken);
            return response.FirstOrDefault();
        }
        return null;
    }

    public async Task<OAuthAuthorizationCode> CreateAsync(OAuthAuthorizationCode code, CancellationToken cancellationToken = default)
    {
        var response = await _container.CreateItemAsync(code, new PartitionKey(code.ClientId), cancellationToken: cancellationToken);
        return response.Resource;
    }

    public async Task UpdateAsync(OAuthAuthorizationCode code, CancellationToken cancellationToken = default)
    {
        await _container.UpsertItemAsync(code, new PartitionKey(code.ClientId), cancellationToken: cancellationToken);
    }
}
