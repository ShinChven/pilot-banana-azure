namespace Pilot.Core.Adapters;

/// <summary>
/// Result of a publish operation from <see cref="IPlatformAdapter"/>.
/// </summary>
public class PostResult
{
    public bool Success { get; set; }
    /// <summary>External post id from the platform.</summary>
    public string? ExternalPostId { get; set; }
    /// <summary>External post URL from the platform.</summary>
    public string? PostUrl { get; set; }
    /// <summary>Error message when Success is false.</summary>
    public string? ErrorMessage { get; set; }
}
