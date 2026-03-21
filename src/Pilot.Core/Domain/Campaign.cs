namespace Pilot.Core.Domain;

/// <summary>
/// Campaign (project) metadata. One campaign per user; contains many assets.
/// Partition key: userId.
/// </summary>
public class Campaign
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    /// <summary>Channel link IDs to post to (X accounts, etc.). Empty = none selected.</summary>
    public List<string> ChannelLinkIds { get; set; } = new();
    public CampaignStatus Status { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
}
