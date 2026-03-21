using Pilot.Core.Services;

namespace Pilot.Infrastructure.Notifications;

/// <summary>
/// No-op implementation. Replace with email/webhook/push when needed.
/// </summary>
public class NoOpNotificationService : INotificationService
{
    public Task NotifyCampaignFinishedAsync(string userId, string campaignId, string campaignName, CancellationToken cancellationToken = default)
    {
        return Task.CompletedTask;
    }
}
