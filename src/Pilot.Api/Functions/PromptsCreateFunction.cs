using System.Net;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Pilot.Api.Services;
using Pilot.Core.Domain;
using Pilot.Core.DTOs;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class PromptsCreateFunction
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly IPromptRepository _promptRepository;
    private readonly RequestAuthHelper _authHelper;
    private readonly ILogger _logger;

    public PromptsCreateFunction(
        IPromptRepository promptRepository,
        RequestAuthHelper authHelper,
        ILoggerFactory loggerFactory)
    {
        _promptRepository = promptRepository;
        _authHelper = authHelper;
        _logger = loggerFactory.CreateLogger<PromptsCreateFunction>();
    }

    [Function("CreatePrompt")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "prompts")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null)
        {
            var unauth = req.CreateResponse(HttpStatusCode.Unauthorized);
            await unauth.WriteAsJsonAsync(new { error = "Authorization required." }, cancellationToken);
            return unauth;
        }

        CreatePromptRequest? body;
        try
        {
            body = await JsonSerializer.DeserializeAsync<CreatePromptRequest>(req.Body, JsonOptions, cancellationToken: cancellationToken);
        }
        catch (JsonException)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Invalid JSON." }, cancellationToken);
            return bad;
        }

        if (body == null || string.IsNullOrWhiteSpace(body.Title) || string.IsNullOrWhiteSpace(body.Text))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Title and Text are required." }, cancellationToken);
            return bad;
        }

        var prompt = new Prompt
        {
            Id = Guid.NewGuid().ToString("N"),
            UserId = auth.Value.UserId,
            Title = body.Title.Trim(),
            Text = body.Text.Trim(),
            Author = auth.Value.Name ?? auth.Value.Email ?? auth.Value.UserId,
            AuthorEmail = auth.Value.Email,
            CreatedAt = DateTimeOffset.UtcNow
        };
        await _promptRepository.CreateAsync(prompt, cancellationToken);

        var response = req.CreateResponse(HttpStatusCode.Created);
        await response.WriteAsJsonAsync(new PromptResponse(
            prompt.Id, prompt.UserId, prompt.Title, prompt.Text, prompt.Author, prompt.AuthorEmail, prompt.CreatedAt, prompt.UpdatedAt
        ), cancellationToken);
        return response;
    }
}
