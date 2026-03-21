using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Pilot.Adapters.X;
using Pilot.Core.Adapters;

namespace Pilot.Adapters;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registers X (Twitter) platform adapter and HTTP clients for X API and asset download.
    /// </summary>
    public static IServiceCollection AddPilotAdapters(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<XAdapterOptions>(configuration.GetSection(XAdapterOptions.SectionName));

        services.AddHttpClient("X.Api", client =>
        {
            client.BaseAddress = new Uri(XAdapterOptions.BaseUrl.TrimEnd('/') + "/");
            client.DefaultRequestHeaders.Add("User-Agent", "PilotBanana/1.0");
        });

        services.AddHttpClient("X.Upload", client =>
        {
            client.BaseAddress = new Uri(XAdapterOptions.BaseUrl.TrimEnd('/') + "/");
            client.DefaultRequestHeaders.Add("User-Agent", "PilotBanana/1.0");
        });

        services.AddHttpClient("Pilot.AssetDownload", client =>
        {
            client.DefaultRequestHeaders.Add("User-Agent", "PilotBanana/1.0");
        });

        services.AddSingleton<IPlatformAdapter, XPlatformAdapter>();
        return services;
    }
}
