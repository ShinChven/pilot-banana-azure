using System.Net;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Pilot.Api.Services;
using Pilot.Core.Domain;
using Pilot.Core.DTOs;
using Pilot.Core.Repositories;
using Pilot.Core.Services;

namespace Pilot.Api.Functions;

public class UsersCreateFunction
{
    private readonly IUserRepository _userRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly RequestAuthHelper _authHelper;

    public UsersCreateFunction(
        IUserRepository userRepository,
        IPasswordHasher passwordHasher,
        RequestAuthHelper authHelper,
        ILoggerFactory loggerFactory)
    {
        _userRepository = userRepository;
        _passwordHasher = passwordHasher;
        _authHelper = authHelper;
    }

    [Function("CreateUser")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "users")] HttpRequestData req,
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

        CreateUserRequest? body;
        try
        {
            body = await JsonSerializer.DeserializeAsync<CreateUserRequest>(req.Body, cancellationToken: cancellationToken);
        }
        catch (JsonException)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Invalid JSON. Expect { email, name, role, password? }." }, cancellationToken);
            return bad;
        }

        if (body == null || string.IsNullOrWhiteSpace(body.Email))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Email and role are required." }, cancellationToken);
            return bad;
        }
        if (!Enum.TryParse<UserRole>(body.Role, ignoreCase: true, out var role))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Role must be User or Admin." }, cancellationToken);
            return bad;
        }

        var existing = await _userRepository.GetByEmailAsync(body.Email.Trim(), cancellationToken);
        if (existing != null)
        {
            var conflict = req.CreateResponse(HttpStatusCode.Conflict);
            await conflict.WriteAsJsonAsync(new { error = "User with this email already exists." }, cancellationToken);
            return conflict;
        }

        var user = new Pilot.Core.Domain.User
        {
            Id = Guid.NewGuid().ToString("N"),
            Email = body.Email.Trim(),
            Name = body.Name?.Trim() ?? body.Email.Split('@')[0],
            AvatarSeed = Guid.NewGuid().ToString("N"),
            Role = role,
            PasswordHash = string.IsNullOrEmpty(body.Password) ? null : _passwordHasher.HashPassword(body.Password),
            Disabled = false,
            CreatedAt = DateTimeOffset.UtcNow
        };
        await _userRepository.CreateAsync(user, cancellationToken);

        var response = req.CreateResponse(HttpStatusCode.Created);
        await response.WriteAsJsonAsync(new UserResponse(
            user.Id, 
            user.Email, 
            user.Name, 
            user.AvatarSeed, 
            user.Role.ToString(), 
            user.Disabled, 
            !string.IsNullOrEmpty(user.PasswordHash),
            user.Passkeys?.Count ?? 0,
            user.CreatedAt, 
            user.UpdatedAt
        ), cancellationToken);
        return response;
    }
}
