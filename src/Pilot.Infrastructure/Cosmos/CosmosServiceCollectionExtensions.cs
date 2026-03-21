using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Pilot.Core.Repositories;

namespace Pilot.Infrastructure.Cosmos;

public static class CosmosServiceCollectionExtensions
{
    /// <summary>
    /// Registers Cosmos DB client, context, options, and all repositories.
    /// </summary>
    public static IServiceCollection AddPilotCosmos(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<CosmosOptions>(configuration.GetSection(CosmosOptions.SectionName));
        services.AddSingleton(sp =>
        {
            var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<CosmosOptions>>().Value;
            var clientOptions = new CosmosClientOptions
            {
                ConnectionMode = ConnectionMode.Gateway,
                Serializer = new CamelCaseCosmosSerializer()
            };
            if (options.Endpoint.Contains("localhost", StringComparison.OrdinalIgnoreCase) || options.Endpoint.Contains("127.0.0.1"))
                clientOptions.ServerCertificateCustomValidationCallback = (request, cert, chain) => true;
            return new CosmosClient(options.Endpoint, options.Key, clientOptions);
        });
        services.AddSingleton<CosmosContext>(sp =>
        {
            var client = sp.GetRequiredService<CosmosClient>();
            var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<CosmosOptions>>().Value;
            return new CosmosContext(client, options);
        });

        services.AddSingleton<IUserRepository, UserRepository>();
        services.AddSingleton<ICampaignRepository, CampaignRepository>();
        services.AddSingleton<IPostRepository, PostRepository>();
        services.AddSingleton<IChannelLinkRepository, ChannelLinkRepository>();
        services.AddSingleton<IPromptRepository, PromptRepository>();
        services.AddSingleton<IPostHistoryRepository, PostHistoryRepository>();
        services.AddSingleton<IPostAiTaskRepository, PostAiTaskRepository>();

        return services;
        }}
