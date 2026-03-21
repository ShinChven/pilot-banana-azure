using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using Pilot.Api.Services;
using Pilot.Core.Domain;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class PostsBatchUnscheduleFunction
{
    private readonly IPostRepository _postRepository;
    private readonly RequestAuthHelper _authHelper;
    private readonly ILogger<PostsBatchUnscheduleFunction> _logger;

    public PostsBatchUnscheduleFunction(
        IPostRepository postRepository,
        RequestAuthHelper authHelper,
        ILogger<PostsBatchUnscheduleFunction> logger)
    {
        _postRepository = postRepository;
        _authHelper = authHelper;
        _logger = logger;
    }

    public record BatchUnscheduleRequest(string CampaignId, List<string> PostIds);

    [Function("BatchUnschedulePosts")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "users/{userId}/posts/batch-unschedule")] HttpRequest req,
        string userId,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null) return new UnauthorizedResult();
        if (auth.Value.UserId != userId) return new ForbidResult();

        var body = await JsonSerializer.DeserializeAsync<BatchUnscheduleRequest>(req.Body, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }, cancellationToken);
        if (body == null || body.PostIds == null || body.PostIds.Count == 0 || string.IsNullOrEmpty(body.CampaignId))
            return new BadRequestObjectResult(new { error = "Invalid request body." });

        _logger.LogInformation("Batch unscheduling {Count} posts for user {UserId} in campaign {CampaignId}", body.PostIds.Count, userId, body.CampaignId);

        try
        {
            int successCount = 0;
            var errors = new List<string>();

            foreach (var postId in body.PostIds)
            {
                try
                {
                    var post = await _postRepository.GetByIdAsync(body.CampaignId, postId, cancellationToken);
                    if (post == null || post.UserId != userId)
                    {
                        errors.Add($"Post {postId} not found or access denied.");
                        continue;
                    }

                    post.ScheduledTime = null;
                    post.Status = PostStatus.Draft;
                    post.UpdatedAt = DateTimeOffset.UtcNow;

                    await _postRepository.UpdateAsync(post, cancellationToken);
                    successCount++;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to unschedule post {PostId}", postId);
                    errors.Add($"Post {postId}: {ex.Message}");
                }
            }

            if (successCount == 0 && errors.Any())
            {
                return new ObjectResult(new { error = "Failed to unschedule any posts.", details = errors }) { StatusCode = 500 };
            }

            return new OkObjectResult(new { 
                count = successCount, 
                errors = errors.Any() ? errors : null 
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Critical failure in BatchUnschedulePosts for user {UserId}", userId);
            return new ObjectResult(new { error = "A critical server error occurred.", message = ex.Message }) { StatusCode = 500 };
        }
    }
}
