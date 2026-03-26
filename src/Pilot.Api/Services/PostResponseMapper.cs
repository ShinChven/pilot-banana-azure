using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Pilot.Core.Domain;
using Pilot.Core.DTOs;
using Pilot.Core.Repositories;

namespace Pilot.Api.Services;

public class PostResponseMapper
{
    private readonly IAssetBlobStore _blobStore;

    public PostResponseMapper(IAssetBlobStore blobStore)
    {
        _blobStore = blobStore;
    }

    public async Task<PostResponse> MapAsync(
        Post post, 
        string? containerSas = null, 
        string? postUrl = null, 
        string? campaignName = null,
        CancellationToken cancellationToken = default)
    {
        if (containerSas == null)
        {
            containerSas = await _blobStore.GetContainerSasAsync(TimeSpan.FromHours(24), cancellationToken);
        }

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

        var resMediaUrls = await ResolveUrlsAsync(post.MediaUrls);
        var resOptimizedUrls = post.OptimizedUrls != null && post.OptimizedUrls.Any() 
            ? await ResolveUrlsAsync(post.OptimizedUrls) 
            : resMediaUrls;
        var resThumbnailUrls = post.ThumbnailUrls != null && post.ThumbnailUrls.Any() 
            ? await ResolveUrlsAsync(post.ThumbnailUrls) 
            : resMediaUrls;

        return new PostResponse(
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
            post.UpdatedAt,
            postUrl,
            campaignName
        );
    }
}
