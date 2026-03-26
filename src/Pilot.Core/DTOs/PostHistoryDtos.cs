using Pilot.Core.Domain;
using System;
using System.Collections.Generic;

namespace Pilot.Core.DTOs;

public record PostHistoryDto(
    string Id,
    string CampaignId,
    string UserId,
    string PostId,
    string ChannelLinkId,
    string Platform,
    string? ExternalPostId,
    string? PostUrl,
    DateTimeOffset PostedAt,
    string Status,
    string? ErrorMessage,
    string? AvatarUrl = null,
    string? DisplayName = null,
    string? Username = null,
    string? CampaignName = null
);
