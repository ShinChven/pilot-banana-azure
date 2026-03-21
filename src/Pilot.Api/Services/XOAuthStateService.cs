using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Pilot.Api.Options;
using Pilot.Infrastructure.Auth;

namespace Pilot.Api.Services;

/// <summary>
/// Creates and validates signed OAuth state (userId + code_verifier) so the callback can be stateless.
/// </summary>
public class XOAuthStateService
{
    private readonly string _signingKey;

    public XOAuthStateService(IOptions<XOAuthOptions> options, IOptions<JwtOptions> jwtOptions)
    {
        var oauth = options.Value;
        _signingKey = !string.IsNullOrEmpty(oauth.StateSigningSecret) ? oauth.StateSigningSecret : jwtOptions.Value.Secret;
    }

    public string CreateState(string userId, string codeVerifier)
    {
        var payload = new StatePayload { UserId = userId, CodeVerifier = codeVerifier, Exp = DateTimeOffset.UtcNow.AddMinutes(15).ToUnixTimeSeconds() };
        var json = JsonSerializer.Serialize(payload);
        var payloadBytes = Encoding.UTF8.GetBytes(json);
        var payloadB64 = Convert.ToBase64String(payloadBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var sig = HMAC_SHA256(_signingKey, payloadB64);
        return payloadB64 + "." + sig;
    }

    public (string UserId, string CodeVerifier)? ValidateState(string state)
    {
        if (string.IsNullOrEmpty(state)) return null;
        var parts = state.Split('.');
        if (parts.Length != 2) return null;
        var payloadB64 = parts[0];
        var pad = (4 - (payloadB64.Length % 4)) % 4;
        payloadB64 += new string('=', pad);
        payloadB64 = payloadB64.Replace('-', '+').Replace('_', '/');
        var expectedSig = HMAC_SHA256(_signingKey, parts[0]);
        if (expectedSig != parts[1]) return null;
        byte[] bytes;
        try
        {
            bytes = Convert.FromBase64String(payloadB64);
        }
        catch
        {
            return null;
        }
        var json = Encoding.UTF8.GetString(bytes);
        StatePayload? payload;
        try
        {
            payload = JsonSerializer.Deserialize<StatePayload>(json);
        }
        catch
        {
            return null;
        }
        if (payload == null || string.IsNullOrEmpty(payload.UserId) || string.IsNullOrEmpty(payload.CodeVerifier)) return null;
        if (payload.Exp < DateTimeOffset.UtcNow.ToUnixTimeSeconds()) return null;
        return (payload.UserId, payload.CodeVerifier);
    }

    private static string HMAC_SHA256(string key, string data)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(key));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
        return Convert.ToBase64String(hash).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private class StatePayload
    {
        public string UserId { get; set; } = "";
        public string CodeVerifier { get; set; } = "";
        public long Exp { get; set; }
    }
}
