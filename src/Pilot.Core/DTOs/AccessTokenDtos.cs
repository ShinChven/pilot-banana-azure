using System.Text.Json.Serialization;

namespace Pilot.Core.DTOs;

public record CreateAccessTokenRequest(
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("expiresInDays")] int? ExpiresInDays = null);

public record AccessTokenCreatedResponse(
    string Id,
    string Name,
    string Token,
    string Prefix,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ExpiresAt);

public record AccessTokenResponse(
    string Id,
    string Name,
    string Prefix,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ExpiresAt,
    DateTimeOffset? LastUsedAt,
    bool IsRevoked);
