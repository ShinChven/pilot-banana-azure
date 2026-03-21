using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Pilot.Api.Services;
using Pilot.Core.DTOs;
using Pilot.Core.Repositories;
using System;
using Pilot.Infrastructure.Blob;

namespace Pilot.Api.Functions;

public class PostsGetFunction
{
    private readonly IPostRepository _postRepository;
    private readonly RequestAuthHelper _authHelper;
    private readonly IAssetBlobStore _blobStore;

    public PostsGetFunction(IPostRepository postRepository, RequestAuthHelper authHelper, IAssetBlobStore blobStore)
    {
        _postRepository = postRepository;
        _authHelper = authHelper;
        _blobStore = blobStore;
    }

    [Function("GetPost")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "users/{userId}/campaigns/{campaignId}/posts/{postId}")] HttpRequest req,
        string userId,
        string campaignId,
        string postId,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null) return new UnauthorizedResult();
        if (auth.Value.UserId != userId) return new ForbidResult();

        var post = await _postRepository.GetByIdAsync(campaignId, postId, cancellationToken);
        if (post == null || post.UserId != userId)
            return new NotFoundResult();

        var containerSas = await _blobStore.GetContainerSasAsync(TimeSpan.FromHours(24), cancellationToken);

        var resolvedUrls = new List<string>();
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
                resolvedUrls.Add(uriString);
            }
        }

        var response = new PostResponse(
            post.Id,
            post.CampaignId,
            post.UserId,
            post.Text,
            resolvedUrls,
            post.ScheduledTime,
            post.Status,
            post.PlatformData,
            post.CreatedAt,
            post.UpdatedAt
        );

        return new OkObjectResult(response);
    }
}
