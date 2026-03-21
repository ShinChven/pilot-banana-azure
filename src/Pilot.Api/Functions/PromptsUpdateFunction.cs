using System.Net;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Pilot.Api.Services;
using Pilot.Core.DTOs;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class PromptsUpdateFunction
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly IPromptRepository _promptRepository;
    private readonly RequestAuthHelper _authHelper;

    public PromptsUpdateFunction(
        IPromptRepository promptRepository,
        RequestAuthHelper authHelper)
    {
        _promptRepository = promptRepository;
        _authHelper = authHelper;
    }

    [Function("UpdatePrompt")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "patch", Route = "prompts/{id}")] HttpRequestData req,
        string id,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null)
        {
            var unauth = req.CreateResponse(HttpStatusCode.Unauthorized);
            await unauth.WriteAsJsonAsync(new { error = "Authorization required." }, cancellationToken);
            return unauth;
        }

        var prompt = await _promptRepository.GetByIdAsync(auth.Value.UserId, id, cancellationToken);
        if (prompt == null)
        {
            var notFound = req.CreateResponse(HttpStatusCode.NotFound);
            await notFound.WriteAsJsonAsync(new { error = "Prompt not found." }, cancellationToken);
            return notFound;
        }

        UpdatePromptRequest? body;
        try
        {
            body = await JsonSerializer.DeserializeAsync<UpdatePromptRequest>(req.Body, JsonOptions, cancellationToken: cancellationToken);
        }
        catch (JsonException)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Invalid JSON." }, cancellationToken);
            return bad;
        }

        if (body != null)
        {
            if (body.Title != null) prompt.Title = body.Title.Trim();
            if (body.Text != null) prompt.Text = body.Text.Trim();
            prompt.Author = auth.Value.Name ?? auth.Value.Email ?? auth.Value.UserId;
            prompt.AuthorEmail = auth.Value.Email;
            prompt.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await _promptRepository.UpdateAsync(prompt, cancellationToken);

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new PromptResponse(
            prompt.Id, prompt.UserId, prompt.Title, prompt.Text, prompt.Author, prompt.AuthorEmail, prompt.CreatedAt, prompt.UpdatedAt
        ), cancellationToken);
        return response;
    }
}
