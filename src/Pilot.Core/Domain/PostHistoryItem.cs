namespace Pilot.Core.Domain;

/// <summary>
/// Optional audit record: one per asset per channel when posted.
/// Partition key: campaignId.
/// </summary>
public class PostHistoryItem
{
    public string Id { get; set; } = string.Empty;
    public string CampaignId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string PostId { get; set; } = string.Empty;
    public string? AssetId { get; set; }
    public string ChannelLinkId { get; set; } = string.Empty;
    public string Platform { get; set; } = string.Empty;
    public string? ExternalPostId { get; set; }
    public string? PostUrl { get; set; }
    public DateTimeOffset PostedAt { get; set; }
    public string Status { get; set; } = "Completed"; // Completed, Failed, etc.
    public string? ErrorMessage { get; set; }
}
