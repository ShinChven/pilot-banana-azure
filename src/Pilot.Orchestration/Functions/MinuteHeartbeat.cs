using System.Text.Json;
using System.Linq;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using Pilot.Core.Domain;
using Pilot.Core.Repositories;
using Azure.Storage.Queues;

namespace Pilot.Orchestration.Functions;

public class MinuteHeartbeat
{
    private static readonly TimeSpan PendingRecoveryAge = TimeSpan.FromMinutes(15);
    private readonly ILogger _logger;
    private readonly IPostRepository _postRepository;
    private readonly QueueClient _queueClient;

    public MinuteHeartbeat(
        ILoggerFactory loggerFactory,
        IPostRepository postRepository,
        QueueClient queueClient)
    {
        _logger = loggerFactory.CreateLogger<MinuteHeartbeat>();
        _postRepository = postRepository;
        _queueClient = queueClient;
    }

    /// <summary>
    /// Wakes up every minute to check for posts that are ready to go.
    /// </summary>
    [Function("MinuteHeartbeat")]
    public async Task Run([TimerTrigger("0 * * * * *")] TimerInfo myTimer, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        _logger.LogInformation("Heartbeat triggered at {Time:O}", now);

        var stalePendingCutoff = now.Subtract(PendingRecoveryAge);
        var stalePendingPosts = await _postRepository.GetStaleByStatusAsync(PostStatus.Pending, stalePendingCutoff, cancellationToken);
        foreach (var stalePost in stalePendingPosts)
        {
            var recovered = await _postRepository.TryTransitionStatusAsync(stalePost.CampaignId, stalePost.Id, PostStatus.Pending, PostStatus.Scheduled, cancellationToken);
            if (recovered)
            {
                _logger.LogWarning(
                    "Recovered stale in-flight post {PostId} back to Scheduled. Last update was {UpdatedAt:O}.",
                    stalePost.Id,
                    stalePost.UpdatedAt);
            }
        }

        var allPosts = await _postRepository.ListAllAsync(cancellationToken);
        _logger.LogInformation("Debug total posts in DB: {Count}", allPosts.Count);
        _logger.LogInformation(
            "Debug all posts: {Posts}",
            string.Join(", ", allPosts.Select(p => $"{p.Id} [campaign={p.CampaignId}, status={p.Status}, scheduled={p.ScheduledTime:O}]")));

        // Fetch all scheduled posts that are due now or earlier
        var readyPosts = await _postRepository.GetReadyToPublishAsync(now, PostStatus.Scheduled, cancellationToken);

        if (readyPosts.Count == 0)
        {
            _logger.LogInformation("No posts scheduled for this minute.");
            return;
        }

        _logger.LogInformation("Found {Count} posts to dispatch.", readyPosts.Count);
        _logger.LogInformation(
            "Posts selected for dispatch: {Posts}",
            string.Join(", ", readyPosts.Select(p => $"{p.Id} (scheduled: {p.ScheduledTime:O})")));

        foreach (var post in readyPosts)
        {
            try
            {
                // 1. Touch the post so stale in-flight recovery can reason about recent dispatch activity
                post.UpdatedAt = DateTimeOffset.UtcNow;
                await _postRepository.UpdateAsync(post, cancellationToken);

                // 2. Dispatch to the worker
                var payload = new PostDispatchMessage(post.Id, post.CampaignId, post.UserId);
                await _queueClient.CreateIfNotExistsAsync(cancellationToken: cancellationToken);
                await _queueClient.SendMessageAsync(JsonSerializer.Serialize(payload), cancellationToken);

                _logger.LogInformation("Dispatched Post {PostId} for Campaign {CampaignId}", post.Id, post.CampaignId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to dispatch post {PostId}", post.Id);
                // Note: If this fails, the post stays in Scheduled and will be retried on the next heartbeat.
            }
        }
    }
}

public record PostDispatchMessage(string PostId, string CampaignId, string UserId);
