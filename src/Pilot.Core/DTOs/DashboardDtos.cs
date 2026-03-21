using System.Text.Json.Serialization;

namespace Pilot.Core.DTOs;

public record DashboardStatsResponse(
    [property: JsonPropertyName("activeCampaigns")] long ActiveCampaigns,
    [property: JsonPropertyName("scheduledPosts")] long ScheduledPosts,
    [property: JsonPropertyName("connectedChannels")] long ConnectedChannels,
    [property: JsonPropertyName("recentHistory")] List<PostHistoryDto> RecentHistory,
    [property: JsonPropertyName("automationOverview")] List<PostCountByDate> AutomationOverview
);

public record PostCountByDate(
    [property: JsonPropertyName("date")] string Date,
    [property: JsonPropertyName("count")] int Count
);
