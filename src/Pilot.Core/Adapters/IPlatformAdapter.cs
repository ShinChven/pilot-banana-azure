namespace Pilot.Core.Adapters;

/// <summary>
/// Adapter for publishing to a social platform. X (Twitter) at launch; more channels implement this later.
/// </summary>
public interface IPlatformAdapter
{
    /// <summary>Platform id, e.g. <see cref="Domain.ChannelPlatform.X"/>.</summary>
    string PlatformId { get; }

    /// <summary>Publish a single post. Token retrieval (e.g. from Key Vault) is adapter responsibility.</summary>
    /// <param name="tokenSecretName">Key Vault secret name for the channel token; when null, uses convention "channellink-{channelLinkId}".</param>
    Task<PostResult> PublishAsync(PostRequest request, string channelLinkId, string? tokenSecretName = null, CancellationToken cancellationToken = default);

    /// <summary>Manually trigger a token refresh for a specific channel and return any updated profile metadata.</summary>
    Task<ChannelRefreshResult> RefreshTokenAsync(string channelLinkId, string? tokenSecretName = null, CancellationToken cancellationToken = default);
}
