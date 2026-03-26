using Microsoft.Extensions.DependencyInjection;
using Pilot.Core.Services;

namespace Pilot.Infrastructure.Media;

public static class MediaServiceCollectionExtensions
{
    public static IServiceCollection AddMediaServices(this IServiceCollection services)
    {
        services.AddSingleton<IImageOptimizer, ImageOptimizer>();
        return services;
    }
}
