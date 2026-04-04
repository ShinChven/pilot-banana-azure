using Microsoft.Azure.Cosmos;

namespace Pilot.Infrastructure.Cosmos;

public class CosmosContext
{
    private readonly CosmosClient _client;
    private readonly Database _database;
    private readonly CosmosOptions _options;

    public CosmosContext(CosmosClient client, CosmosOptions options)
    {
        _client = client;
        _options = options;
        _database = _client.GetDatabase(_options.DatabaseId);
    }

    public Container Users => _database.GetContainer(_options.UsersContainer);
    public Container Campaigns => _database.GetContainer(_options.CampaignsContainer);
    public Container ChannelLinks => _database.GetContainer(_options.ChannelLinksContainer);
    public Container Posts => _database.GetContainer(_options.PostsContainer);
    public Container Prompts => _database.GetContainer(_options.PromptsContainer);
    public Container PostHistory => _database.GetContainer(_options.PostHistoryContainer);
    public Container PostAiTasks => _database.GetContainer(_options.PostAiTasksContainer);
    public Container UserAccessTokens => _database.GetContainer(_options.UserAccessTokensContainer);
    public Container UserApiClients => _database.GetContainer(_options.UserApiClientsContainer);
    public Container OAuthAuthorizationCodes => _database.GetContainer(_options.OAuthAuthorizationCodesContainer);
}
