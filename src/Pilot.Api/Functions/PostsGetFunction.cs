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
    private readonly PostResponseMapper _mapper;

    public PostsGetFunction(IPostRepository postRepository, RequestAuthHelper authHelper, PostResponseMapper mapper)
    {
        _postRepository = postRepository;
        _authHelper = authHelper;
        _mapper = mapper;
    }

    [Function("GetPost")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "api/users/{userId}/campaigns/{campaignId}/posts/{postId}")] HttpRequest req,
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

        var response = await _mapper.MapAsync(post, cancellationToken: cancellationToken);

        return new OkObjectResult(response);
    }
}
