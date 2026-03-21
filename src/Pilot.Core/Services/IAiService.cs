namespace Pilot.Core.Services;

public interface IAiService
{
    /// <summary>
    /// Generates text content for a post using a multimodal AI model.
    /// </summary>
    /// <param name="images">The image assets as byte arrays.</param>
    /// <param name="prompt">The user-provided or template-based prompt.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The generated text.</returns>
    Task<string> GeneratePostTextAsync(List<byte[]> images, string prompt, CancellationToken ct = default);
}
