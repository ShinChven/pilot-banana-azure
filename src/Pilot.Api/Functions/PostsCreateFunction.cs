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

public class PostsCreateFunction
{
    private readonly IAssetBlobStore _blobStore;
    private readonly IPostRepository _postRepository;
    private readonly RequestAuthHelper _authHelper;
    private readonly ILogger<PostsCreateFunction> _logger;

    public PostsCreateFunction(
        IAssetBlobStore blobStore,
        IPostRepository postRepository,
        RequestAuthHelper authHelper,
        ILogger<PostsCreateFunction> logger)
    {
        _blobStore = blobStore;
        _postRepository = postRepository;
        _authHelper = authHelper;
        _logger = logger;
    }

    [Function("CreatePost")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "users/{userId}/campaigns/{campaignId}/posts")] HttpRequest req,
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

        var mediaUrls = new List<string>();

        foreach (var file in files)
        {
            if (file.Length == 0) 
            {
                _logger.LogWarning("CreatePost: Received empty file: {FileName}", file.FileName);
                continue;
            }

            var ext = Path.GetExtension(file.FileName);
            if (string.IsNullOrEmpty(ext)) ext = ".bin";

            var mediaId = Guid.NewGuid().ToString("N");
            var blobPath = $"{userId}/{campaignId}/{mediaId}{ext}";

            try
            {
                using var stream = file.OpenReadStream();
                var absoluteUrl = await _blobStore.UploadAsync(blobPath, stream, file.ContentType, cancellationToken);
                _logger.LogInformation("CreatePost: Uploaded {FileName} to {AbsoluteUrl}", file.FileName, absoluteUrl);
                mediaUrls.Add(absoluteUrl);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CreatePost: Blob upload failed for file {FileName}", file.FileName);
                return new StatusCodeResult((int)HttpStatusCode.InternalServerError);
            }
        }

        var post = new Post
        {
            Id = Guid.NewGuid().ToString(),
            CampaignId = campaignId,
            UserId = userId,
            Text = string.IsNullOrWhiteSpace(text) ? null : text.Trim(),
            MediaUrls = mediaUrls,
            Status = !string.IsNullOrEmpty(statusStr) && Enum.TryParse<PostStatus>(statusStr, true, out var status) ? status : PostStatus.Draft,
            ScheduledTime = !string.IsNullOrEmpty(scheduledTimeStr) && DateTimeOffset.TryParse(scheduledTimeStr, out var st) ? st : null,
            CreatedAt = DateTimeOffset.UtcNow
        };
        
        _logger.LogInformation("CreatePost: Saving post with {MediaUrlCount} media URLs: [{MediaUrls}]", post.MediaUrls.Count, string.Join(", ", post.MediaUrls));
        
        await _postRepository.CreateAsync(post, cancellationToken);

        var containerSas = await _blobStore.GetContainerSasAsync(TimeSpan.FromHours(24), cancellationToken);

        var resolvedMediaUrls = new List<string>();
        if (post.MediaUrls != null)
        {
            foreach (var url in post.MediaUrls)
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
            post.Id,
            post.CampaignId,
            post.UserId,
            post.Text,
            resolvedMediaUrls,
            post.ScheduledTime,
            post.Status,
            post.PlatformData,
            post.CreatedAt,
            post.UpdatedAt
        );

        return new CreatedResult($"/api/users/{userId}/campaigns/{campaignId}/posts/{post.Id}", responseData);
    }
}
