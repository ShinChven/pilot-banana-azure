using System.Collections.Concurrent;

namespace Pilot.Api.Services;

public class PasskeyChallengeService
{
    private readonly ConcurrentDictionary<string, (string Challenge, DateTimeOffset CreatedAt)> _challenges = new();

    public string CreateChallenge(string key)
    {
        var challenge = Guid.NewGuid().ToString("N");
        _challenges[key] = (challenge, DateTimeOffset.UtcNow);
        return challenge;
    }

    public string? GetChallenge(string key)
    {
        if (_challenges.TryRemove(key, out var entry))
        {
            if (DateTimeOffset.UtcNow - entry.CreatedAt < TimeSpan.FromMinutes(5))
            {
                return entry.Challenge;
            }
        }
        return null;
    }
}
