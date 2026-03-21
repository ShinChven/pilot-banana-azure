namespace Pilot.Core.Adapters;

/// <summary>
/// Input for publishing a single post to a channel. Used by <see cref="IPlatformAdapter"/>.
/// </summary>
public class PostRequest
{
    /// <summary>Asset blob URLs (up to 4 for X/Twitter).</summary>
    public List<string> MediaUrls { get; set; } = new();
    /// <summary>Optional text/caption (subject to platform limits).</summary>
    public string? Text { get; set; }
    /// <summary>Optional link to include.</summary>
    public string? Link { get; set; }
    /// <summary>Content type of the asset, e.g. image/jpeg.</summary>
    public string? ContentType { get; set; }
}
