using Microsoft.Azure.Functions.Worker.Http;
using Pilot.Core.Domain;
using Pilot.Core.Repositories;
using Pilot.Infrastructure.Auth;

namespace Pilot.Api.Services;

/// <summary>
/// Reads Bearer token from request and validates; returns user id and role or null.
/// Also checks database to ensure user is not disabled or deleted.
/// </summary>
public class RequestAuthHelper
{
    private readonly IJwtTokenService _jwt;
    private readonly IUserRepository _userRepository;

    public RequestAuthHelper(IJwtTokenService jwt, IUserRepository userRepository)
    {
        _jwt = jwt;
        _userRepository = userRepository;
    }

    /// <summary>Returns (userId, email, name, role) if valid Bearer token present and user active; null otherwise.</summary>
    public async Task<(string UserId, string? Email, string? Name, UserRole Role)?> GetUserFromRequestAsync(HttpRequestData req, CancellationToken cancellationToken = default)
    {
        if (!req.Headers.TryGetValues("Authorization", out var values))
            return null;
        return await ProcessAuthHeaderAsync(values.FirstOrDefault(), cancellationToken);
    }

    /// <summary>Returns (userId, email, name, role) if valid Bearer token present and user active; null otherwise.</summary>
    public async Task<(string UserId, string? Email, string? Name, UserRole Role)?> GetUserFromRequestAsync(Microsoft.AspNetCore.Http.HttpRequest req, CancellationToken cancellationToken = default)
    {
        if (!req.Headers.TryGetValue("Authorization", out var values))
            return null;
        return await ProcessAuthHeaderAsync(values.FirstOrDefault(), cancellationToken);
    }

    private async Task<(string UserId, string? Email, string? Name, UserRole Role)?> ProcessAuthHeaderAsync(string? auth, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(auth))
            return null;
        var principal = _jwt.ValidateToken(auth);
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

        // Common status check: check database for Disabled or IsDeleted
        var user = await _userRepository.GetByIdAsync(sub, cancellationToken);
        if (user == null || user.Disabled || user.IsDeleted)
            return null;

        return (sub, email, name, role);
    }
}
