using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Pilot.Api.Services;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class CampaignsDeleteFunction
{
    private readonly ICampaignRepository _campaignRepository;
    private readonly IPostRepository _postRepository;
    private readonly IAssetBlobStore _blobStore;
    private readonly RequestAuthHelper _authHelper;

    public CampaignsDeleteFunction(
        ICampaignRepository campaignRepository,
        IPostRepository postRepository,
        IAssetBlobStore blobStore,
        RequestAuthHelper authHelper)
    {
        _campaignRepository = campaignRepository;
        _postRepository = postRepository;
        _blobStore = blobStore;
        _authHelper = authHelper;
    }

    [Function("DeleteCampaign")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "campaigns/{id}")] HttpRequestData req,
        string id,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null)
        {
            var unauth = req.CreateResponse(HttpStatusCode.Unauthorized);
            await unauth.WriteAsJsonAsync(new { error = "Authorization required." }, cancellationToken);
            return unauth;
        }

        var campaign = await _campaignRepository.GetByIdAsync(auth.Value.UserId, id, cancellationToken);
        if (campaign == null)
        {
            var notFound = req.CreateResponse(HttpStatusCode.NotFound);
            await notFound.WriteAsJsonAsync(new { error = "Campaign not found." }, cancellationToken);
            return notFound;
        }

        // 1. Clean up blobs from storage
        // Blobs are stored at: {userId}/{campaignId}/...
        var blobPrefix = $"{auth.Value.UserId}/{id}/";
        await _blobStore.DeleteFolderAsync(blobPrefix, cancellationToken);

        // 2. Clean up post records from DB
        await _postRepository.DeleteByCampaignIdAsync(id, cancellationToken);

        // 3. Delete the campaign record
        await _campaignRepository.DeleteAsync(auth.Value.UserId, id, cancellationToken);

        return req.CreateResponse(HttpStatusCode.NoContent);
    }
}
