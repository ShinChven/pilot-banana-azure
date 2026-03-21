namespace Pilot.Core.DTOs;

public record ChannelLinkResponse(
    string Id,
    string UserId,
    string Platform,
    string ExternalId,
    string? DisplayName,
    string? Username,
    string? Note,
    bool IsEnabled,
    string? ProfileUrl,
    string? AvatarUrl,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt
);

public record UpdateChannelLinkRequest(string? Note, bool? IsEnabled);

public record LinkChannelRequest(string Platform, string AuthorizationCode, string? RedirectUri); // OAuth flow

public record ChannelLinkCreatedResponse(string Id, string Platform, string? DisplayName);
