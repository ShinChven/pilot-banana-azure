using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace Pilot.Core.Services;

public interface IImageOptimizer
{
    /// <summary>
    /// Checks if a file can be optimized based on its content type.
    /// </summary>
    bool Supports(string? contentType);

    /// <summary>
    /// Generates an optimized version of the image (max 1600px).
    /// </summary>
    Task<Stream> CreateOptimizedAsync(Stream original, CancellationToken cancellationToken = default);

    /// <summary>
    /// Generates both optimized and thumbnail versions of the image in a single pass.
    /// Returns (OptimizedStream, ThumbnailStream).
    /// </summary>
    Task<(Stream Optimized, Stream Thumbnail)> CreateAllVersionsAsync(Stream original, CancellationToken cancellationToken = default);

    /// <summary>
    /// Generates an X-safe image upload while preserving the original resolution up to a 4K long edge,
    /// then progressively lowering JPEG quality until the target byte size is met.
    /// Returns (OptimizedStream, ContentType).
    /// </summary>
    Task<(Stream Optimized, string ContentType)> CreateXUploadAsync(Stream original, long targetBytes, CancellationToken cancellationToken = default);
}
