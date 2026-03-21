namespace Pilot.Core.Services;

/// <summary>
/// Optional notifications (e.g. when a campaign finishes). No-op by default; replace with email/webhook implementation as needed.
/// </summary>
public interface INotificationService
{
    /// <summary>Called when a campaign has been set to Finished (all assets posted).</summary>
    Task NotifyCampaignFinishedAsync(string userId, string campaignId, string campaignName, CancellationToken cancellationToken = default);
}
