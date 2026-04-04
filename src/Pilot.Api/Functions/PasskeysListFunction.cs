using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Pilot.Api.Services;
using Pilot.Core.DTOs;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class PasskeysListFunction
{
    private readonly ILogger _logger;
    private readonly IUserRepository _userRepository;
    private readonly RequestAuthHelper _authHelper;

    public PasskeysListFunction(IUserRepository userRepository, RequestAuthHelper authHelper, ILoggerFactory loggerFactory)
    {
        _userRepository = userRepository;
        _authHelper = authHelper;
        _logger = loggerFactory.CreateLogger<PasskeysListFunction>();
    }

    [Function("ListPasskeys")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "api/auth/passkeys")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null)
        {
            var unauth = req.CreateResponse(HttpStatusCode.Unauthorized);
            return unauth;
        }

        var user = await _userRepository.GetByIdAsync(auth.Value.UserId, cancellationToken);
        if (user == null)
        {
            var notFound = req.CreateResponse(HttpStatusCode.NotFound);
            return notFound;
        }

        var responseData = user.Passkeys?.Select(p => new PasskeyResponse(p.CredentialId, p.Label, p.CreatedAt)).ToList() ?? new List<PasskeyResponse>();
        _logger.LogInformation("ListPasskeys for user {UserId} returning {Count} items", auth.Value.UserId, responseData.Count);
        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(responseData, cancellationToken);
        return response;
    }
}
