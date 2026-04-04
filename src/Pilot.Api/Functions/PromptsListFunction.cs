using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Pilot.Api.Services;
using Pilot.Core.DTOs;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class PromptsListFunction
{
    private readonly IPromptRepository _promptRepository;
    private readonly RequestAuthHelper _authHelper;
    private readonly ILogger _logger;

    public PromptsListFunction(
        IPromptRepository promptRepository,
        RequestAuthHelper authHelper,
        ILoggerFactory loggerFactory)
    {
        _promptRepository = promptRepository;
        _authHelper = authHelper;
        _logger = loggerFactory.CreateLogger<PromptsListFunction>();
    }

    [Function("ListPrompts")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "api/prompts")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null)
        {
            var unauth = req.CreateResponse(HttpStatusCode.Unauthorized);
            await unauth.WriteAsJsonAsync(new { error = "Authorization required." }, cancellationToken);
            return unauth;
        }

        var queryDictionary = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
        int page = 1;
        int pageSize = 10;

        if (int.TryParse(queryDictionary["page"], out int parsedPage) && parsedPage > 0)
            page = parsedPage;
        if (int.TryParse(queryDictionary["pageSize"], out int parsedPageSize) && parsedPageSize > 0)
            pageSize = parsedPageSize;

        var (prompts, total) = await _promptRepository.ListPaginatedByUserIdAsync(auth.Value.UserId, page, pageSize, cancellationToken);

        var dtos = prompts.Select(p => new PromptResponse(
            p.Id, p.UserId, p.Title, p.Text, p.Author, p.AuthorEmail, p.CreatedAt, p.UpdatedAt
        )).ToList();

        var result = new PaginatedList<PromptResponse>
        {
            Items = dtos,
            Total = total,
            Page = page,
            PageSize = pageSize
        };

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(result, cancellationToken);
        return response;
    }
}
