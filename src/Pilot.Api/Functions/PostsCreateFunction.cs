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

public class PostsCreateFunction
{
    private readonly IAssetBlobStore _blobStore;
    private readonly IPostRepository _postRepository;
    private readonly IImageOptimizer _imageOptimizer;
    private readonly RequestAuthHelper _authHelper;
    private readonly ILogger<PostsCreateFunction> _logger;

    public PostsCreateFunction(
        IAssetBlobStore blobStore,
        IPostRepository postRepository,
        IImageOptimizer imageOptimizer,
        RequestAuthHelper authHelper,
        ILogger<PostsCreateFunction> logger)
    {
        _blobStore = blobStore;
        _postRepository = postRepository;
        _imageOptimizer = imageOptimizer;
        _authHelper = authHelper;
        _logger = logger;
    }

    [Function("CreatePost")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "api/users/{userId}/campaigns/{campaignId}/posts")] HttpRequest req,
        string userId,
        string campaignId,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null)
            return new UnauthorizedResult();

        if (auth.Value.UserId != userId)
            return new ForbidResult();

        if (!req.HasFormContentType)
            return new BadRequestObjectResult(new { error = "Request must be multipart/form-data." });

        var form = await req.ReadFormAsync(cancellationToken);
        string text = form["text"].FirstOrDefault() ?? string.Empty;
        string statusStr = form["status"].FirstOrDefault() ?? string.Empty;
        string scheduledTimeStr = form["scheduledTime"].FirstOrDefault() ?? string.Empty;
        var files = form.Files;

        _logger.LogInformation("CreatePost: Received {FileCount} files for user {UserId}, campaign {CampaignId}", files.Count, userId, campaignId);

        if (files.Count > PostMediaRules.MaxItemsPerPost)
            return new BadRequestObjectResult(new { error = $"A post can contain up to {PostMediaRules.MaxItemsPerPost} media items." });

        var newMediaKinds = new List<PostMediaKind>();

        var mediaUrls = new List<string>();
        var optimizedUrls = new List<string>();
        var thumbnailUrls = new List<string>();

        foreach (var file in files)
        {
            if (file.Length == 0) 
            {
                _logger.LogWarning("CreatePost: Received empty file: {FileName}", file.FileName);
                continue;
            }

            var validation = PostMediaRules.ValidateFile(file.ContentType, file.FileName, file.Length);
            if (!validation.IsValid)
                return new BadRequestObjectResult(new { error = validation.ErrorMessage });

            newMediaKinds.Add(validation.Kind);

            var ext = Path.GetExtension(file.FileName);
            if (string.IsNullOrEmpty(ext)) ext = ".bin";

            var mediaId = Guid.NewGuid().ToString("N");
            var basePath = $"{userId}/{campaignId}/{mediaId}";
            var blobPath = $"{basePath}{ext}";

            try
            {
                using var stream = file.OpenReadStream();
                var absoluteUrl = await _blobStore.UploadAsync(blobPath, stream, file.ContentType, cancellationToken);
                _logger.LogInformation("CreatePost: Uploaded original {FileName} to {AbsoluteUrl}", file.FileName, absoluteUrl);
                mediaUrls.Add(absoluteUrl);

                // Optimization logic for images
                if (_imageOptimizer.Supports(file.ContentType))
                {
                    try
                    {
                        stream.Position = 0;
                        var (optStream, thumbStream) = await _imageOptimizer.CreateAllVersionsAsync(stream, cancellationToken);
                        
                        using (optStream)
                        {
                            var optUrl = await _blobStore.UploadAsync($"{basePath}_opt.jpg", optStream, "image/jpeg", cancellationToken);
                            optimizedUrls.Add(optUrl);
                        }

                        using (thumbStream)
                        {
                            var thumbUrl = await _blobStore.UploadAsync($"{basePath}_thumb.jpg", thumbStream, "image/jpeg", cancellationToken);
                            thumbnailUrls.Add(thumbUrl);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "CreatePost: Failed to generate optimized versions for {FileName}. Using original as fallback.", file.FileName);
                        optimizedUrls.Add(absoluteUrl);
                        thumbnailUrls.Add(absoluteUrl);
                    }
                }
                else
                {
                    // Non-image assets use original for everything
                    optimizedUrls.Add(absoluteUrl);
                    thumbnailUrls.Add(absoluteUrl);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CreatePost: Blob upload failed for file {FileName}", file.FileName);
                return new StatusCodeResult((int)HttpStatusCode.InternalServerError);
            }
        }

        var compositionError = PostMediaRules.ValidateComposition(newMediaKinds);
        if (compositionError != null)
            return new BadRequestObjectResult(new { error = compositionError });

        var post = new Post
        {
            Id = Guid.NewGuid().ToString(),
            CampaignId = campaignId,
            UserId = userId,
            Text = string.IsNullOrWhiteSpace(text) ? null : text.Trim(),
            MediaUrls = mediaUrls,
            OptimizedUrls = optimizedUrls,
            ThumbnailUrls = thumbnailUrls,
            Status = !string.IsNullOrEmpty(statusStr) && Enum.TryParse<PostStatus>(statusStr, true, out var status) ? status : PostStatus.Draft,
            ScheduledTime = !string.IsNullOrEmpty(scheduledTimeStr) && DateTimeOffset.TryParse(scheduledTimeStr, out var st) ? st : null,
            CreatedAt = DateTimeOffset.UtcNow
        };
        
        _logger.LogInformation("CreatePost: Saving post with {MediaUrlCount} media URLs.", post.MediaUrls.Count);
        
        await _postRepository.CreateAsync(post, cancellationToken);

        var containerSas = await _blobStore.GetContainerSasAsync(TimeSpan.FromHours(24), cancellationToken);

        async Task<List<string>> ResolveUrlsAsync(List<string> urls)
        {
            var resolved = new List<string>();
            foreach (var url in urls)
            {
                var uri = await _blobStore.GetBlobUriAsync(url, TimeSpan.FromHours(24), cancellationToken);
                var uriString = uri.ToString();
                if (!string.IsNullOrEmpty(containerSas) && !uriString.Contains("?"))
                {
                    uriString = $"{uriString}?{containerSas}";
                }
                resolved.Add(uriString);
            }
            return resolved;
        }

        var resMediaUrls = await ResolveUrlsAsync(post.MediaUrls);
        var resOptimizedUrls = await ResolveUrlsAsync(post.OptimizedUrls);
        var resThumbnailUrls = await ResolveUrlsAsync(post.ThumbnailUrls);

        var responseData = new PostResponse(
            post.Id,
            post.CampaignId,
            post.UserId,
            post.Text,
            resMediaUrls,
            resOptimizedUrls,
            resThumbnailUrls,
            post.ScheduledTime,
            post.Status,
            post.PlatformData,
            post.CreatedAt,
            post.UpdatedAt
        );

        return new CreatedResult($"/api/users/{userId}/campaigns/{campaignId}/posts/{post.Id}", responseData);
    }
}
