using System.Net;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Pilot.Api.Services;
using Pilot.Core.DTOs;
using Pilot.Core.Repositories;
using Pilot.Core.Services;

namespace Pilot.Api.Functions;

public class AuthMeFunction
{
    private readonly RequestAuthHelper _authHelper;
    private readonly IUserRepository _userRepository;
    private readonly IPasswordHasher _passwordHasher;

    public AuthMeFunction(RequestAuthHelper authHelper, IUserRepository userRepository, IPasswordHasher passwordHasher)
    {
        _authHelper = authHelper;
        _userRepository = userRepository;
        _passwordHasher = passwordHasher;
    }

    [Function("AuthMe")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", "patch", Route = "api/auth/me")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null)
        {
            var unauth = req.CreateResponse(HttpStatusCode.Unauthorized);
            await unauth.WriteAsJsonAsync(new { error = "Authorization required." }, cancellationToken);
            return unauth;
        }

        var user = await _userRepository.GetByIdAsync(auth.Value.UserId, cancellationToken);
        if (user == null)
        {
            var notFound = req.CreateResponse(HttpStatusCode.NotFound);
            await notFound.WriteAsJsonAsync(new { error = "User not found." }, cancellationToken);
            return notFound;
        }

        if (req.Method.Equals("PATCH", StringComparison.OrdinalIgnoreCase))
        {
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
                if (body.Name != null)
                {
                    user.Name = body.Name.Trim();
                }
                if (body.AvatarSeed != null)
                {
                    user.AvatarSeed = body.AvatarSeed.Trim();
                }
                
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
                
                await _userRepository.UpdateAsync(user, cancellationToken);
            }
        }

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new MeResponse(
            user.Id, 
            user.Email, 
            user.Role.ToString(), 
            user.Name ?? user.Email.Split('@')[0],
            user.AvatarSeed ?? user.Id,
            !string.IsNullOrEmpty(user.PasswordHash),
            user.Passkeys?.Count ?? 0
        ), cancellationToken);
        return response;
    }
}
