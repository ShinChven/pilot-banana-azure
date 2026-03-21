using System.Net;
using System.Text.Json;
using Azure.Storage.Queues;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Pilot.Api.Services;
using Pilot.Core.Domain;
using Pilot.Core.DTOs;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class AiTaskRetryFunction
{
    private readonly IPostAiTaskRepository _taskRepository;
    private readonly IPostRepository _postRepository;
    private readonly RequestAuthHelper _authHelper;
    private readonly QueueClient _queueClient;
    private readonly ILogger<AiTaskRetryFunction> _logger;

    public AiTaskRetryFunction(
        IPostAiTaskRepository taskRepository,
        IPostRepository postRepository,
        RequestAuthHelper authHelper,
        IConfiguration configuration,
        ILogger<AiTaskRetryFunction> logger)
    {
        _taskRepository = taskRepository;
        _postRepository = postRepository;
        _authHelper = authHelper;
        _logger = logger;

        var connectionString = configuration["AzureWebJobsStorage"] ?? "UseDevelopmentStorage=true";
        _queueClient = new QueueClient(connectionString, "ai-generation-tasks", new QueueClientOptions
        {
            MessageEncoding = QueueMessageEncoding.Base64
        });
    }

    [Function("RetryAiTask")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "users/{userId}/ai-tasks/{taskId}/retry")] HttpRequest req,
        string userId,
        string taskId,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null) return new UnauthorizedResult();
        if (auth.Value.UserId != userId) return new ForbidResult();

        var task = await _taskRepository.GetByIdAsync(userId, taskId, cancellationToken);
        if (task == null) return new NotFoundObjectResult(new { error = "Task not found." });

        if (task.Status != AiTaskStatus.Failed)
            return new BadRequestObjectResult(new { error = "Only failed tasks can be retried." });

        _logger.LogInformation("Retrying AI task {TaskId} for user {UserId}", taskId, userId);

        try
        {
            // 1. Reset task status
            task.Status = AiTaskStatus.Pending;
            task.ErrorMessage = null;
            task.UpdatedAt = DateTimeOffset.UtcNow;
            await _taskRepository.UpdateAsync(task, cancellationToken);

            // 2. Ensure post status is Generating
            var post = await _postRepository.GetByIdAsync(task.CampaignId, task.PostId, cancellationToken);
            if (post != null)
            {
                post.Status = PostStatus.Generating;
                post.UpdatedAt = DateTimeOffset.UtcNow;
                await _postRepository.UpdateAsync(post, cancellationToken);
            }

            // 3. Re-enqueue
            var message = new PostAiTaskMessage(task.Id, userId);
            await _queueClient.SendMessageAsync(JsonSerializer.Serialize(message), cancellationToken);

            return new AcceptedResult();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retry AI task {TaskId} for user {UserId}", taskId, userId);
            return new ObjectResult(new { error = "Failed to retry task.", message = ex.Message }) { StatusCode = 500 };
        }
    }
}
