namespace Pilot.Infrastructure.Cosmos;

public class CosmosOptions
{
    public const string SectionName = "Cosmos";

    public string Endpoint { get; set; } = string.Empty;
    public string Key { get; set; } = string.Empty;
    public string DatabaseId { get; set; } = "pilot-banana";

    public string UsersContainer { get; set; } = "users";
    public string CampaignsContainer { get; set; } = "campaigns";
    public string PostsContainer { get; set; } = "posts";
    public string ChannelLinksContainer { get; set; } = "channelLinks";
    public string PromptsContainer { get; set; } = "prompts";
    public string PostHistoryContainer { get; set; } = "postHistory";
    public string PostAiTasksContainer { get; set; } = "postAiTasks";
    public string UserAccessTokensContainer { get; set; } = "userAccessTokens";
    public string UserApiClientsContainer { get; set; } = "userApiClients";
    public string OAuthAuthorizationCodesContainer { get; set; } = "oauthCodes";
}
