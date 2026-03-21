using System.Text.Json.Serialization;

namespace Pilot.Core.DTOs;

/// <summary>
/// Auth (login) request/response. JWT issued by API after validating credentials.
/// </summary>
public record LoginRequest([property: JsonPropertyName("email")] string Email, [property: JsonPropertyName("password")] string Password, [property: JsonPropertyName("rememberMe")] bool RememberMe = false);

public record TokenResponse(string AccessToken, string TokenType = "Bearer", int ExpiresInSeconds = 3600);

/// <summary>Current user from token (GET /api/auth/me).</summary>
public record MeResponse(string Id, string Email, string Role, string Name, string AvatarSeed, bool HasPassword, int PasskeyCount);

/// <summary>A simplified passkey view for the UI.</summary>
public record PasskeyResponse(string CredentialId, string Label, DateTimeOffset CreatedAt);
