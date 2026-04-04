using Microsoft.Azure.Functions.Worker.Http;
using Pilot.Core.Domain;
using Pilot.Core.Repositories;
using Pilot.Infrastructure.Auth;

namespace Pilot.Api.Services;

/// <summary>
/// Reads Bearer JWT token from request and validates; returns user id and role or null.
/// Also checks database to ensure user is not disabled or deleted.
/// PAT and Client Credentials are NOT handled here — they are MCP-only auth methods.
/// </summary>
public class RequestAuthHelper
{
    private readonly IJwtTokenService _jwt;
    private readonly IUserRepository _userRepository;

    public RequestAuthHelper(
        IJwtTokenService jwt,
        IUserRepository userRepository)
    {
        _jwt = jwt;
        _userRepository = userRepository;
    }

    /// <summary>Returns (userId, email, name, role) if valid JWT Bearer token present and user active; null otherwise.</summary>
    public async Task<(string UserId, string? Email, string? Name, UserRole Role)?> GetUserFromRequestAsync(HttpRequestData req, CancellationToken cancellationToken = default)
    {
        if (req.Headers.TryGetValues("Authorization", out var values))
        {
            var auth = await ProcessJwtAsync(values.FirstOrDefault(), cancellationToken);
            if (auth != null) return auth;
        }

        var token = req.Query["token"];
        if (!string.IsNullOrEmpty(token))
            return await ProcessJwtAsync($"Bearer {token}", cancellationToken);

        return null;
    }

    /// <summary>Returns (userId, email, name, role) if valid JWT Bearer token present and user active; null otherwise.</summary>
    public async Task<(string UserId, string? Email, string? Name, UserRole Role)?> GetUserFromRequestAsync(Microsoft.AspNetCore.Http.HttpRequest req, CancellationToken cancellationToken = default)
    {
        if (req.Headers.TryGetValue("Authorization", out var values))
        {
            var auth = await ProcessJwtAsync(values.FirstOrDefault(), cancellationToken);
            if (auth != null) return auth;
        }

        if (req.Query.TryGetValue("token", out var token))
            return await ProcessJwtAsync($"Bearer {token}", cancellationToken);

        return null;
    }

    private async Task<(string UserId, string? Email, string? Name, UserRole Role)?> ProcessJwtAsync(string? auth, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(auth))
            return null;

        var token = auth;
        if (token.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            token = token[7..].Trim();

        // Reject PAT tokens — they are not valid for API auth
        if (token.StartsWith("pat_", StringComparison.OrdinalIgnoreCase))
            return null;

        var principal = _jwt.ValidateToken(token);
        if (principal == null)
            return null;
        var sub = principal.FindFirst("sub")?.Value ?? principal.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var email = principal.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value;
        var name = principal.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;
        var roleStr = principal.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
        if (string.IsNullOrEmpty(sub) || string.IsNullOrEmpty(roleStr))
            return null;
        if (!Enum.TryParse<UserRole>(roleStr, ignoreCase: true, out var role))
            return null;

        var user = await _userRepository.GetByIdAsync(sub, cancellationToken);
        if (user == null || user.Disabled || user.IsDeleted)
            return null;

        return (sub, email, name, role);
    }
}
