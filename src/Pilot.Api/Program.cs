using System.Text.Json;
using System.Text.Json.Serialization;
using Azure.Core.Serialization;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Pilot.Core.Repositories;
using Pilot.Core.Services;
using Pilot.Api.Options;
using Pilot.Api.Services;
using Pilot.Infrastructure.Auth;
using Pilot.Infrastructure.Blob;
using Pilot.Infrastructure.Cosmos;
using Pilot.Infrastructure.AI;
using Pilot.Adapters;
using Pilot.Infrastructure.KeyVault;

var host = new HostBuilder()
    .ConfigureFunctionsWebApplication()
    .ConfigureAppConfiguration((context, builder) =>
    {
        var appDir = AppContext.BaseDirectory;
        var curDir = Environment.CurrentDirectory;
        var paths = new[]
        {
            Path.Combine(appDir, "local.settings.json"),
            Path.Combine(curDir, "local.settings.json"),
            Path.GetFullPath(Path.Combine(appDir, "..", "..", "..", "local.settings.json")),
            Path.GetFullPath(Path.Combine(curDir, "local.settings.json"))
        };
        foreach (var fullPath in paths.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (string.IsNullOrEmpty(fullPath) || !File.Exists(fullPath)) continue;
            try
            {
                var json = File.ReadAllText(fullPath);
                using var doc = JsonDocument.Parse(json);
                if (!doc.RootElement.TryGetProperty("Values", out var values)) continue;
                var inMem = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
                foreach (var prop in values.EnumerateObject())
                {
                    var key = prop.Name.Replace("__", ":", StringComparison.Ordinal);
                    inMem[key] = prop.Value.GetString();
                }
                builder.AddInMemoryCollection(inMem!);
                break;
            }
            catch
            {
                // try next path
            }
        }
    })
    .ConfigureServices((context, services) =>
    {
        // Increase Kestrel's request body size limit to 100MB
        services.Configure<KestrelServerOptions>(options =>
        {
            options.Limits.MaxRequestBodySize = 104857600; // 100MB
        });

        services.Configure<WorkerOptions>(workerOptions =>
        {
            workerOptions.Serializer = new JsonObjectSerializer(
                new JsonSerializerOptions
                {
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                    PropertyNameCaseInsensitive = true,
                    Converters = { new JsonStringEnumConverter() }
                }
            );
        });

        // Configure ASP.NET Core MVC JSON options for IActionResult results
        services.Configure<Microsoft.AspNetCore.Mvc.JsonOptions>(options =>
        {
            options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
            options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
            options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        });

        var config = context.Configuration;
        services.AddApplicationInsightsTelemetryWorkerService();
        services.ConfigureFunctionsApplicationInsights();
        services.Configure<XOAuthOptions>(config.GetSection(XOAuthOptions.SectionName));
        services.AddSingleton<IConfigureOptions<XOAuthOptions>, XOAuthLocalSettingsConfigure>();
        services.AddSingleton<XOAuthStateService>();
        services.AddHttpClient("Pilot.XOAuth");
        services.AddPilotCosmos(config);
        services.AddPilotBlob(config);
        services.AddPilotKeyVault(config);
        services.AddPilotAdapters(config);
        services.AddPilotAi();
        services.AddPilotAuth(config);
        services.AddSingleton<RequestAuthHelper>();
        services.AddSingleton<PasskeyChallengeService>();
    })
    .Build();

await host.RunAsync();
