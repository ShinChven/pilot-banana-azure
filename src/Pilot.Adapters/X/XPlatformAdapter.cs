using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Pilot.Core.Adapters;
using Pilot.Core.Domain;
using Pilot.Core.Services;

namespace Pilot.Adapters.X;

/// <summary>
/// X (Twitter) platform adapter. Uses OAuth 2.0 Bearer token from ISecretStore (secret name from ChannelLink.TokenSecretName or "channellink-{channelLinkId}").
/// Implements JIT token refresh with distributed locking.
/// </summary>
public class XPlatformAdapter : IPlatformAdapter
{
    private readonly ISecretStore _secretStore;
    private readonly IDistributedLockService _lockService;
    private readonly XAdapterOptions _options;
    private readonly HttpClient _apiClient;
    private readonly HttpClient _uploadClient;
    private readonly HttpClient _downloadClient;
    private readonly ILogger _logger;

    public XPlatformAdapter(
        ISecretStore secretStore,
        IDistributedLockService lockService,
        IOptions<XAdapterOptions> options,
        IHttpClientFactory httpClientFactory,
        ILogger<XPlatformAdapter> logger)
    {
        _secretStore = secretStore;
        _lockService = lockService;
        _options = options.Value;
        _apiClient = httpClientFactory.CreateClient("X.Api");
        _uploadClient = httpClientFactory.CreateClient("X.Upload");
        _downloadClient = httpClientFactory.CreateClient("Pilot.AssetDownload");
        _logger = logger;
    }

    public string PlatformId => ChannelPlatform.X;

    public async Task<PostResult> PublishAsync(PostRequest request, string channelLinkId, string? tokenSecretName = null, CancellationToken cancellationToken = default)
    {
        var secretName = tokenSecretName ?? $"channellink-{channelLinkId}";
        
        // Try initial attempt
        var result = await PublishInternalAsync(request, channelLinkId, secretName, false, cancellationToken).ConfigureAwait(false);
        
        // If 401/403 (token error), refresh and retry once
        if (!result.Success && result.ErrorMessage != null && (result.ErrorMessage.Contains("(401)") || result.ErrorMessage.Contains("(403)") || result.ErrorMessage.Contains("Unsupported Authentication")))
        {
            _logger.LogInformation("X publish failed with potential token error. Attempting JIT refresh for {ChannelId}...", channelLinkId);
            result = await PublishInternalAsync(request, channelLinkId, secretName, true, cancellationToken).ConfigureAwait(false);
        }

        return result;
    }

    public async Task<bool> RefreshTokenAsync(string channelLinkId, string? tokenSecretName = null, CancellationToken cancellationToken = default)
    {
        var secretName = tokenSecretName ?? $"channellink-{channelLinkId}";
        var token = await GetOrRefreshAccessTokenAsync(channelLinkId, secretName, true, cancellationToken).ConfigureAwait(false);
        return !string.IsNullOrEmpty(token);
    }

