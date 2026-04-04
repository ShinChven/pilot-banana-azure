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

public class UsersUpdateFunction
{
    private readonly IUserRepository _userRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly RequestAuthHelper _authHelper;

    public UsersUpdateFunction(
        IUserRepository userRepository,
        IPasswordHasher passwordHasher,
        RequestAuthHelper authHelper,
        ILoggerFactory loggerFactory)
    {
        _userRepository = userRepository;
        _passwordHasher = passwordHasher;
        _authHelper = authHelper;
    }

    [Function("UpdateUser")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "patch", Route = "api/users/{id}")] HttpRequestData req,
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

        var user = await _userRepository.GetByIdAsync(id, cancellationToken);
        if (user == null)
        {
            var notFound = req.CreateResponse(HttpStatusCode.NotFound);
            await notFound.WriteAsJsonAsync(new { error = "User not found." }, cancellationToken);
            return notFound;
        }

        // Only admins can update other users, but a user can update themselves (like name)
        if (auth.Value.Role != UserRole.Admin && auth.Value.UserId != id)
        {
            var forbidden = req.CreateResponse(HttpStatusCode.Forbidden);
            await forbidden.WriteAsJsonAsync(new { error = "Not authorized to update this user." }, cancellationToken);
            return forbidden;
        }

        UpdateUserRequest? body;
        try
        {
            body = await JsonSerializer.DeserializeAsync<UpdateUserRequest>(req.Body, cancellationToken: cancellationToken);
        }
        catch (JsonException)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Invalid JSON." }, cancellationToken);
            return bad;
        }

        if (body != null)
        {
            if (body.Email != null && auth.Value.Role == UserRole.Admin)
            {
                var email = body.Email.Trim();
                if (string.IsNullOrEmpty(email))
                {
                    var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                    await bad.WriteAsJsonAsync(new { error = "Email cannot be empty." }, cancellationToken);
                    return bad;
                }
                user.Email = email;
            }
            if (body.Name != null)
            {
                user.Name = body.Name.Trim();
            }
            if (body.AvatarSeed != null)
            {
                user.AvatarSeed = body.AvatarSeed.Trim();
            }
            if (body.Disabled.HasValue && auth.Value.Role == UserRole.Admin)
            {
                if (body.Disabled.Value && id == auth.Value.UserId)
                {
                    var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                    await bad.WriteAsJsonAsync(new { error = "You cannot disable yourself." }, cancellationToken);
                    return bad;
                }
                user.Disabled = body.Disabled.Value;
            }
            if (body.Role != null && auth.Value.Role == UserRole.Admin && Enum.TryParse<UserRole>(body.Role, ignoreCase: true, out var role))
                user.Role = role;

            if (!string.IsNullOrEmpty(body.Password))
            {
                user.PasswordHash = _passwordHasher.HashPassword(body.Password);
            }
            else if (body.DeletePassword == true)
            {
                bool hasOtherMethods = (user.Passkeys?.Count > 0) || !string.IsNullOrEmpty(user.ExternalIdpRef);
                if (!hasOtherMethods)
                {
                    var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                    await bad.WriteAsJsonAsync(new { error = "Cannot delete password without at least one passkey or external identity provider." }, cancellationToken);
                    return bad;
                }
                user.PasswordHash = null;
            }

            user.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await _userRepository.UpdateAsync(user, cancellationToken);

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new UserResponse(
            user.Id, 
            user.Email, 
            user.Name ?? user.Email.Split('@')[0], 
            user.AvatarSeed ?? user.Id,
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
