using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Pilot.Api.Services;
using Pilot.Core.Domain;
using Pilot.Core.DTOs;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class UsersListFunction
{
    private readonly IUserRepository _userRepository;
    private readonly RequestAuthHelper _authHelper;

    public UsersListFunction(
        IUserRepository userRepository,
        RequestAuthHelper authHelper,
        ILoggerFactory loggerFactory)
    {
        _userRepository = userRepository;
        _authHelper = authHelper;
    }

    [Function("ListUsers")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "api/users")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null)
        {
            var unauth = req.CreateResponse(HttpStatusCode.Unauthorized);
            await unauth.WriteAsJsonAsync(new { error = "Authorization required." }, cancellationToken);
            return unauth;
        }
        if (auth.Value.Role != UserRole.Admin)
        {
            var forbidden = req.CreateResponse(HttpStatusCode.Forbidden);
            await forbidden.WriteAsJsonAsync(new { error = "Admin role required." }, cancellationToken);
            return forbidden;
        }

        var queryDictionary = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
        int page = 1;
        int pageSize = 10;

        if (int.TryParse(queryDictionary["page"], out int parsedPage) && parsedPage > 0)
            page = parsedPage;
        if (int.TryParse(queryDictionary["pageSize"], out int parsedPageSize) && parsedPageSize > 0)
            pageSize = parsedPageSize;

        var (users, total) = await _userRepository.ListPaginatedAllAsync(page, pageSize, cancellationToken);
        var dtos = users.Select(u => new UserResponse(
            u.Id, 
            u.Email, 
            u.Name ?? u.Email.Split('@')[0], 
            u.AvatarSeed ?? u.Id,
            u.Role.ToString(), 
            u.Disabled, 
            !string.IsNullOrEmpty(u.PasswordHash),
            u.Passkeys?.Count ?? 0,
            u.CreatedAt, 
            u.UpdatedAt
        )).ToList();

        var result = new PaginatedList<UserResponse>
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
