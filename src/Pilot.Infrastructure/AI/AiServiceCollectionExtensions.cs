using Microsoft.Extensions.DependencyInjection;
using Pilot.Core.Services;

namespace Pilot.Infrastructure.AI;

public static class AiServiceCollectionExtensions
{
    public static IServiceCollection AddPilotAi(this IServiceCollection services)
    {
        services.AddHttpClient<IAiService, GeminiAiService>();
        return services;
    }
}
