using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Pilot.Api.Services;
using Pilot.Core.Domain;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

/// <summary>
/// Soft deletes a user (marks as IsDeleted). Admin only.
/// </summary>
public class UsersDeleteFunction
{
    private readonly IUserRepository _userRepository;
    private readonly RequestAuthHelper _authHelper;

    public UsersDeleteFunction(
        IUserRepository userRepository,
        RequestAuthHelper authHelper,
        ILoggerFactory loggerFactory)
    {
        _userRepository = userRepository;
        _authHelper = authHelper;
    }

    [Function("DeleteUser")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "users/{id}")] HttpRequestData req,
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
        if (auth.Value.Role != UserRole.Admin)
        {
            var forbidden = req.CreateResponse(HttpStatusCode.Forbidden);
            await forbidden.WriteAsJsonAsync(new { error = "Admin role required." }, cancellationToken);
            return forbidden;
        }

        if (id == auth.Value.UserId)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "You cannot delete yourself." }, cancellationToken);
            return bad;
        }

        var user = await _userRepository.GetByIdAsync(id, cancellationToken);
        if (user == null)
        {
            var notFound = req.CreateResponse(HttpStatusCode.NotFound);
            await notFound.WriteAsJsonAsync(new { error = "User not found." }, cancellationToken);
            return notFound;
        }

        user.IsDeleted = true;
        user.UpdatedAt = DateTimeOffset.UtcNow;
        await _userRepository.UpdateAsync(user, cancellationToken);

        return req.CreateResponse(HttpStatusCode.NoContent);
    }
}
