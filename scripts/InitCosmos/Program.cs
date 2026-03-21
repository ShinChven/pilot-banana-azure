using Microsoft.Azure.Cosmos;
using Pilot.Core.Domain;
using Pilot.Infrastructure.Auth;

const string databaseId = "pilot-banana";
var endpoint = Environment.GetEnvironmentVariable("COSMOS_ENDPOINT") ?? "https://localhost:8081";
var key = Environment.GetEnvironmentVariable("COSMOS_KEY") ?? "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==";
var seedDemoUser = (Environment.GetEnvironmentVariable("SEED_DEMO_USER") ?? "true").Equals("true", StringComparison.OrdinalIgnoreCase);
var seedEmail = Environment.GetEnvironmentVariable("SEED_EMAIL") ?? "admin@example.com";
var seedPassword = Environment.GetEnvironmentVariable("SEED_PASSWORD") ?? "ChangeMe123!";

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

if (seedDemoUser)
{
    await SeedDemoUserAsync(database.Database, seedEmail, seedPassword);
}
else
{
    Console.WriteLine("Skipping demo user seed because SEED_DEMO_USER is not true.");
}

Console.WriteLine("Cosmos init done.");

static async Task SeedDemoUserAsync(Database database, string email, string password)
{
    var users = database.GetContainer("users");
    var prompts = database.GetContainer("prompts");
    var postHistory = database.GetContainer("postHistory");

    var existingUsers = new QueryDefinition("SELECT VALUE COUNT(1) FROM c");
    using var countIterator = users.GetItemQueryIterator<int>(existingUsers);
    var countPage = await countIterator.ReadNextAsync();
    var userCount = countPage.Resource.FirstOrDefault();

    if (userCount > 0)
    {
        Console.WriteLine("Skipping demo user seed because the users container is not empty.");
        return;
    }

    var hasher = new PasswordHasher();
    var userId = Guid.NewGuid().ToString("N");
    var user = new User
    {
        Id = userId,
        Email = email.Trim(),
        Role = UserRole.Admin,
        PasswordHash = hasher.HashPassword(password),
        Disabled = false,
        CreatedAt = DateTimeOffset.UtcNow
    };

    await users.CreateItemAsync(user, new PartitionKey(user.Id));
    Console.WriteLine($"Seeded demo admin user '{user.Email}'.");

    var defaultPrompts = new List<Prompt>
    {
        new()
        {
            Id = Guid.NewGuid().ToString("N"),
            UserId = userId,
            Title = "Product Launch Announcement",
            Text = "Write a high-energy social media post announcing the launch of {product_name}. Focus on the key benefit: {key_benefit}. Include a call to action to visit {website_url}.",
            Author = "System",
            CreatedAt = DateTimeOffset.UtcNow
        },
        new()
        {
            Id = Guid.NewGuid().ToString("N"),
            UserId = userId,
            Title = "Customer Success Story",
            Text = "Draft a professional post highlighting a success story from {customer_name}. Emphasize how our service helped them achieve {result}. Use a quote if possible.",
            Author = "System",
            CreatedAt = DateTimeOffset.UtcNow
        },
        new()
        {
            Id = Guid.NewGuid().ToString("N"),
            UserId = userId,
            Title = "Weekly Tech Tip",
            Text = "Create a short, helpful tech tip about {topic}. The goal is to provide immediate value to our followers and establish authority in the {industry} space.",
            Author = "System",
            CreatedAt = DateTimeOffset.UtcNow
        }
    };

    foreach (var prompt in defaultPrompts)
    {
        await prompts.CreateItemAsync(prompt, new PartitionKey(prompt.UserId));
    }
    Console.WriteLine($"Seeded {defaultPrompts.Count} demo prompts.");

    var platforms = new[] { "X", "Instagram", "LinkedIn", "Facebook" };
    for (var i = 0; i < 5; i++)
    {
        var history = new PostHistoryItem
        {
            Id = Guid.NewGuid().ToString("N"),
            UserId = userId,
            CampaignId = "seed-campaign",
            PostId = "seed-post-" + i,
            ChannelLinkId = "seed-channel-" + i,
            Platform = platforms[i % platforms.Length],
            Status = i == 4 ? "Failed" : "Completed",
            ErrorMessage = i == 4 ? "Rate limit exceeded on platform." : null,
            PostedAt = DateTimeOffset.UtcNow.AddMinutes(-10 * (i + 1)),
            ExternalPostId = "ext-" + Guid.NewGuid().ToString("N")[..8],
            PostUrl = "https://example.com/post/" + i
        };
        await postHistory.CreateItemAsync(history, new PartitionKey(history.CampaignId));
    }
    Console.WriteLine("Seeded 5 demo history items.");
}
