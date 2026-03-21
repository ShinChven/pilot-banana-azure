using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Pilot.Api.Services;
using Pilot.Core.DTOs;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class CampaignsListFunction
{
    private readonly ICampaignRepository _campaignRepository;
    private readonly RequestAuthHelper _authHelper;
    private readonly ILogger _logger;

    public CampaignsListFunction(
        ICampaignRepository campaignRepository,
        RequestAuthHelper authHelper,
        ILoggerFactory loggerFactory)
    {
        _campaignRepository = campaignRepository;
        _authHelper = authHelper;
        _logger = loggerFactory.CreateLogger<CampaignsListFunction>();
    }

    [Function("ListCampaigns")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "campaigns")] HttpRequestData req,
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

        var (campaigns, total) = await _campaignRepository.ListPaginatedByUserIdAsync(auth.Value.UserId, page, pageSize, cancellationToken);

        var dtos = campaigns.Select(c => new CampaignResponse(
            c.Id, c.UserId, c.Name, c.Description, c.ChannelLinkIds ?? new List<string>(), c.Status.ToString(), c.CreatedAt, c.UpdatedAt
        )).ToList();

        var result = new PaginatedList<CampaignResponse>
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
