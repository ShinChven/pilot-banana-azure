using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using Pilot.Api.Services;
using Pilot.Core.Domain;
using Pilot.Core.DTOs;
using Pilot.Core.Repositories;
using Pilot.Core.Services;

namespace Pilot.Api.Functions;

public record UploadedMedia(string Original, string Optimized, string Thumbnail);

public class PostsUpdateFunction
{
    private readonly IAssetBlobStore _blobStore;
    private readonly IPostRepository _postRepository;
    private readonly IImageOptimizer _imageOptimizer;
    private readonly RequestAuthHelper _authHelper;
    private readonly ILogger<PostsUpdateFunction> _logger;

    public PostsUpdateFunction(
        IAssetBlobStore blobStore,
        IPostRepository postRepository,
        IImageOptimizer imageOptimizer,
        RequestAuthHelper authHelper,
        ILogger<PostsUpdateFunction> logger)
    {
        _blobStore = blobStore;
        _postRepository = postRepository;
        _imageOptimizer = imageOptimizer;
        _authHelper = authHelper;
        _logger = logger;
    }

    [Function("UpdatePost")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "api/users/{userId}/campaigns/{campaignId}/posts/{postId}")] HttpRequest req,
        string userId,
        string campaignId,
        string postId,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null)
            return new UnauthorizedResult();

        if (auth.Value.UserId != userId)
            return new ForbidResult();

        var existingPost = await _postRepository.GetByIdAsync(campaignId, postId, cancellationToken);
        if (existingPost == null || existingPost.CampaignId != campaignId || existingPost.UserId != userId)
            return new NotFoundResult();

        if (!req.HasFormContentType)
            return new BadRequestObjectResult(new { error = "Request must be multipart/form-data." });

        var form = await req.ReadFormAsync(cancellationToken);
        string text = form["text"].FirstOrDefault() ?? string.Empty;
        string statusStr = form["status"].FirstOrDefault() ?? string.Empty;
        string scheduledTimeStr = form["scheduledTime"].FirstOrDefault() ?? string.Empty;
        var files = form.Files;

        var oldMediaUrls = existingPost.MediaUrls?.ToList() ?? new List<string>();

        var mediaUrls = new List<string>();
        var mediaOrderValues = form["mediaOrder"].ToList();

        _logger.LogInformation("UpdatePost: Received mediaOrder: [{MediaOrder}] and {FileCount} files.", string.Join(", ", mediaOrderValues), files.Count);

        async Task<UploadedMedia> UploadFileAsync(IFormFile file)
        {
            var validation = PostMediaRules.ValidateFile(file.ContentType, file.FileName, file.Length);
            if (!validation.IsValid)
                throw new InvalidOperationException(validation.ErrorMessage);

            var ext = Path.GetExtension(file.FileName);
            if (string.IsNullOrEmpty(ext)) ext = ".bin";

            var mediaId = Guid.NewGuid().ToString("N");
            var basePath = $"{userId}/{campaignId}/{mediaId}";
            var blobPath = $"{basePath}{ext}";

            using var stream = file.OpenReadStream();
            var originalUrl = await _blobStore.UploadAsync(blobPath, stream, file.ContentType, cancellationToken);
            _logger.LogInformation("UpdatePost: Uploaded original {FileName} to {AbsoluteUrl}", file.FileName, originalUrl);

            string optimizedUrl = originalUrl;
            string thumbnailUrl = originalUrl;

            if (_imageOptimizer.Supports(file.ContentType))
            {
                try
                {
                    stream.Position = 0;
                    var (optStream, thumbStream) = await _imageOptimizer.CreateAllVersionsAsync(stream, cancellationToken);

                    using (optStream)
                    {
                        optimizedUrl = await _blobStore.UploadAsync($"{basePath}_opt.jpg", optStream, "image/jpeg", cancellationToken);
                    }

                    using (thumbStream)
                    {
                        thumbnailUrl = await _blobStore.UploadAsync($"{basePath}_thumb.jpg", thumbStream, "image/jpeg", cancellationToken);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "UpdatePost: Image optimization failed for {FileName}", file.FileName);
                }
            }

            return new UploadedMedia(originalUrl, optimizedUrl, thumbnailUrl);
        }

        // process files
        var uploadedMedia = new List<UploadedMedia>();
        foreach (var file in files)
        {
            if (file.Length > 0)
            {
                try
                {
                    uploadedMedia.Add(await UploadFileAsync(file));
                }
                catch (InvalidOperationException ex)
                {
                    _logger.LogWarning("UpdatePost: Invalid media file {FileName}: {Message}", file.FileName, ex.Message);
                    return new BadRequestObjectResult(new { error = ex.Message });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Blob upload failed for file {FileName}", file.FileName);
                }
            }
        }

        string CleanUrl(string url)
        {
            if (Uri.TryCreate(url, UriKind.Absolute, out var uri))
            {
                return uri.GetLeftPart(UriPartial.Path);
            }
            return url;
        }

        var newMediaUrls = new List<string>();
        var newOptimizedUrls = new List<string>();
        var newThumbnailUrls = new List<string>();

        // Lookup maps for existing media to find their opt/thumb versions
        var existingOptMap = new Dictionary<string, string>();
        var existingThumbMap = new Dictionary<string, string>();
        
        if (existingPost.MediaUrls != null)
        {
            for (int i = 0; i < existingPost.MediaUrls.Count; i++)
            {
                var orig = CleanUrl(existingPost.MediaUrls[i]);
                if (existingPost.OptimizedUrls != null && i < existingPost.OptimizedUrls.Count)
                    existingOptMap[orig] = CleanUrl(existingPost.OptimizedUrls[i]);
                if (existingPost.ThumbnailUrls != null && i < existingPost.ThumbnailUrls.Count)
                    existingThumbMap[orig] = CleanUrl(existingPost.ThumbnailUrls[i]);
            }
        }

        void AddMedia(string original, string? optimized = null, string? thumbnail = null)
        {
            var cleanOrig = CleanUrl(original);
            if (newMediaUrls.Contains(cleanOrig)) return;

            newMediaUrls.Add(cleanOrig);
            newOptimizedUrls.Add(CleanUrl(optimized ?? existingOptMap.GetValueOrDefault(cleanOrig, original)));
            newThumbnailUrls.Add(CleanUrl(thumbnail ?? existingThumbMap.GetValueOrDefault(cleanOrig, original)));
        }

        if (mediaOrderValues.Any(v => !string.IsNullOrEmpty(v)))
        {
            foreach (var item in mediaOrderValues)
            {
                if (string.IsNullOrEmpty(item)) continue;

                if (item.StartsWith("url:"))
                {
                    AddMedia(item.Substring(4));
                }
                else if (item.StartsWith("file:"))
                {
                    if (int.TryParse(item.Substring(5), out int idx) && idx < uploadedMedia.Count)
                    {
                        var m = uploadedMedia[idx];
                        AddMedia(m.Original, m.Optimized, m.Thumbnail);
                    }
                }
                else if (Uri.TryCreate(item, UriKind.Absolute, out _))
                {
                    AddMedia(item);
                }
            }

            // Append any new files that weren't in mediaOrder
            foreach (var m in uploadedMedia)
            {
                AddMedia(m.Original, m.Optimized, m.Thumbnail);
            }
        }
        else if (form.ContainsKey("mediaOrder") && uploadedMedia.Count == 0)
        {
            // All deleted
        }
        else
        {
            // Fallback: keep existing + append new
            if (existingPost.MediaUrls != null)
            {
                foreach (var url in existingPost.MediaUrls) AddMedia(url);
            }
            foreach (var m in uploadedMedia) AddMedia(m.Original, m.Optimized, m.Thumbnail);
        }

        var finalMediaKinds = newMediaUrls.Select(url => PostMediaRules.Classify(null, url)).ToList();
        var compositionError = PostMediaRules.ValidateComposition(finalMediaKinds);
        if (compositionError != null)
            return new BadRequestObjectResult(new { error = compositionError });

        // Cleanup removed blobs (original, optimized, thumbnail)
        var oldAllUrls = (existingPost.MediaUrls ?? new List<string>())
            .Concat(existingPost.OptimizedUrls ?? new List<string>())
            .Concat(existingPost.ThumbnailUrls ?? new List<string>())
            .Select(CleanUrl)
            .Distinct()
            .ToList();

        var newAllUrls = newMediaUrls
            .Concat(newOptimizedUrls)
            .Concat(newThumbnailUrls)
            .Select(CleanUrl)
            .Distinct()
            .ToList();

        var removedUrls = oldAllUrls.Except(newAllUrls).ToList();
        foreach (var url in removedUrls)
        {
            try { await _blobStore.DeleteAsync(url, cancellationToken); }
            catch (Exception ex) { _logger.LogWarning(ex, "Failed to delete blob {BlobPath}", url); }
        }

        existingPost.MediaUrls = newMediaUrls;
        existingPost.OptimizedUrls = newOptimizedUrls;
        existingPost.ThumbnailUrls = newThumbnailUrls;
        existingPost.Text = string.IsNullOrWhiteSpace(text) ? null : text.Trim();

        if (!string.IsNullOrEmpty(scheduledTimeStr) && DateTimeOffset.TryParse(scheduledTimeStr, out var st))
            existingPost.ScheduledTime = st;
        else if (form.ContainsKey("scheduledTime"))
            existingPost.ScheduledTime = null;

        if (!string.IsNullOrEmpty(statusStr) && Enum.TryParse<PostStatus>(statusStr, true, out var status))
            existingPost.Status = status;

        existingPost.UpdatedAt = DateTimeOffset.UtcNow;
        await _postRepository.UpdateAsync(existingPost, cancellationToken);

        var containerSas = await _blobStore.GetContainerSasAsync(TimeSpan.FromHours(24), cancellationToken);

        async Task<List<string>> ResolveUrlsAsync(List<string> urls)
        {
            var resolved = new List<string>();
            foreach (var url in urls)
            {
                var uri = await _blobStore.GetBlobUriAsync(url, TimeSpan.FromHours(24), cancellationToken);
                var uriString = uri.ToString();
                if (!string.IsNullOrEmpty(containerSas) && !uriString.Contains("?"))
                    uriString = $"{uriString}?{containerSas}";
                resolved.Add(uriString);
            }
            return resolved;
        }

        var responseData = new PostResponse(
            existingPost.Id,
            existingPost.CampaignId,
            existingPost.UserId,
            existingPost.Text,
            await ResolveUrlsAsync(existingPost.MediaUrls),
            await ResolveUrlsAsync(existingPost.OptimizedUrls),
            await ResolveUrlsAsync(existingPost.ThumbnailUrls),
            existingPost.ScheduledTime,
            existingPost.Status,
            existingPost.PlatformData,
            existingPost.CreatedAt,
            existingPost.UpdatedAt
        );

        return new OkObjectResult(responseData);
    }
}
