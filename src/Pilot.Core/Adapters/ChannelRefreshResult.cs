namespace Pilot.Core.Adapters;

public record ChannelRefreshResult(
    bool Success,
    string? DisplayName = null,
    string? Username = null,
    string? AvatarUrl = null
);
