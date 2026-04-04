using Microsoft.Azure.Functions.Worker.Http;
using Pilot.Core.Domain;
using Pilot.Core.Repositories;

namespace Pilot.Api.Services;

/// <summary>
/// MCP-only auth: validates PAT (pat_) tokens and Client Credentials (X-Client-Id/X-Client-Secret).
/// JWT is NOT accepted here — MCP uses long-lived tokens only.
/// </summary>
public class McpAuthHelper
{
    private readonly IUserRepository _userRepository;
    private readonly IUserAccessTokenRepository _tokenRepository;
    private readonly IUserApiClientRepository _apiClientRepository;

    public McpAuthHelper(
        IUserRepository userRepository,
        IUserAccessTokenRepository tokenRepository,
        IUserApiClientRepository apiClientRepository)
    {
        _userRepository = userRepository;
        _tokenRepository = tokenRepository;
        _apiClientRepository = apiClientRepository;
    }

    /// <summary>Returns (userId, email, name, role) if valid PAT or client credentials present and user active; null otherwise.</summary>
    public async Task<(string UserId, string? Email, string? Name, UserRole Role)?> GetUserFromRequestAsync(HttpRequestData req, CancellationToken cancellationToken = default)
    {
        // 1. Check Bearer PAT
        if (req.Headers.TryGetValues("Authorization", out var values))
        {
            var auth = await ProcessPatAsync(values.FirstOrDefault(), cancellationToken);
            if (auth != null) return auth;
        }

        // 2. Check Client Credentials
        req.Headers.TryGetValues("X-Client-Id", out var clientIds);
        req.Headers.TryGetValues("X-Client-Secret", out var clientSecrets);
        var clientId = clientIds?.FirstOrDefault() ?? req.Query["client_id"];
        var clientSecret = clientSecrets?.FirstOrDefault() ?? req.Query["client_secret"];

        if (!string.IsNullOrEmpty(clientId) && !string.IsNullOrEmpty(clientSecret))
        {
            var auth = await ProcessClientCredentialsAsync(clientId, clientSecret, cancellationToken);
            if (auth != null) return auth;
        }

        return null;
    }

    private async Task<(string UserId, string? Email, string? Name, UserRole Role)?> ProcessPatAsync(string? auth, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(auth))
            return null;

        var token = auth;
        if (token.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            token = token[7..].Trim();

        if (!token.StartsWith("pat_", StringComparison.OrdinalIgnoreCase))
            return null;

        var hashBytes = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token));
        var tokenHash = Convert.ToHexString(hashBytes).ToLowerInvariant();

        var pat = await _tokenRepository.GetByTokenHashAsync(tokenHash, cancellationToken);
        if (pat == null || pat.IsRevoked || (pat.ExpiresAt.HasValue && pat.ExpiresAt < DateTimeOffset.UtcNow))
            return null;

        var user = await _userRepository.GetByIdAsync(pat.UserId, cancellationToken);
        if (user == null || user.Disabled || user.IsDeleted)
            return null;

        _ = Task.Run(async () =>
        {
            try
            {
                pat.LastUsedAt = DateTimeOffset.UtcNow;
                await _tokenRepository.UpdateAsync(pat, default);
            }
            catch { /* ignore */ }
        }, default);

        return (user.Id, user.Email, user.Name, user.Role);
    }

    private async Task<(string UserId, string? Email, string? Name, UserRole Role)?> ProcessClientCredentialsAsync(string clientId, string clientSecret, CancellationToken cancellationToken)
    {
        var client = await _apiClientRepository.GetByIdAsync(clientId, cancellationToken);
        if (client == null || client.IsRevoked)
            return null;

        var hashBytes = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(clientSecret));
        var secretHash = Convert.ToHexString(hashBytes).ToLowerInvariant();

        if (client.SecretHash != secretHash)
            return null;

        var user = await _userRepository.GetByIdAsync(client.UserId, cancellationToken);
        if (user == null || user.Disabled || user.IsDeleted)
            return null;

        _ = Task.Run(async () =>
        {
            try
            {
                client.LastUsedAt = DateTimeOffset.UtcNow;
                await _apiClientRepository.UpdateAsync(client, default);
            }
            catch { /* ignore */ }
        }, default);

        return (user.Id, user.Email, user.Name, user.Role);
    }
}
