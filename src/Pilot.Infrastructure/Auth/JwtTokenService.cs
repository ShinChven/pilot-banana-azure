using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Pilot.Core.Domain;
using Pilot.Core.DTOs;

namespace Pilot.Infrastructure.Auth;

public interface IJwtTokenService
{
    TokenResponse IssueToken(User user, bool rememberMe = false);
    ClaimsPrincipal? ValidateToken(string bearerToken);
}

public class JwtTokenService : IJwtTokenService
{
    private readonly JwtOptions _options;

    public JwtTokenService(Microsoft.Extensions.Options.IOptions<JwtOptions> options)
    {
        _options = options.Value;
    }

    public TokenResponse IssueToken(User user, bool rememberMe = false)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.Name),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("sub", user.Id)
        };

        // If rememberMe is true, use a much longer expiry (e.g. 30 days)
        var expiryMinutes = rememberMe ? 30 * 24 * 60 : _options.ExpiryMinutes;
        var expires = DateTimeOffset.UtcNow.AddMinutes(expiryMinutes);

        var token = new JwtSecurityToken(
            _options.Issuer,
            _options.Audience,
            claims,
            expires: expires.DateTime,
            signingCredentials: creds
        );
        var jwt = new JwtSecurityTokenHandler().WriteToken(token);
        return new TokenResponse(jwt, "Bearer", (int)(expires - DateTimeOffset.UtcNow).TotalSeconds);
    }

    public ClaimsPrincipal? ValidateToken(string bearerToken)
    {
        if (string.IsNullOrEmpty(bearerToken) || !bearerToken.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return null;
        var token = bearerToken["Bearer ".Length..].Trim();
        if (string.IsNullOrEmpty(token))
            return null;

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Secret));
        var validation = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = key,
            ValidIssuer = _options.Issuer,
            ValidAudience = _options.Audience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(2)
        };
        try
        {
            var principal = new JwtSecurityTokenHandler().ValidateToken(token, validation, out _);
            return principal;
        }
        catch
        {
            return null;
        }
    }
}