    private async Task<PostResult> PublishInternalAsync(PostRequest request, string channelLinkId, string secretName, bool forceRefresh, CancellationToken cancellationToken)
    {
        var token = await GetOrRefreshAccessTokenAsync(channelLinkId, secretName, forceRefresh, cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrEmpty(token))
            return new PostResult { Success = false, ErrorMessage = "No token found for channel link." };

        var authHeader = new AuthenticationHeaderValue("Bearer", token);

        var mediaIds = new List<string>();
        if (request.MediaUrls != null && request.MediaUrls.Any())
        {
            foreach (var url in request.MediaUrls.Take(4))
            {
                var uploadResult = await UploadMediaAsync(url, authHeader, channelLinkId, secretName, cancellationToken).ConfigureAwait(false);
                if (uploadResult.Success && !string.IsNullOrEmpty(uploadResult.ExternalPostId))
                {
                    mediaIds.Add(uploadResult.ExternalPostId);
                }
                else
                {
                    return uploadResult;
                }
            }
        }

        var text = TruncateText(request.Text, 280);
        if (string.IsNullOrEmpty(text) && !mediaIds.Any())
            return new PostResult { Success = false, ErrorMessage = "Tweet must have text or media." };

        var body = new Dictionary<string, object?>
        {
            ["text"] = text ?? ""
        };
        if (mediaIds.Any())
            body["media"] = new { media_ids = mediaIds };

        using var req = new HttpRequestMessage(HttpMethod.Post, "2/tweets")
        {
            Content = JsonContent.Create(body, options: new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }),
            Headers = { Authorization = authHeader }
        };
        using var response = await _apiClient.SendAsync(req, cancellationToken).ConfigureAwait(false);
        var responseText = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);

        if (!response.IsSuccessStatusCode)
            return new PostResult { Success = false, ErrorMessage = $"X API error ({(int)response.StatusCode}): {responseText}" };

        string? tweetId = null;
        try
        {
            using var doc = JsonDocument.Parse(responseText);
            if (doc.RootElement.TryGetProperty("data", out var data) && data.TryGetProperty("id", out var id))
                tweetId = id.GetString();
        }
        catch { /* best effort */ }

        var postUrl = !string.IsNullOrEmpty(tweetId) ? $"https://x.com/i/status/{tweetId}" : null;
        return new PostResult { Success = true, ExternalPostId = tweetId, PostUrl = postUrl };
    }

    private async Task<PostResult> UploadMediaAsync(string assetBlobUrl, AuthenticationHeaderValue authHeader, string channelLinkId, string secretName, CancellationToken cancellationToken)
    {
        // Internal helper to perform upload steps
        async Task<PostResult> DoUpload(AuthenticationHeaderValue activeAuth)
        {
            byte[] bytes;
            string? mediaType = null;
            try
            {
                using var resp = await _downloadClient.GetAsync(assetBlobUrl, cancellationToken).ConfigureAwait(false);
                resp.EnsureSuccessStatusCode();
                mediaType = resp.Content.Headers.ContentType?.MediaType;
                bytes = await resp.Content.ReadAsByteArrayAsync(cancellationToken).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                return new PostResult { Success = false, ErrorMessage = $"Failed to download asset: {ex.Message}" };
            }

            // 1. INIT
            var category = "tweet_image";
            if (mediaType != null)
            {
                if (mediaType.Contains("video")) category = "tweet_video";
                else if (mediaType.Contains("gif")) category = "tweet_gif";
            }

            var initPayload = new { total_bytes = bytes.Length, media_type = mediaType ?? "image/jpeg", media_category = category };
            using var initReq = new HttpRequestMessage(HttpMethod.Post, "2/media/upload/initialize") { Content = JsonContent.Create(initPayload), Headers = { Authorization = activeAuth } };
            using var initResp = await _uploadClient.SendAsync(initReq, cancellationToken).ConfigureAwait(false);
            var initText = await initResp.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            if (!initResp.IsSuccessStatusCode) return CreateUploadError(initResp.StatusCode, initText, "INIT");

            string? mediaId = null;
            try { using var doc = JsonDocument.Parse(initText); if (doc.RootElement.TryGetProperty("data", out var data) && data.TryGetProperty("id", out var id)) mediaId = id.GetString(); } catch { }
            if (string.IsNullOrEmpty(mediaId)) return new PostResult { Success = false, ErrorMessage = "X media upload (INIT) did not return media id." };

            // 2. APPEND
            var appendPayload = new { media = Convert.ToBase64String(bytes), segment_index = 0 };
            using var appendReq = new HttpRequestMessage(HttpMethod.Post, $"2/media/upload/{mediaId}/append") { Content = JsonContent.Create(appendPayload), Headers = { Authorization = activeAuth } };
            using var appendResp = await _uploadClient.SendAsync(appendReq, cancellationToken).ConfigureAwait(false);
            var appendText = await appendResp.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            if (!appendResp.IsSuccessStatusCode) return CreateUploadError(appendResp.StatusCode, appendText, "APPEND");

            // 3. FINALIZE
            using var finalizeReq = new HttpRequestMessage(HttpMethod.Post, $"2/media/upload/{mediaId}/finalize") { Headers = { Authorization = activeAuth } };
            using var finalizeResp = await _uploadClient.SendAsync(finalizeReq, cancellationToken).ConfigureAwait(false);
            var finalizeText = await finalizeResp.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            if (!finalizeResp.IsSuccessStatusCode) return CreateUploadError(finalizeResp.StatusCode, finalizeText, "FINALIZE");

            return new PostResult { Success = true, ExternalPostId = mediaId };
        }

        var result = await DoUpload(authHeader).ConfigureAwait(false);
        
        // If 401/403 (token error), refresh and retry once
        if (!result.Success && result.ErrorMessage != null && (result.ErrorMessage.Contains("(401)") || result.ErrorMessage.Contains("(403)") || result.ErrorMessage.Contains("Unsupported Authentication")))
        {
            _logger.LogInformation("X media upload failed with potential token error. Attempting JIT refresh for {ChannelId}...", channelLinkId);
            var newToken = await GetOrRefreshAccessTokenAsync(channelLinkId, secretName, true, cancellationToken).ConfigureAwait(false);
            if (!string.IsNullOrEmpty(newToken))
            {
                result = await DoUpload(new AuthenticationHeaderValue("Bearer", newToken)).ConfigureAwait(false);
            }
        }

        return result;
    }

    private async Task<string?> GetOrRefreshAccessTokenAsync(string channelLinkId, string secretName, bool forceRefresh, CancellationToken ct)
    {
        var raw = await _secretStore.GetSecretAsync(secretName, ct).ConfigureAwait(false);
        if (string.IsNullOrEmpty(raw)) return null;

        var tokenData = TryParseTokenData(raw);
        var isExpired = tokenData?.ExpiresAt != null && tokenData.ExpiresAt <= DateTimeOffset.UtcNow.AddMinutes(5);

        if (!forceRefresh && !isExpired) return tokenData?.AccessToken ?? raw ?? "";

        _logger.LogInformation("X token refresh triggered for channel {ChannelId} (Secret: {SecretName}, Force: {ForceRefresh}, Expired: {IsExpired})", 
            channelLinkId, secretName, forceRefresh, isExpired);

        // Thundering Herd Protection: Acquire Distributed Lock
        var lockName = $"x-refresh-{channelLinkId}";
        var lockToken = await _lockService.AcquireLockAsync(lockName, TimeSpan.FromSeconds(30), ct).ConfigureAwait(false);
        
        if (lockToken == null)
        {
            _logger.LogDebug("X token refresh lock already held by another process for {ChannelId}. Waiting 3s...", channelLinkId);
            // Someone else is refreshing. Wait 3s and re-read.
            await Task.Delay(3000, ct).ConfigureAwait(false);
            var updatedRaw = await _secretStore.GetSecretAsync(secretName, ct).ConfigureAwait(false);
            return ResolveAccessToken(updatedRaw);
        }

        try
        {
            // Double-Check: Re-read secret in case it was refreshed while we waited for lock
            var currentRaw = await _secretStore.GetSecretAsync(secretName, ct).ConfigureAwait(false);
            if (currentRaw != raw && !string.IsNullOrEmpty(currentRaw))
            {
                _logger.LogDebug("X token was refreshed by another process while waiting for lock for {ChannelId}.", channelLinkId);
                return ResolveAccessToken(currentRaw);
            }

            // Perform actual refresh
            var currentTokenData = TryParseTokenData(currentRaw ?? raw);
            if (string.IsNullOrEmpty(currentTokenData?.RefreshToken))
            {
                _logger.LogWarning("X token refresh failed: No refresh token found in secret store for {ChannelId}.", channelLinkId);
                // If we were forcing refresh because of a 401, returning the old token is useless.
                return forceRefresh || isExpired ? null : ResolveAccessToken(currentRaw ?? raw);
            }

            var refreshed = await CallXRefreshEndpointAsync(currentTokenData.RefreshToken, ct).ConfigureAwait(false);
            if (refreshed != null)
            {
                // If X didn't return a new refresh token (unlikely for v2 but possible), preserve the old one
                if (string.IsNullOrEmpty(refreshed.RefreshToken))
                {
                    refreshed.RefreshToken = currentTokenData.RefreshToken;
                }

                var newRaw = JsonSerializer.Serialize(refreshed);
                await _secretStore.SetSecretAsync(secretName, newRaw, ct).ConfigureAwait(false);
                _logger.LogInformation("X token successfully refreshed and saved for {ChannelId}.", channelLinkId);
                return refreshed.AccessToken;
            }
            
            _logger.LogError("X token refresh failed to return new tokens for {ChannelId}.", channelLinkId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "X token refresh encountered an exception for {ChannelId}.", channelLinkId);
        }
        finally
        {
            await _lockService.ReleaseLockAsync(lockName, lockToken, ct).ConfigureAwait(false);
        }

        // If we got here, refresh failed. If it was a forced refresh or clearly expired, return null to signal failure.
        return forceRefresh || isExpired ? null : ResolveAccessToken(await _secretStore.GetSecretAsync(secretName, ct).ConfigureAwait(false));
    }

    private async Task<TokenData?> CallXRefreshEndpointAsync(string refreshToken, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(_options.ClientId) || string.IsNullOrEmpty(_options.ClientSecret))
        {
            _logger.LogError("X token refresh aborted: ClientId or ClientSecret is missing in configuration.");
            return null;
        }

        var body = new Dictionary<string, string>
        {
            ["grant_type"] = "refresh_token",
            ["refresh_token"] = refreshToken,
            ["client_id"] = _options.ClientId // X v2 often expects client_id in body too
        };
        
        using var req = new HttpRequestMessage(HttpMethod.Post, $"{XAdapterOptions.BaseUrl}/2/oauth2/token")
        {
            Content = new FormUrlEncodedContent(body)
        };
        
        var authBytes = System.Text.Encoding.UTF8.GetBytes($"{_options.ClientId}:{_options.ClientSecret}");
        req.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(authBytes));

        try
        {
            using var resp = await _apiClient.SendAsync(req, ct).ConfigureAwait(false);
            var json = await resp.Content.ReadAsStringAsync(ct).ConfigureAwait(false);

            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogError("X token refresh endpoint returned {Status}: {Body}", resp.StatusCode, json);
                return null;
            }

            var refreshed = JsonSerializer.Deserialize<TokenData>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            
            if (refreshed == null || string.IsNullOrEmpty(refreshed.AccessToken))
            {
                _logger.LogError("X token refresh endpoint returned success but tokens were missing or failed to deserialize: {Body}", json);
                return null;
            }

            if (refreshed.ExpiresIn.HasValue && !refreshed.ExpiresAt.HasValue)
            {
                refreshed.ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(refreshed.ExpiresIn.Value);
            }

            return refreshed;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "X token refresh HTTP call failed.");
            return null;
        }
    }

    private static PostResult CreateUploadError(System.Net.HttpStatusCode statusCode, string responseText, string step)
    {
        var error = $"X media upload error ({step}, {(int)statusCode}): {responseText}";
        if (statusCode == System.Net.HttpStatusCode.Forbidden)
        {
            error += " Reconnect X account with media scope (media.write) and verify your X app has media upload permission.";
        }

        return new PostResult { Success = false, ErrorMessage = error };
    }

    private static string ResolveAccessToken(string? raw)
    {
        var data = TryParseTokenData(raw);
        return data?.AccessToken ?? raw ?? "";
    }

    private static TokenData? TryParseTokenData(string? raw)
    {
        if (string.IsNullOrEmpty(raw) || !raw.TrimStart().StartsWith("{")) return null;
        try
        {
            return JsonSerializer.Deserialize<TokenData>(raw, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch { return null; }
    }

    private static string? TruncateText(string? text, int maxLength)
    {
        if (string.IsNullOrEmpty(text)) return text;
        if (text.Length <= maxLength) return text;
        return text[..maxLength];
    }
}
