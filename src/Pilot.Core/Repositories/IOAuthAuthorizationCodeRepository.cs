using Pilot.Core.Domain;

namespace Pilot.Core.Repositories;

public interface IOAuthAuthorizationCodeRepository
{
    Task<OAuthAuthorizationCode?> GetByCodeAsync(string code, CancellationToken cancellationToken = default);
    Task<OAuthAuthorizationCode> CreateAsync(OAuthAuthorizationCode code, CancellationToken cancellationToken = default);
    Task UpdateAsync(OAuthAuthorizationCode code, CancellationToken cancellationToken = default);
}
