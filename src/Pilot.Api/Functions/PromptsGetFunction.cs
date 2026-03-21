using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Pilot.Api.Services;
using Pilot.Core.DTOs;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class PromptsGetFunction
{
    private readonly IPromptRepository _promptRepository;
    private readonly RequestAuthHelper _authHelper;

    public PromptsGetFunction(
        IPromptRepository promptRepository,
        RequestAuthHelper authHelper)
    {
        _promptRepository = promptRepository;
        _authHelper = authHelper;
    }

    [Function("GetPrompt")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "prompts/{id}")] HttpRequestData req,
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

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new PromptResponse(
            prompt.Id, prompt.UserId, prompt.Title, prompt.Text, prompt.Author, prompt.AuthorEmail, prompt.CreatedAt, prompt.UpdatedAt
        ), cancellationToken);
        return response;
    }
}
