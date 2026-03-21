using System.Text.Json.Serialization;

namespace Pilot.Core.DTOs;

/// <summary>
/// DTOs for user management (admin only). No self-registration.
/// </summary>
public record UserResponse(
    string Id,
    string Email,
    string Name,
    string AvatarSeed,
    string Role,
    bool Disabled,
    bool HasPassword,
    int PasskeyCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt
);

public record CreateUserRequest(
    [property: JsonPropertyName("email")] string Email,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("role")] string Role,
    [property: JsonPropertyName("password")] string? Password
);

public record UpdateUserRequest(
    [property: JsonPropertyName("email")] string? Email,
    [property: JsonPropertyName("name")] string? Name,
    [property: JsonPropertyName("avatarSeed")] string? AvatarSeed,
    [property: JsonPropertyName("role")] string? Role,
    [property: JsonPropertyName("disabled")] bool? Disabled,
    [property: JsonPropertyName("password")] string? Password,
    [property: JsonPropertyName("deletePassword")] bool? DeletePassword
);
