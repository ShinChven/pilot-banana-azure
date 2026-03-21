namespace Pilot.Infrastructure.Auth;

public class JwtOptions
{
    public const string SectionName = "Auth:Jwt";

    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = "pilot-banana";
    public string Audience { get; set; } = "pilot-banana";
    public int ExpiryMinutes { get; set; } = 60;
}
