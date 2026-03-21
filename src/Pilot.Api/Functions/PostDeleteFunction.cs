using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Pilot.Api.Services;
using Pilot.Core.Repositories;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace Pilot.Api.Functions;

public class PostDeleteFunction
{
    private readonly IAssetBlobStore _blobStore;
    private readonly IPostRepository _postRepository;
    private readonly RequestAuthHelper _authHelper;

    public PostDeleteFunction(
        IAssetBlobStore blobStore,
        IPostRepository postRepository,
        RequestAuthHelper authHelper)
    {
        _blobStore = blobStore;
        _postRepository = postRepository;
        _authHelper = authHelper;
    }

    [Function("DeletePost")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "users/{userId}/campaigns/{campaignId}/posts/{id}")] HttpRequestData req,
        string userId, string campaignId, string id, CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null || auth.Value.UserId != userId)
            return req.CreateResponse(HttpStatusCode.Unauthorized);

        var post = await _postRepository.GetByIdAsync(campaignId, id, cancellationToken);
        if (post == null)
            return req.CreateResponse(HttpStatusCode.NoContent);

        foreach (var url in post.MediaUrls)
        {
            try { await _blobStore.DeleteAsync(url, cancellationToken); } catch { /* ignore */ }
        }

        await _postRepository.DeleteAsync(campaignId, id, cancellationToken);
        return req.CreateResponse(HttpStatusCode.NoContent);
    }
}
