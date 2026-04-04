using System;
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
using Pilot.Core.DTOs;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class PostsUserListFunction
{
    private readonly IPostRepository _postRepository;
    private readonly IPostHistoryRepository _historyRepository;
    private readonly ICampaignRepository _campaignRepository;
    private readonly RequestAuthHelper _authHelper;
    private readonly PostResponseMapper _mapper;

    public PostsUserListFunction(
        IPostRepository postRepository, 
        IPostHistoryRepository historyRepository,
        ICampaignRepository campaignRepository,
        RequestAuthHelper authHelper, 
        PostResponseMapper mapper)
    {
        _postRepository = postRepository;
        _historyRepository = historyRepository;
        _campaignRepository = campaignRepository;
        _authHelper = authHelper;
        _mapper = mapper;
    }

    [Function("ListUserPosts")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "api/users/{userId}/posts")] HttpRequest req,
        string userId,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null || auth.Value.UserId != userId)
            return new UnauthorizedResult();

        int page = 1;
        int pageSize = 10;

        if (int.TryParse(req.Query["page"], out int parsedPage) && parsedPage > 0)
            page = parsedPage;
        if (int.TryParse(req.Query["pageSize"], out int parsedPageSize) && parsedPageSize > 0)
            pageSize = parsedPageSize;

        string? status = req.Query["status"];
        string? search = req.Query["search"];
        string? sortBy = req.Query["sortBy"];
        string? sortOrder = req.Query["sortOrder"];

        var (posts, total) = await _postRepository.GetPaginatedByUserIdAsync(userId, page, pageSize, status, search, sortBy, sortOrder, cancellationToken);

        var postIds = posts.Select(p => p.Id).ToList();
        var campaignIds = posts.Select(p => p.CampaignId).Distinct().ToList();
        
        var postUrlsTask = _historyRepository.GetLatestPostUrlsByPostIdsAsync(postIds, cancellationToken);
        var campaignsTask = _campaignRepository.ListByIdsAsync(userId, campaignIds, cancellationToken);
        
        await Task.WhenAll(postUrlsTask, campaignsTask);
        
        var postUrls = postUrlsTask.Result;
        var campaigns = campaignsTask.Result.ToDictionary(c => c.Id, c => c.Name);

        var dtos = new List<PostResponse>();
        foreach (var p in posts)
        {
            dtos.Add(await _mapper.MapAsync(
                p, 
                postUrl: postUrls.TryGetValue(p.Id, out var url) ? url : null, 
                campaignName: campaigns.TryGetValue(p.CampaignId, out var campaignName) ? campaignName : null,
                cancellationToken: cancellationToken));
        }

        var result = new PaginatedList<PostResponse>
        {
            Items = dtos,
            Total = total,
            Page = page,
            PageSize = pageSize
        };

        return new OkObjectResult(result);
    }
}
