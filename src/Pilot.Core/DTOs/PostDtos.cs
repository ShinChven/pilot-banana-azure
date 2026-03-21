using System;
using System.Collections.Generic;
using Pilot.Core.Domain;

namespace Pilot.Core.DTOs;

public record PostResponse(
    string Id,
    string CampaignId,
    string UserId,
    string? Text,
    List<string> MediaUrls,
    DateTimeOffset? ScheduledTime,
    PostStatus Status,
    Dictionary<string, object> PlatformData,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt,
    string? PostUrl = null,
    string? CampaignName = null
);

public record CreatePostRequest(
    string? Text,
    List<string>? MediaUrls,
    DateTimeOffset? ScheduledTime,
    Dictionary<string, object>? PlatformData
);

public record UpdatePostRequest(
    string? Text,
    List<string>? MediaUrls,
    DateTimeOffset? ScheduledTime,
    PostStatus? Status,
    Dictionary<string, object>? PlatformData
);
