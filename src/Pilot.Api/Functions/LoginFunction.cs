using System.Net;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Pilot.Core.DTOs;
using Pilot.Core.Repositories;
using Pilot.Core.Services;
using Pilot.Infrastructure.Auth;

namespace Pilot.Api.Functions;

public class LoginFunction
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly IUserRepository _userRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly ILogger _logger;

    public LoginFunction(
        IUserRepository userRepository,
        IPasswordHasher passwordHasher,
        IJwtTokenService jwtTokenService,
        ILoggerFactory loggerFactory)
    {
        _userRepository = userRepository;
        _passwordHasher = passwordHasher;
        _jwtTokenService = jwtTokenService;
        _logger = loggerFactory.CreateLogger<LoginFunction>();
    }

    [Function("Login")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "auth/login")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        LoginRequest? body;
        try
        {
            body = await JsonSerializer.DeserializeAsync<LoginRequest>(req.Body, cancellationToken: cancellationToken);
        }
        catch (JsonException)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Invalid JSON body. Expect { email, password }." }, cancellationToken);
            return bad;
        }

        if (body == null || string.IsNullOrWhiteSpace(body.Email) || string.IsNullOrWhiteSpace(body.Password))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Email and password are required." }, cancellationToken);
            return bad;
        }

        var user = await _userRepository.GetByEmailAsync(body.Email.Trim(), cancellationToken);
        if (user == null || user.Disabled)
        {
            _logger.LogWarning("Login failed: user not found or disabled {Email}", body.Email);
            var unauth = req.CreateResponse(HttpStatusCode.Unauthorized);
            await unauth.WriteAsJsonAsync(new { error = "Invalid email or password." }, cancellationToken);
            return unauth;
        }

        if (string.IsNullOrEmpty(user.PasswordHash))
        {
            _logger.LogWarning("Login failed: no password set for user {Email}", body.Email);
            var unauth = req.CreateResponse(HttpStatusCode.Unauthorized);
            await unauth.WriteAsJsonAsync(new { error = "Invalid email or password." }, cancellationToken);
            return unauth;
        }

        if (!_passwordHasher.VerifyPassword(body.Password, user.PasswordHash))
        {
            _logger.LogWarning("Login failed: bad password for {Email}", body.Email);
            var unauth = req.CreateResponse(HttpStatusCode.Unauthorized);
            await unauth.WriteAsJsonAsync(new { error = "Invalid email or password." }, cancellationToken);
            return unauth;
        }

        var tokenResponse = _jwtTokenService.IssueToken(user, body.RememberMe);
        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(tokenResponse, cancellationToken);
        return response;
    }
}
