using Microsoft.Azure.Cosmos;
using BCrypt.Net;

const string databaseId = "pilot-banana";
var endpoint = Environment.GetEnvironmentVariable("COSMOS_ENDPOINT") ?? "https://localhost:8081";
var key = Environment.GetEnvironmentVariable("COSMOS_KEY") ?? "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==";

var adminEmail = Environment.GetEnvironmentVariable("ADMIN_EMAIL");
var adminPassword = Environment.GetEnvironmentVariable("ADMIN_PASSWORD");

Console.WriteLine($"Using endpoint: {endpoint}");
using var client = new CosmosClient(endpoint, key, new CosmosClientOptions
{
    ConnectionMode = ConnectionMode.Gateway,
    ServerCertificateCustomValidationCallback = (_, _, _) => true // Emulator uses self-signed cert
});

var database = await client.CreateDatabaseIfNotExistsAsync(databaseId);
Console.WriteLine($"Database '{databaseId}' ready.");

var containers = new (string Name, string PartitionKeyPath)[]
{
    ("users", "/id"),
    ("campaigns", "/userId"),
    ("posts", "/campaignId"),
    ("channelLinks", "/userId"),
    ("prompts", "/userId"),
    ("postHistory", "/campaignId"),
    ("postAiTasks", "/userId")
};

foreach (var (name, partitionKeyPath) in containers)
{
    await database.Database.CreateContainerIfNotExistsAsync(new ContainerProperties(name, partitionKeyPath));
    Console.WriteLine($"Container '{name}' ready.");
}

if (!string.IsNullOrEmpty(adminEmail) && !string.IsNullOrEmpty(adminPassword))
{
    var container = database.Database.GetContainer("users");
    
    // Check if any users exist
    var query = new QueryDefinition("SELECT VALUE COUNT(1) FROM c");
    using var iterator = container.GetItemQueryIterator<int>(query);
    var response = await iterator.ReadNextAsync();
    var count = response.FirstOrDefault();

    if (count == 0)
    {
        Console.WriteLine("No users found. Creating initial admin user...");
        
        var user = new
        {
            id = Guid.NewGuid().ToString("N"),
            email = adminEmail.Trim(),
            name = "System Admin",
            avatarSeed = adminEmail.Trim(),
            role = 1, // Admin
            passwordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword, workFactor: 12),
            disabled = false,
            isDeleted = false,
            createdAt = DateTimeOffset.UtcNow,
            passkeys = new List<object>()
        };

        await container.CreateItemAsync(user, new PartitionKey(user.id));
        Console.WriteLine($"Admin user '{adminEmail}' created.");
    }
    else
    {
        Console.WriteLine("Users already exist. Skipping admin creation.");
    }
}
else
{
    Console.WriteLine("ADMIN_EMAIL and ADMIN_PASSWORD not set. Skipping admin creation.");
}

Console.WriteLine("Cosmos init done.");
