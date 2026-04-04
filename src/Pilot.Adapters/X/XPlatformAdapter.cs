using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.IO;
using System.Linq;
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
    private const int UploadChunkSizeBytes = 2 * 1024 * 1024;
    private const int UploadRetryCount = 3;
    // X simple upload body limit is ~5 MB. Base64 inflates by ~33%, so raw target ≈ 3.5 MB.
    private const long XImageTargetBytes = 3_500_000;
    private readonly ISecretStore _secretStore;
    private readonly IDistributedLockService _lockService;
    private readonly IImageOptimizer _imageOptimizer;
    private readonly XAdapterOptions _options;
    private readonly HttpClient _apiClient;
    private readonly HttpClient _uploadClient;
    private readonly HttpClient _downloadClient;
    private readonly ILogger _logger;

    public XPlatformAdapter(
        ISecretStore secretStore,
        IDistributedLockService lockService,
        IImageOptimizer imageOptimizer,
        IOptions<XAdapterOptions> options,
        IHttpClientFactory httpClientFactory,
        ILogger<XPlatformAdapter> logger)
    {
        _secretStore = secretStore;
        _lockService = lockService;
        _imageOptimizer = imageOptimizer;
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

    public async Task<ChannelRefreshResult> RefreshTokenAsync(string channelLinkId, string? tokenSecretName = null, CancellationToken cancellationToken = default)
    {
        var secretName = tokenSecretName ?? $"channellink-{channelLinkId}";
        var token = await GetOrRefreshAccessTokenAsync(channelLinkId, secretName, true, cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrEmpty(token))
        {
            return new ChannelRefreshResult(false);
        }

        var profile = await GetUserProfileAsync(token, cancellationToken).ConfigureAwait(false);
        return new ChannelRefreshResult(
            true,
            DisplayName: profile?.Name,
            Username: profile?.Username,
            AvatarUrl: profile?.ProfileImageUrl
        );
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
            var compositionError = ValidateMediaComposition(request.MediaUrls);
            if (compositionError != null)
                return new PostResult { Success = false, ErrorMessage = compositionError };

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
                mediaType = NormalizeMediaType(resp.Content.Headers.ContentType?.MediaType, assetBlobUrl);
                bytes = await resp.Content.ReadAsByteArrayAsync(cancellationToken).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                return new PostResult { Success = false, ErrorMessage = $"Failed to download asset: {ex.Message}" };
            }

            if (string.IsNullOrEmpty(mediaType))
                return new PostResult { Success = false, ErrorMessage = $"Unsupported X media type for asset: {assetBlobUrl}" };

            // 1. INIT
            var category = GetMediaCategory(mediaType);
            _logger.LogInformation("X media upload starting. Asset: {AssetUrl}. MediaType: {MediaType}. MediaCategory: {MediaCategory}. Bytes: {TotalBytes}.",
                assetBlobUrl, mediaType, category, bytes.Length);

            if (category == "tweet_image")
            {
                return await UploadImageMediaAsync(bytes, mediaType, assetBlobUrl, activeAuth, cancellationToken).ConfigureAwait(false);
            }

            var initPayload = new { total_bytes = bytes.Length, media_type = mediaType, media_category = category };
            _logger.LogInformation("X media INIT payload: total_bytes={TotalBytes}, media_type={MediaType}, media_category={MediaCategory}.",
                bytes.Length, mediaType, category);
            var (initStatusCode, initText) = await SendUploadRequestWithRetryAsync(
                () => new HttpRequestMessage(HttpMethod.Post, "2/media/upload/initialize")
                {
                    Content = JsonContent.Create(initPayload),
                    Headers = { Authorization = activeAuth }
                },
                "INIT",
                cancellationToken).ConfigureAwait(false);
            if ((int)initStatusCode < 200 || (int)initStatusCode > 299) return CreateUploadError(initStatusCode, initText, "INIT");

            string? mediaId = null;
            try { using var doc = JsonDocument.Parse(initText); if (doc.RootElement.TryGetProperty("data", out var data) && data.TryGetProperty("id", out var id)) mediaId = id.GetString(); } catch { }
            if (string.IsNullOrEmpty(mediaId)) return new PostResult { Success = false, ErrorMessage = "X media upload (INIT) did not return media id." };

            // 2. APPEND
            for (var offset = 0; offset < bytes.Length; offset += UploadChunkSizeBytes)
            {
                var chunkSize = Math.Min(UploadChunkSizeBytes, bytes.Length - offset);
                var chunk = new byte[chunkSize];
                Buffer.BlockCopy(bytes, offset, chunk, 0, chunkSize);
                _logger.LogDebug("X media APPEND chunk. MediaId: {MediaId}. SegmentIndex: {SegmentIndex}. ChunkBytes: {ChunkBytes}.",
                    mediaId, offset / UploadChunkSizeBytes, chunkSize);
                var (appendStatusCode, appendText) = await SendUploadRequestWithRetryAsync(
                    () => new HttpRequestMessage(HttpMethod.Post, $"2/media/upload/{mediaId}/append")
                    {
                        Content = JsonContent.Create(new
                        {
                            media = Convert.ToBase64String(chunk),
                            segment_index = offset / UploadChunkSizeBytes
                        }),
                        Headers = { Authorization = activeAuth }
                    },
                    $"APPEND[{offset / UploadChunkSizeBytes}]",
                    cancellationToken).ConfigureAwait(false);
                if ((int)appendStatusCode < 200 || (int)appendStatusCode > 299) return CreateUploadError(appendStatusCode, appendText, "APPEND");
            }

            // 3. FINALIZE
            var (finalizeStatusCode, finalizeText) = await SendUploadRequestWithRetryAsync(
                () => new HttpRequestMessage(HttpMethod.Post, $"2/media/upload/{mediaId}/finalize")
                {
                    Headers = { Authorization = activeAuth }
                },
                "FINALIZE",
                cancellationToken).ConfigureAwait(false);
            if ((int)finalizeStatusCode < 200 || (int)finalizeStatusCode > 299) return CreateUploadError(finalizeStatusCode, finalizeText, "FINALIZE");

            var finalizeState = GetProcessingState(finalizeText, out var finalizeCheckAfterSecs, out var finalizeError);
            if (!string.IsNullOrEmpty(finalizeError))
                return new PostResult { Success = false, ErrorMessage = $"X media processing failed: {finalizeError}" };

            if (RequiresStatusPolling(finalizeState))
            {
                var pollResult = await WaitForMediaReadyAsync(mediaId, activeAuth, finalizeCheckAfterSecs, cancellationToken).ConfigureAwait(false);
                if (!pollResult.Success)
                    return pollResult;
            }

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

    private async Task<PostResult> UploadImageMediaAsync(
        byte[] bytes,
        string mediaType,
        string assetBlobUrl,
        AuthenticationHeaderValue authHeader,
        CancellationToken cancellationToken)
    {
        byte[] uploadBytes = bytes;
        string uploadMediaType = mediaType;

        if (bytes.Length > XImageTargetBytes && _imageOptimizer.Supports(mediaType))
        {
            try
            {
                await using var input = new MemoryStream(bytes, writable: false);
                var (optimized, optimizedContentType) = await _imageOptimizer.CreateXUploadAsync(input, XImageTargetBytes, cancellationToken).ConfigureAwait(false);
                await using (optimized)
                {
                    using var output = new MemoryStream();
                    await optimized.CopyToAsync(output, cancellationToken).ConfigureAwait(false);
                    uploadBytes = output.ToArray();
                }
                uploadMediaType = optimizedContentType;
                _logger.LogInformation("X image adapted for upload. Asset: {AssetUrl}. OriginalBytes: {OriginalBytes}. UploadBytes: {UploadBytes}. UploadMediaType: {UploadMediaType}.",
                    assetBlobUrl, bytes.Length, uploadBytes.Length, uploadMediaType);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "X image adaptation failed for {AssetUrl}. Falling back to original bytes.", assetBlobUrl);
            }
        }

        var payload = new
        {
            media = Convert.ToBase64String(uploadBytes),
            media_category = "tweet_image",
            media_type = uploadMediaType,
            shared = false
        };

        _logger.LogInformation("X image upload payload: media_bytes={TotalBytes}, media_type={MediaType}, media_category=tweet_image.",
            uploadBytes.Length, uploadMediaType);

        var (statusCode, responseText) = await SendUploadRequestWithRetryAsync(
            () => new HttpRequestMessage(HttpMethod.Post, "2/media/upload")
            {
                Content = JsonContent.Create(payload),
                Headers = { Authorization = authHeader }
            },
            "UPLOAD_IMAGE",
            cancellationToken).ConfigureAwait(false);

        if ((int)statusCode < 200 || (int)statusCode > 299)
            return CreateUploadError(statusCode, responseText, "UPLOAD_IMAGE");

        string? mediaId = null;
        try
        {
            using var doc = JsonDocument.Parse(responseText);
            if (doc.RootElement.TryGetProperty("data", out var data) && data.TryGetProperty("id", out var id))
                mediaId = id.GetString();
        }
        catch
        {
            // best effort
        }

        if (string.IsNullOrEmpty(mediaId))
            return new PostResult { Success = false, ErrorMessage = $"X image upload did not return media id for asset: {assetBlobUrl}" };

        return new PostResult { Success = true, ExternalPostId = mediaId };
    }

    private async Task<PostResult> WaitForMediaReadyAsync(string mediaId, AuthenticationHeaderValue authHeader, int? initialDelaySecs, CancellationToken cancellationToken)
    {
        var delaySecs = Math.Clamp(initialDelaySecs ?? 1, 1, 10);

        for (var attempt = 0; attempt < 30; attempt++)
        {
            await Task.Delay(TimeSpan.FromSeconds(delaySecs), cancellationToken).ConfigureAwait(false);

            var (statusCode, text) = await SendUploadRequestWithRetryAsync(
                () => new HttpRequestMessage(HttpMethod.Get, $"2/media/upload?command=STATUS&media_id={Uri.EscapeDataString(mediaId)}")
                {
                    Headers = { Authorization = authHeader }
                },
                "STATUS",
                cancellationToken).ConfigureAwait(false);
            if ((int)statusCode < 200 || (int)statusCode > 299)
                return CreateUploadError(statusCode, text, "STATUS");

            var state = GetProcessingState(text, out var nextDelaySecs, out var errorMessage);
            if (!string.IsNullOrEmpty(errorMessage))
                return new PostResult { Success = false, ErrorMessage = $"X media processing failed: {errorMessage}" };

            if (string.Equals(state, "succeeded", StringComparison.OrdinalIgnoreCase))
                return new PostResult { Success = true, ExternalPostId = mediaId };

            if (string.Equals(state, "failed", StringComparison.OrdinalIgnoreCase))
                return new PostResult { Success = false, ErrorMessage = "X media processing failed." };

            delaySecs = Math.Clamp(nextDelaySecs ?? 1, 1, 10);
        }

        return new PostResult { Success = false, ErrorMessage = "X media processing timed out before completion." };
    }

    private async Task<(System.Net.HttpStatusCode StatusCode, string ResponseText)> SendUploadRequestWithRetryAsync(
        Func<HttpRequestMessage> requestFactory,
        string step,
        CancellationToken cancellationToken)
    {
        System.Net.HttpStatusCode lastStatusCode = 0;
        string lastResponseText = string.Empty;

        for (var attempt = 1; attempt <= UploadRetryCount; attempt++)
        {
            try
            {
                using var req = requestFactory();
                var requestSummary = DescribeUploadRequest(req);
                using var resp = await _uploadClient.SendAsync(req, cancellationToken).ConfigureAwait(false);
                var text = await resp.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
                var responseHeaders = SummarizeHeaders(resp.Headers, resp.Content.Headers);

                if (!ShouldRetryUploadStep(resp.StatusCode) || attempt == UploadRetryCount)
                {
                    if ((int)resp.StatusCode < 200 || (int)resp.StatusCode > 299)
                    {
                        _logger.LogWarning("X media upload step {Step} failed with {StatusCode}. Request: {RequestSummary}. ResponseHeaders: {ResponseHeaders}. Body: {Body}",
                            step, (int)resp.StatusCode, requestSummary, responseHeaders, text);
                    }
                    return (resp.StatusCode, text);
                }

                lastStatusCode = resp.StatusCode;
                lastResponseText = text;
                var delay = GetRetryDelay(attempt, resp.Headers.RetryAfter?.Delta);
                _logger.LogWarning("X media upload step {Step} returned {StatusCode}. Retrying in {DelayMs}ms (attempt {Attempt}/{MaxAttempts}). Request: {RequestSummary}. ResponseHeaders: {ResponseHeaders}. Body: {Body}",
                    step, (int)resp.StatusCode, (int)delay.TotalMilliseconds, attempt, UploadRetryCount, requestSummary, responseHeaders, text);
                await Task.Delay(delay, cancellationToken).ConfigureAwait(false);
            }
            catch (HttpRequestException ex) when (attempt < UploadRetryCount)
            {
                var delay = GetRetryDelay(attempt, null);
                _logger.LogWarning(ex, "X media upload step {Step} failed with network error. Retrying in {DelayMs}ms (attempt {Attempt}/{MaxAttempts}).",
                    step, (int)delay.TotalMilliseconds, attempt, UploadRetryCount);
                await Task.Delay(delay, cancellationToken).ConfigureAwait(false);
            }
        }

        return (lastStatusCode, lastResponseText);
    }

    private static string DescribeUploadRequest(HttpRequestMessage req)
    {
        var parts = new List<string> { $"{req.Method} {req.RequestUri}" };

        if (req.Content != null)
        {
            parts.Add($"content_type={req.Content.Headers.ContentType}");
            if (req.Content is MultipartFormDataContent multipart)
            {
                var multipartParts = multipart
                    .Select(part =>
                    {
                        var name = part.Headers.ContentDisposition?.Name ?? "?";
                        var fileName = part.Headers.ContentDisposition?.FileName;
                        var kind = fileName != null ? "file" : "field";
                        var length = part.Headers.ContentLength?.ToString() ?? "?";
                        return $"{name}:{kind}:{length}";
                    });
                parts.Add($"multipart_parts=[{string.Join(", ", multipartParts)}]");
            }
        }

        return string.Join("; ", parts);
    }

    private static string SummarizeHeaders(HttpHeaders responseHeaders, HttpContentHeaders contentHeaders)
    {
        static bool Include(string key) =>
            key.StartsWith("x-", StringComparison.OrdinalIgnoreCase) ||
            key.StartsWith("rate-limit", StringComparison.OrdinalIgnoreCase) ||
            key.StartsWith("x-rate-limit", StringComparison.OrdinalIgnoreCase) ||
            key.Equals("retry-after", StringComparison.OrdinalIgnoreCase);

        var headerPairs = responseHeaders
            .Concat(contentHeaders)
            .Where(h => Include(h.Key))
            .Select(h => $"{h.Key}={string.Join("|", h.Value)}");

        var summary = string.Join("; ", headerPairs);
        return string.IsNullOrEmpty(summary) ? "(none)" : summary;
    }

    private static bool ShouldRetryUploadStep(System.Net.HttpStatusCode statusCode) =>
        (int)statusCode == 429 || (int)statusCode >= 500;

    private static TimeSpan GetRetryDelay(int attempt, TimeSpan? retryAfter)
    {
        if (retryAfter.HasValue && retryAfter.Value > TimeSpan.Zero)
            return retryAfter.Value;

        var delayMs = attempt switch
        {
            1 => 1000,
            2 => 2500,
            _ => 5000
        };
        return TimeSpan.FromMilliseconds(delayMs);
    }

    private static bool RequiresStatusPolling(string? state) =>
        string.Equals(state, "pending", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(state, "in_progress", StringComparison.OrdinalIgnoreCase);

    private static string? GetProcessingState(string responseText, out int? checkAfterSecs, out string? errorMessage)
    {
        checkAfterSecs = null;
        errorMessage = null;

        try
        {
            using var doc = JsonDocument.Parse(responseText);
            if (doc.RootElement.TryGetProperty("data", out var data) &&
                data.TryGetProperty("processing_info", out var processingInfo))
            {
                if (processingInfo.TryGetProperty("check_after_secs", out var checkAfter) && checkAfter.TryGetInt32(out var parsed))
                    checkAfterSecs = parsed;

                if (processingInfo.TryGetProperty("error", out var error))
                    errorMessage = error.ToString();

                if (processingInfo.TryGetProperty("state", out var state))
                    return state.GetString();
            }
        }
        catch
        {
            // Best effort parsing; no processing state means media is ready.
        }

        return null;
    }

    private static string? NormalizeMediaType(string? contentType, string? assetBlobUrl)
    {
        if (!string.IsNullOrWhiteSpace(contentType))
            return contentType;

        var ext = Path.GetExtension((assetBlobUrl ?? string.Empty).Split('?')[0]).ToLowerInvariant();
        return ext switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            ".gif" => "image/gif",
            ".mp4" => "video/mp4",
            _ => null
        };
    }

    private static string GetMediaCategory(string mediaType)
    {
        if (string.Equals(mediaType, "image/gif", StringComparison.OrdinalIgnoreCase))
            return "tweet_gif";
        if (mediaType.StartsWith("video/", StringComparison.OrdinalIgnoreCase))
            return "tweet_video";
        return "tweet_image";
    }

    private static string? ValidateMediaComposition(IEnumerable<string> mediaUrls)
    {
        var kinds = mediaUrls
            .Take(4)
            .Select(url =>
            {
                var mediaType = NormalizeMediaType(null, url);
                return mediaType == null ? null : GetMediaCategory(mediaType);
            })
            .ToList();

        if (kinds.Any(k => k == null))
            return "Unsupported X media type.";

        return null;
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

    private async Task<XUserProfile?> GetUserProfileAsync(string accessToken, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, "2/users/me?user.fields=name,username,profile_image_url");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        try
        {
            using var response = await _apiClient.SendAsync(req, ct).ConfigureAwait(false);
            var json = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("X users/me lookup after refresh failed with {Status}: {Body}", response.StatusCode, json);
                return null;
            }

            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("data", out var data))
            {
                return null;
            }

            return new XUserProfile(
                data.TryGetProperty("name", out var name) ? name.GetString() : null,
                data.TryGetProperty("username", out var username) ? username.GetString() : null,
                data.TryGetProperty("profile_image_url", out var avatarUrl) ? avatarUrl.GetString() : null
            );
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "X users/me lookup after refresh failed.");
            return null;
        }
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

    private sealed record XUserProfile(string? Name, string? Username, string? ProfileImageUrl);
}
