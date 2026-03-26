using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace Pilot.Api.Services;

public enum PostMediaKind
{
    Unknown,
    Image,
    Gif,
    Video
}

public sealed record PostMediaValidationResult(bool IsValid, string? ErrorMessage, PostMediaKind Kind);

public static class PostMediaRules
{
    public const int MaxItemsPerPost = 4;
    public const long MaxImageBytes = 20L * 1024 * 1024;
    public const long MaxGifBytes = 15L * 1024 * 1024;
    public const long MaxVideoBytes = 512L * 1024 * 1024;

    private static readonly HashSet<string> SupportedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/gif",
        "video/mp4"
    };

    public static PostMediaKind Classify(string? contentType, string? fileNameOrUrl = null)
    {
        if (!string.IsNullOrWhiteSpace(contentType))
        {
            if (contentType.Equals("image/gif", StringComparison.OrdinalIgnoreCase))
                return PostMediaKind.Gif;
            if (contentType.StartsWith("video/", StringComparison.OrdinalIgnoreCase))
                return PostMediaKind.Video;
            if (contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                return PostMediaKind.Image;
        }

        var ext = Path.GetExtension((fileNameOrUrl ?? string.Empty).Split('?')[0]).ToLowerInvariant();
        return ext switch
        {
            ".gif" => PostMediaKind.Gif,
            ".mp4" => PostMediaKind.Video,
            ".jpg" or ".jpeg" or ".png" or ".webp" => PostMediaKind.Image,
            _ => PostMediaKind.Unknown
        };
    }

    public static bool IsSupported(string? contentType, string? fileNameOrUrl = null)
    {
        if (!string.IsNullOrWhiteSpace(contentType) && SupportedContentTypes.Contains(contentType))
            return true;

        return Classify(contentType, fileNameOrUrl) != PostMediaKind.Unknown;
    }

    public static PostMediaValidationResult ValidateFile(string? contentType, string? fileNameOrUrl, long length)
    {
        if (!IsSupported(contentType, fileNameOrUrl))
        {
            return new(false, "Unsupported media type. Allowed: JPG, PNG, WEBP, GIF, MP4.", PostMediaKind.Unknown);
        }

        var kind = Classify(contentType, fileNameOrUrl);
        var maxBytes = kind switch
        {
            PostMediaKind.Video => MaxVideoBytes,
            PostMediaKind.Gif => MaxGifBytes,
            _ => MaxImageBytes
        };

        if (length > maxBytes)
        {
            var limitText = kind switch
            {
                PostMediaKind.Video => "512MB",
                PostMediaKind.Gif => "15MB",
                _ => "20MB"
            };
            return new(false, $"{kind} file exceeds the {limitText} limit.", kind);
        }

        return new(true, null, kind);
    }

    public static string? ValidateComposition(IEnumerable<PostMediaKind> mediaKinds)
    {
        var kinds = mediaKinds.Where(k => k != PostMediaKind.Unknown).ToList();
        if (kinds.Count == 0)
            return null;

        if (kinds.Count > MaxItemsPerPost)
            return $"A post can contain up to {MaxItemsPerPost} media items.";

        return null;
    }
}
