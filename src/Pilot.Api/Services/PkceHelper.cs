using System.Security.Cryptography;
using System.Text;

namespace Pilot.Api.Services;

public static class PkceHelper
{
    /// <summary>Generate a 43-character code verifier (per PKCE spec).</summary>
    public static string GenerateCodeVerifier()
    {
        var bytes = new byte[32];
        using (var rng = RandomNumberGenerator.Create())
            rng.GetBytes(bytes);
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    /// <summary>Compute S256 code challenge: base64url(sha256(verifier)).</summary>
    public static string ComputeCodeChallengeS256(string codeVerifier)
    {
        var bytes = Encoding.UTF8.GetBytes(codeVerifier);
        var hash = SHA256.HashData(bytes);
        return Convert.ToBase64String(hash).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
}
