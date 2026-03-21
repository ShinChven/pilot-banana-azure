using Microsoft.Extensions.DependencyInjection;
using Pilot.Core.Services;
using Pilot.Infrastructure.Notifications;

namespace Pilot.Infrastructure.Notifications;

public static class NotificationServiceCollectionExtensions
{
    /// <summary>
    /// Registers the default no-op notification service. Replace with a real implementation (email, webhook) when needed.
    /// </summary>
    public static IServiceCollection AddPilotNotifications(this IServiceCollection services)
    {
        services.AddSingleton<INotificationService, NoOpNotificationService>();
        return services;
    }
}
