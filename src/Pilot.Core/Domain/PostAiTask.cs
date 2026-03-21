namespace Pilot.Core.Domain;

public class PostAiTask
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string PostId { get; set; } = string.Empty;
    public string CampaignId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;

    /// <summary>
    /// The specific prompt text used for this generation.
    /// Copied from a template and optionally edited by the user.
    /// </summary>
    public string PromptText { get; set; } = string.Empty;

    /// <summary>
    /// Pending, Processing, Succeeded, Failed.
    /// </summary>
    public AiTaskStatus Status { get; set; } = AiTaskStatus.Pending;

    /// <summary>
    /// Captured error message if status is Failed.
    /// </summary>
    public string? ErrorMessage { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }
}

public enum AiTaskStatus
{
    Pending = 0,
    Processing = 1,
    Succeeded = 2,
    Failed = 3
}
