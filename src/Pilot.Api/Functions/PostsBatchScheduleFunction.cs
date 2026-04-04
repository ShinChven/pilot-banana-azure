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

public class PostsBatchScheduleFunction
{
    private readonly IPostRepository _postRepository;
    private readonly RequestAuthHelper _authHelper;
    private readonly ILogger<PostsBatchScheduleFunction> _logger;

    public PostsBatchScheduleFunction(
        IPostRepository postRepository,
        RequestAuthHelper authHelper,
        ILogger<PostsBatchScheduleFunction> logger)
    {
        _postRepository = postRepository;
        _authHelper = authHelper;
        _logger = logger;
    }

    public record PostScheduleItem(string PostId, DateTimeOffset ScheduledTime);
    public record BatchScheduleRequest(string CampaignId, List<PostScheduleItem> Schedules);

    [Function("BatchSchedulePosts")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "api/users/{userId}/posts/batch-schedule")] HttpRequest req,
        string userId,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null) return new UnauthorizedResult();
        if (auth.Value.UserId != userId) return new ForbidResult();

        var body = await JsonSerializer.DeserializeAsync<BatchScheduleRequest>(req.Body, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }, cancellationToken);
        if (body == null || body.Schedules == null || body.Schedules.Count == 0 || string.IsNullOrEmpty(body.CampaignId))
            return new BadRequestObjectResult(new { error = "Invalid request body." });

        _logger.LogInformation("Batch scheduling {Count} posts for user {UserId} in campaign {CampaignId}", body.Schedules.Count, userId, body.CampaignId);

        try
        {
            int successCount = 0;
            var errors = new List<string>();

            foreach (var item in body.Schedules)
            {
                try
                {
                    var post = await _postRepository.GetByIdAsync(body.CampaignId, item.PostId, cancellationToken);
                    if (post == null || post.UserId != userId)
                    {
                        errors.Add($"Post {item.PostId} not found or access denied.");
                        continue;
                    }

                    post.ScheduledTime = item.ScheduledTime;
                    post.Status = PostStatus.Scheduled;
                    post.UpdatedAt = DateTimeOffset.UtcNow;

                    await _postRepository.UpdateAsync(post, cancellationToken);
                    successCount++;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to schedule post {PostId}", item.PostId);
                    errors.Add($"Post {item.PostId}: {ex.Message}");
                }
            }

            if (successCount == 0 && errors.Any())
            {
                return new ObjectResult(new { error = "Failed to schedule any posts.", details = errors }) { StatusCode = 500 };
            }

            return new OkObjectResult(new { 
                count = successCount, 
                errors = errors.Any() ? errors : null 
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Critical failure in BatchSchedulePosts for user {UserId}", userId);
            return new ObjectResult(new { error = "A critical server error occurred.", message = ex.Message }) { StatusCode = 500 };
        }
    }
}
