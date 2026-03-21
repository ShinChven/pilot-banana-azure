namespace Pilot.Core.DTOs;

public record CreatePromptRequest(string Title, string Text, string? Author = null);

public record UpdatePromptRequest(string? Title, string? Text, string? Author = null);

public record PromptResponse(
    string Id,
    string UserId,
    string Title,
    string Text,
    string Author,
    string? AuthorEmail,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt
);
