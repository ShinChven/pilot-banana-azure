namespace Pilot.Core.DTOs;

public record PostStateResponse(
    string CampaignId,
    int LastPostedAssetIndex,
    DateTimeOffset? LastPostedAt,
    DateTimeOffset? NextScheduledRun,
    DateTimeOffset? UpdatedAt
);
