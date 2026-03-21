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

namespace Pilot.Api.Functions;

public class PostsUpdateFunction
{
    private readonly IAssetBlobStore _blobStore;
    private readonly IPostRepository _postRepository;
    private readonly RequestAuthHelper _authHelper;
    private readonly ILogger<PostsUpdateFunction> _logger;

    public PostsUpdateFunction(
        IAssetBlobStore blobStore,
        IPostRepository postRepository,
        RequestAuthHelper authHelper,
        ILogger<PostsUpdateFunction> logger)
    {
        _blobStore = blobStore;
        _postRepository = postRepository;
        _authHelper = authHelper;
        _logger = logger;
    }

    [Function("UpdatePost")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "users/{userId}/campaigns/{campaignId}/posts/{postId}")] HttpRequest req,
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

        async Task<string> UploadFileAsync(IFormFile file)
        {
            var ext = Path.GetExtension(file.FileName);
            if (string.IsNullOrEmpty(ext)) ext = ".bin";

            var mediaId = Guid.NewGuid().ToString("N");
            var blobPath = $"{userId}/{campaignId}/{mediaId}{ext}";

            using var stream = file.OpenReadStream();
            var absoluteUrl = await _blobStore.UploadAsync(blobPath, stream, file.ContentType, cancellationToken);
            _logger.LogInformation("UpdatePost: Uploaded file {FileName} to {AbsoluteUrl}", file.FileName, absoluteUrl);
            return absoluteUrl;
        }

        // process files
        var uploadedUrls = new List<string>();
        foreach (var file in files)
        {
            if (file.Length > 0)
            {
                try
                {
                    uploadedUrls.Add(await UploadFileAsync(file));
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
                // Strip query string (Token) before saving to DB
                return uri.GetLeftPart(UriPartial.Path);
            }
            return url;
        }

        if (mediaOrderValues.Any(v => !string.IsNullOrEmpty(v)))
        {
            // The frontend sends existing URLs in mediaOrder.
            // New files are expected to be appended if not explicitly in mediaOrder (current PostForm.tsx behavior).
            foreach (var item in mediaOrderValues)
            {
                if (string.IsNullOrEmpty(item)) continue;

                if (item.StartsWith("url:"))
                {
                    mediaUrls.Add(CleanUrl(item.Substring(4)));
                }
                else if (item.StartsWith("file:"))
                {
                    if (int.TryParse(item.Substring(5), out int idx) && idx < uploadedUrls.Count)
                    {
                        mediaUrls.Add(CleanUrl(uploadedUrls[idx]));
                    }
                }
                else if (Uri.TryCreate(item, UriKind.Absolute, out _))
                {
                    mediaUrls.Add(CleanUrl(item));
                }
            }

            // If new files were uploaded but weren't explicitly in mediaOrder (common in many UI implementations),
            // append them to ensure they aren't lost.
            foreach (var uploadedUrl in uploadedUrls)
            {
                var cleaned = CleanUrl(uploadedUrl);
                if (!mediaUrls.Contains(cleaned))
                {
                    mediaUrls.Add(cleaned);
                }
            }

            existingPost.MediaUrls = mediaUrls;
        }
        else if (form.ContainsKey("mediaOrder") && uploadedUrls.Count == 0)
        {
            // Empty mediaOrder list sent and NO new files, means all images deleted
            _logger.LogInformation("UpdatePost: mediaOrder is present but empty and no new files, clearing all media.");
            existingPost.MediaUrls = new List<string>();
        }
        else if (uploadedUrls.Any())
        {
            // If we have new files but no valid mediaOrder, append them to existing
            var currentMedia = existingPost.MediaUrls ?? new List<string>();
            foreach (var uploadedUrl in uploadedUrls)
            {
                var cleaned = CleanUrl(uploadedUrl);
                if (!currentMedia.Contains(cleaned))
                {
                    currentMedia.Add(cleaned);
                }
            }
            existingPost.MediaUrls = currentMedia.Distinct().ToList();
            _logger.LogInformation("UpdatePost: Added {Count} new files to existing media via fallback.", uploadedUrls.Count);
        }

        var currentMediaUrls = existingPost.MediaUrls ?? new List<string>();
        _logger.LogInformation("UpdatePost: New mediaUrls: [{MediaUrls}]", string.Join(", ", currentMediaUrls));

        // Cleanup removed media from blob storage
        var newMediaUrls = existingPost.MediaUrls ?? new List<string>();
        var removedUrls = oldMediaUrls.Except(newMediaUrls).ToList();
        foreach (var url in removedUrls)
        {
            try
            {
                await _blobStore.DeleteAsync(url, cancellationToken);
                _logger.LogInformation("Deleted removed media blob: {BlobPath}", url);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete removed media blob {BlobPath}. It may have already been deleted.", url);
            }
        }

        // Update text
        existingPost.Text = string.IsNullOrWhiteSpace(text) ? null : text.Trim();

        if (!string.IsNullOrEmpty(scheduledTimeStr) && DateTimeOffset.TryParse(scheduledTimeStr, out var st))
        {
            existingPost.ScheduledTime = st;
        }
        else if (form.ContainsKey("scheduledTime"))
        {
            existingPost.ScheduledTime = null;
        }

        if (!string.IsNullOrEmpty(statusStr) && Enum.TryParse<PostStatus>(statusStr, true, out var status))
        {
            existingPost.Status = status;
        }

        existingPost.UpdatedAt = DateTimeOffset.UtcNow;

        await _postRepository.UpdateAsync(existingPost, cancellationToken);

        var containerSas = await _blobStore.GetContainerSasAsync(TimeSpan.FromHours(24), cancellationToken);

        var resolvedMediaUrls = new List<string>();
        if (existingPost.MediaUrls != null)
        {
            foreach (var url in existingPost.MediaUrls)
            {
                var uri = await _blobStore.GetBlobUriAsync(url, TimeSpan.FromHours(24), cancellationToken);
                var uriString = uri.ToString();

                if (!string.IsNullOrEmpty(containerSas) && !uriString.Contains("?"))
                {
                    uriString = $"{uriString}?{containerSas}";
                }
                resolvedMediaUrls.Add(uriString);
            }
        }

        var responseData = new PostResponse(
            existingPost.Id,
            existingPost.CampaignId,
            existingPost.UserId,
            existingPost.Text,
            resolvedMediaUrls,
            existingPost.ScheduledTime,
            existingPost.Status,
            existingPost.PlatformData,
            existingPost.CreatedAt,
            existingPost.UpdatedAt
        );

        return new OkObjectResult(responseData);
    }
}
