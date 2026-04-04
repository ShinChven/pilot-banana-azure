using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using Pilot.Core.Domain;
using Pilot.Core.DTOs;
using Pilot.Core.Repositories;
using Pilot.Core.Services;

namespace Pilot.Orchestration.Functions;

public class PostAiTaskProcessor
{
    private readonly ILogger _logger;
    private readonly IPostRepository _postRepository;
    private readonly IPostAiTaskRepository _taskRepository;
    private readonly IAiService _aiService;
    private readonly IAssetBlobStore _blobStore;
    private readonly HttpClient _httpClient;

    public PostAiTaskProcessor(
        ILoggerFactory loggerFactory,
        IPostRepository postRepository,
        IPostAiTaskRepository taskRepository,
        IAiService aiService,
        IAssetBlobStore blobStore,
        IHttpClientFactory httpClientFactory)
    {
        _logger = loggerFactory.CreateLogger<PostAiTaskProcessor>();
        _postRepository = postRepository;
        _taskRepository = taskRepository;
        _aiService = aiService;
        _blobStore = blobStore;
        _httpClient = httpClientFactory.CreateClient("Pilot.AssetDownload");
    }

    [Function("PostAiTaskProcessor")]
    public async Task Run(
        [QueueTrigger("ai-generation-tasks", Connection = "AzureWebJobsStorage")] string messageText,
        CancellationToken cancellationToken)
    {
        var payload = JsonSerializer.Deserialize<PostAiTaskMessage>(messageText, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        if (payload == null) return;

        _logger.LogInformation("Processing AI task {TaskId}...", payload.TaskId);

        // 1. Fetch Task
        var task = await _taskRepository.GetByIdAsync(payload.UserId, payload.TaskId, cancellationToken);
        if (task == null || task.Status == AiTaskStatus.Succeeded) return;

        // 2. Update Status to Processing
        task.Status = AiTaskStatus.Processing;
        task.UpdatedAt = DateTimeOffset.UtcNow;
        await _taskRepository.UpdateAsync(task, cancellationToken);

        try
        {
            // 3. Fetch Post
            var post = await _postRepository.GetByIdAsync(task.CampaignId, task.PostId, cancellationToken);
            if (post == null)
            {
                throw new Exception($"Post {task.PostId} not found.");
            }

            // 4. Download images (prefer optimized versions to reduce bandwidth)
            var images = new List<byte[]>();
            if (task.IncludeImages)
            {
                var imageUrls = (post.OptimizedUrls != null && post.OptimizedUrls.Count > 0)
                    ? post.OptimizedUrls
                    : post.MediaUrls;
                if (imageUrls != null)
                {
                    var containerSas = await _blobStore.GetContainerSasAsync(TimeSpan.FromHours(24), cancellationToken);

                    foreach (var url in imageUrls)
                    {
                        try
                        {
                            var uri = await _blobStore.GetBlobUriAsync(url, TimeSpan.FromHours(24), cancellationToken);

                            if (!string.IsNullOrEmpty(containerSas) && string.IsNullOrEmpty(uri.Query))
                            {
                                var uriBuilder = new UriBuilder(uri) { Query = containerSas };
                                uri = uriBuilder.Uri;
                            }

                            var resp = await _httpClient.GetAsync(uri, cancellationToken);
                            if (!resp.IsSuccessStatusCode)
                            {
                                var errorBody = await resp.Content.ReadAsStringAsync(cancellationToken);
                                _logger.LogWarning("Failed to download image {Url} for task {TaskId}. Status: {Status}. Body: {Body}", url, task.Id, (int)resp.StatusCode, errorBody);
                                continue;
                            }

                            var bytes = await resp.Content.ReadAsByteArrayAsync(cancellationToken);
                            if (bytes == null || bytes.Length == 0) continue;

                            // Quick XML check
                            if (bytes.Length > 0 && bytes[0] == '<')
                            {
                                var contentSample = System.Text.Encoding.UTF8.GetString(bytes.Take(Math.Min(bytes.Length, 100)).ToArray());
                                if (contentSample.StartsWith("<?xml") || contentSample.StartsWith("<Error"))
                                {
                                    _logger.LogWarning("Downloaded asset for task {TaskId} is an XML error message, not an image. URL: {Url}", task.Id, url);
                                    continue;
                                }
                            }

                            images.Add(bytes);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Failed to download image {Url} for task {TaskId}. Skipping image.", url, task.Id);
                        }
                    }
                }
            }

            // 5. Call AI Service
            var generatedText = await _aiService.GeneratePostTextAsync(images, task.PromptText, cancellationToken);

            if (string.IsNullOrWhiteSpace(generatedText))
            {
                throw new Exception("AI generated empty text.");
            }

            // 6. Update Post
            post.Text = generatedText.Trim();
            post.Status = PostStatus.Draft;
            post.UpdatedAt = DateTimeOffset.UtcNow;
            await _postRepository.UpdateAsync(post, cancellationToken);

            // 7. Mark Task Succeeded
            task.Status = AiTaskStatus.Succeeded;
            task.ResultText = generatedText.Trim();
            task.UpdatedAt = DateTimeOffset.UtcNow;
            await _taskRepository.UpdateAsync(task, cancellationToken);
            
            _logger.LogInformation("AI task {TaskId} completed successfully.", task.Id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process AI task {TaskId}", task.Id);
            
            task.Status = AiTaskStatus.Failed;
            task.ErrorMessage = ex.Message;
            task.UpdatedAt = DateTimeOffset.UtcNow;
            await _taskRepository.UpdateAsync(task, cancellationToken);

            // Fetch post again to ensure we have the latest state before updating status
            var errorPost = await _postRepository.GetByIdAsync(task.CampaignId, task.PostId, cancellationToken);
            if (errorPost != null)
            {
                errorPost.Status = PostStatus.Failed;
                errorPost.UpdatedAt = DateTimeOffset.UtcNow;
                await _postRepository.UpdateAsync(errorPost, cancellationToken);
            }
        }
    }
}
