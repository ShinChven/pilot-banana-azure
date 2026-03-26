using System.Text.Json;
using System.Text.Json.Serialization;
using System.IO;
using Azure.Core.Serialization;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Azure.Storage.Queues;
using Pilot.Adapters;
using Pilot.Infrastructure.Blob;
using Pilot.Infrastructure.Cosmos;
using Pilot.Infrastructure.AI;
using Pilot.Infrastructure.KeyVault;
using Pilot.Infrastructure.Media;
using Pilot.Infrastructure.Notifications;

namespace Pilot.Orchestration;

public class Program
{
    public static async Task Main(string[] args)
    {
        // 1. Force queue creation on the very first line of the process
        await EnsureQueueExistsAsync("scheduled-posts");
        await EnsureQueueExistsAsync("ai-generation-tasks");

        // 2. Start the Host
        var host = new HostBuilder()
            .ConfigureFunctionsWorkerDefaults()
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

                var config = context.Configuration;
                
                services.AddApplicationInsightsTelemetryWorkerService();
                services.ConfigureFunctionsApplicationInsights();
                
                services.AddPilotCosmos(config);
                services.AddPilotBlob(config);
                services.AddPilotKeyVault(config);
                services.AddPilotAdapters(config);
                services.AddPilotAi();
                services.AddMediaServices();
                services.AddPilotNotifications();

                services.AddSingleton(sp => 
                {
                    var connectionString = GetConnectionString();
                    var client = new QueueClient(connectionString, "scheduled-posts", new QueueClientOptions
                    {
                        MessageEncoding = QueueMessageEncoding.Base64
                    });
                    
                    // Also ensure exists here as a second layer
                    client.CreateIfNotExists();
                    return client;
                });
            })
            .Build();

        await host.RunAsync();
    }

    private static async Task EnsureQueueExistsAsync(string queueName)
    {
        try 
        {
            var connectionString = GetConnectionString();
            var client = new QueueClient(connectionString, queueName, new QueueClientOptions
            {
                MessageEncoding = QueueMessageEncoding.Base64
            });
            
            Console.WriteLine($">>> [STARTUP] Checking queue '{queueName}'...");
            await client.CreateIfNotExistsAsync();
            Console.WriteLine($">>> [STARTUP] Queue '{queueName}' is ready.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($">>> [STARTUP ERROR] {ex.Message}");
        }
    }

    private static string GetConnectionString()
    {
        // Try to get from environment first (set by func start from local.settings.json)
        var connectionString = Environment.GetEnvironmentVariable("AzureWebJobsStorage");
        
        if (string.IsNullOrEmpty(connectionString))
        {
            // Fallback: manually read local.settings.json if environment isn't populated yet
            try 
            {
                var json = File.ReadAllText("local.settings.json");
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("Values", out var values) && 
                    values.TryGetProperty("AzureWebJobsStorage", out var storage))
                {
                    connectionString = storage.GetString();
                }
            }
            catch { /* ignore */ }
        }

        return connectionString ?? "UseDevelopmentStorage=true";
    }
}
