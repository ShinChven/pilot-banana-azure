using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Pilot.Core.Services;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using SixLabors.ImageSharp.Formats.Jpeg;

namespace Pilot.Infrastructure.Media;

public class ImageOptimizer : IImageOptimizer
{
    private const int OptimizedMaxDimension = 2048;
    private const int XUploadMaxDimension = 4096;
    private const int ThumbnailSize = 320;
    private const int DefaultJpegQuality = 95;
    private static readonly int[] XUploadQualities = [92, 88, 84, 80, 76, 72, 68, 64, 60];
    private static readonly double[] XDownscaleFactors = [0.75, 0.5, 0.35];

    public bool Supports(string? contentType)
    {
        if (string.IsNullOrEmpty(contentType)) return false;
        
        contentType = contentType.ToLowerInvariant();
        return contentType == "image/jpeg" || 
               contentType == "image/png" || 
               contentType == "image/webp" || 
               contentType == "image/gif";
    }

    public async Task<Stream> CreateOptimizedAsync(Stream original, CancellationToken cancellationToken = default)
    {
        var output = new MemoryStream();
        using var image = await Image.LoadAsync(original, cancellationToken);
        
        // Downscale if larger than 1600px
        if (image.Width > OptimizedMaxDimension || image.Height > OptimizedMaxDimension)
        {
            image.Mutate(x => x.Resize(new ResizeOptions
            {
                Size = new Size(OptimizedMaxDimension, OptimizedMaxDimension),
                Mode = ResizeMode.Max
            }));
        }

        await image.SaveAsJpegAsync(output, new JpegEncoder { Quality = DefaultJpegQuality }, cancellationToken);
        output.Position = 0;
        return output;
    }

    public async Task<(Stream Optimized, Stream Thumbnail)> CreateAllVersionsAsync(Stream original, CancellationToken cancellationToken = default)
    {
        // Load original once
        using var image = await Image.LoadAsync(original, cancellationToken);

        // 1. Optimized Version
        var optOutput = new MemoryStream();
        using (var optImage = image.Clone(x => {
            if (image.Width > OptimizedMaxDimension || image.Height > OptimizedMaxDimension)
            {
                x.Resize(new ResizeOptions
                {
                    Size = new Size(OptimizedMaxDimension, OptimizedMaxDimension),
                    Mode = ResizeMode.Max
                });
            }
        }))
        {
            await optImage.SaveAsJpegAsync(optOutput, new JpegEncoder { Quality = DefaultJpegQuality }, cancellationToken);
        }
        optOutput.Position = 0;

        // 2. Thumbnail Version
        var thumbOutput = new MemoryStream();
        using (var thumbImage = image.Clone(x => x.Resize(new ResizeOptions
        {
            Size = new Size(ThumbnailSize, ThumbnailSize),
            Mode = ResizeMode.Crop
        })))
        {
            await thumbImage.SaveAsJpegAsync(thumbOutput, new JpegEncoder { Quality = DefaultJpegQuality }, cancellationToken);
        }
        thumbOutput.Position = 0;

        return (optOutput, thumbOutput);
    }

    public async Task<(Stream Optimized, string ContentType)> CreateXUploadAsync(Stream original, long targetBytes, CancellationToken cancellationToken = default)
    {
        using var image = await Image.LoadAsync(original, cancellationToken);

        image.Mutate(x => x.AutoOrient());

        if (image.Width > XUploadMaxDimension || image.Height > XUploadMaxDimension)
        {
            image.Mutate(x => x.Resize(new ResizeOptions
            {
                Size = new Size(XUploadMaxDimension, XUploadMaxDimension),
                Mode = ResizeMode.Max
            }));
        }

        // First pass: try lowering quality at current resolution
        var result = await TryEncodeUnderTarget(image, targetBytes, cancellationToken);
        if (result != null)
            return (result, "image/jpeg");

        // Second pass: progressively downscale and retry quality ladder
        foreach (var factor in XDownscaleFactors)
        {
            var newWidth = Math.Max(1, (int)(image.Width * factor));
            var newHeight = Math.Max(1, (int)(image.Height * factor));
            using var scaled = image.Clone(x => x.Resize(newWidth, newHeight));

            var scaledResult = await TryEncodeUnderTarget(scaled, targetBytes, cancellationToken);
            if (scaledResult != null)
                return (scaledResult, "image/jpeg");
        }

        // Last resort: smallest scale, lowest quality — return whatever we get
        var lastWidth = Math.Max(1, (int)(image.Width * XDownscaleFactors[^1]));
        var lastHeight = Math.Max(1, (int)(image.Height * XDownscaleFactors[^1]));
        using var lastScaled = image.Clone(x => x.Resize(lastWidth, lastHeight));
        var fallback = new MemoryStream();
        await lastScaled.SaveAsJpegAsync(fallback, new JpegEncoder { Quality = XUploadQualities[^1] }, cancellationToken);
        fallback.Position = 0;
        return (fallback, "image/jpeg");
    }

    private static async Task<MemoryStream?> TryEncodeUnderTarget(Image image, long targetBytes, CancellationToken cancellationToken)
    {
        foreach (var quality in XUploadQualities)
        {
            var output = new MemoryStream();
            await image.SaveAsJpegAsync(output, new JpegEncoder { Quality = quality }, cancellationToken);
            output.Position = 0;

            if (output.Length <= targetBytes)
                return output;

            output.Dispose();
        }

        return null;
    }
}
