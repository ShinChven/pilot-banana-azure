namespace Pilot.Core.DTOs;

public record CreateCampaignRequest(string Name, string? Description = null, IReadOnlyList<string>? ChannelLinkIds = null);

public record UpdateCampaignRequest(string? Name, string? Description = null, IReadOnlyList<string>? ChannelLinkIds = null, string? Status = null); // Status: Draft, Active, Paused, Finished

public record CampaignResponse(
    string Id,
    string UserId,
    string Name,
    string Description,
    IReadOnlyList<string> ChannelLinkIds,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt,
    int TotalPosts = 0,
    int PostedPosts = 0,
    DateTimeOffset? EndDate = null
);
