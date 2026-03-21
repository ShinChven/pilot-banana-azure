using Azure.Storage.Blobs;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Pilot.Core.Repositories;
using Pilot.Core.Services;

namespace Pilot.Infrastructure.Blob;

public static class BlobServiceCollectionExtensions
{
    public static IServiceCollection AddPilotBlob(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<BlobOptions>(configuration.GetSection(BlobOptions.SectionName));
        services.AddSingleton(sp =>
        {
            var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<BlobOptions>>().Value;
            return new BlobServiceClient(options.ConnectionString);
        });
        services.AddSingleton<IAssetBlobStore, AssetBlobStore>();
        services.AddSingleton<IDistributedLockService, BlobDistributedLockService>();
        return services;
    }
}
