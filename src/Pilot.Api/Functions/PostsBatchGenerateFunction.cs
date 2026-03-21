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

public class PostsBatchGenerateFunction
{
    private readonly IPostRepository _postRepository;
    private readonly IPostAiTaskRepository _taskRepository;
    private readonly RequestAuthHelper _authHelper;
    private readonly QueueClient _queueClient;
    private readonly ILogger<PostsBatchGenerateFunction> _logger;

    public PostsBatchGenerateFunction(
        IPostRepository postRepository,
        IPostAiTaskRepository taskRepository,
        RequestAuthHelper authHelper,
        IConfiguration configuration,
        ILogger<PostsBatchGenerateFunction> logger)
    {
        _postRepository = postRepository;
        _taskRepository = taskRepository;
        _authHelper = authHelper;
        _logger = logger;
        
        var connectionString = configuration["AzureWebJobsStorage"] ?? "UseDevelopmentStorage=true";
        _queueClient = new QueueClient(connectionString, "ai-generation-tasks", new QueueClientOptions
        {
            MessageEncoding = QueueMessageEncoding.Base64
        });
    }

    public record BatchGenerateRequest(string[] PostIds, string CampaignId, string PromptText);

    [Function("BatchGeneratePosts")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "users/{userId}/posts/batch-generate-text")] HttpRequest req,
        string userId,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null) return new UnauthorizedResult();
        if (auth.Value.UserId != userId) return new ForbidResult();

        var body = await JsonSerializer.DeserializeAsync<BatchGenerateRequest>(req.Body, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }, cancellationToken);
        if (body == null || body.PostIds == null || body.PostIds.Length == 0 || string.IsNullOrWhiteSpace(body.PromptText))
            return new BadRequestObjectResult(new { error = "Invalid request body." });

        _logger.LogInformation("Batch generating text for {Count} posts for user {UserId}", body.PostIds.Length, userId);

        try
        {
            var tasksCreated = new List<string>();
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

                    // 1. Create the task record
                    var task = new PostAiTask
                    {
                        PostId = postId,
                        CampaignId = body.CampaignId,
                        UserId = userId,
                        PromptText = body.PromptText.Trim(),
                        Status = AiTaskStatus.Pending
                    };
                    await _taskRepository.CreateAsync(task, cancellationToken);

                    // 2. Update post status to Generating
                    post.Status = PostStatus.Generating;
                    post.UpdatedAt = DateTimeOffset.UtcNow;
                    await _postRepository.UpdateAsync(post, cancellationToken);

                    // 3. Enqueue the task
                    await _queueClient.CreateIfNotExistsAsync(cancellationToken: cancellationToken);
                    var message = new PostAiTaskMessage(task.Id, userId);
                    await _queueClient.SendMessageAsync(JsonSerializer.Serialize(message), cancellationToken);

                    tasksCreated.Add(task.Id);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to create AI task for post {PostId} in Campaign {CampaignId}. Error: {Message}", postId, body.CampaignId, ex.Message);
                    errors.Add($"{ex.Message}");
                }
            }

            if (tasksCreated.Count == 0 && errors.Any())
            {
                return new ObjectResult(new { error = "Failed to create any AI tasks.", details = errors }) { StatusCode = 500 };
            }

            return new AcceptedResult((string?)null, new { 
                count = tasksCreated.Count, 
                taskIds = tasksCreated,
                errors = errors.Any() ? errors : null 
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Critical failure in BatchGeneratePosts for user {UserId}", userId);
            return new ObjectResult(new { error = "A critical server error occurred.", message = ex.Message }) { StatusCode = 500 };
        }
    }
}
