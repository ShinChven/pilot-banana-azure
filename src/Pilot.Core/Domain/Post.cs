namespace Pilot.Core.Domain;

/// <summary>
/// A single scheduled post. Replaces the old Asset/PostState methodology.
/// A post must have either Text, Media, or both.
/// Partition Key: CampaignId (so all posts for a campaign live together)
/// </summary>
public class Post
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string CampaignId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;

    /// <summary>
    /// The main body of the post.
    /// </summary>
    public string? Text { get; set; }

    /// <summary>
    /// Up to 4 images for X/Twitter. Contains Blob paths or URLs.
    /// </summary>
    public List<string> MediaUrls { get; set; } = new();

    /// <summary>
    /// The exact minute this post should be published.
    /// </summary>
    public DateTimeOffset? ScheduledTime { get; set; }

    /// <summary>
    /// Draft, Scheduled, Posted, or Failed.
    /// </summary>
    public PostStatus Status { get; set; } = PostStatus.Draft;

    /// <summary>
    /// Leveraging Cosmos DB's flexibility. We can store platform-specific
    /// structures here later (e.g., X threads, LinkedIn articles, etc.)
    /// </summary>
    public Dictionary<string, object> PlatformData { get; set; } = new();

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }
}
