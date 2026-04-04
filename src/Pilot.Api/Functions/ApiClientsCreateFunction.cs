using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Pilot.Api.Services;
using Pilot.Core.Domain;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class ApiClientsCreateFunction
{
    private readonly RequestAuthHelper _authHelper;
    private readonly IUserApiClientRepository _apiClientRepository;

    public ApiClientsCreateFunction(RequestAuthHelper authHelper, IUserApiClientRepository apiClientRepository)
    {
        _authHelper = authHelper;
        _apiClientRepository = apiClientRepository;
    }

    [Function("ApiClientsCreate")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "api/auth/api-clients")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null)
        {
            var unauth = req.CreateResponse(HttpStatusCode.Unauthorized);
            await unauth.WriteAsJsonAsync(new { error = "Authorization required." }, cancellationToken);
            return unauth;
        }

        using var reader = new StreamReader(req.Body);
        var bodyStr = await reader.ReadToEndAsync(cancellationToken);
        var body = JsonSerializer.Deserialize<CreateApiClientRequest>(bodyStr, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });

        if (body == null || string.IsNullOrWhiteSpace(body.Name) || string.IsNullOrWhiteSpace(body.RedirectUri))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Name and RedirectUri are required." }, cancellationToken);
            return bad;
        }

        // Generate Client ID (random hex)
        var clientId = "pb_" + Convert.ToHexString(RandomNumberGenerator.GetBytes(12)).ToLowerInvariant();
        
        // Generate Client Secret (random base64)
        var rawSecret = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).Replace("+", "-").Replace("/", "_").TrimEnd('=');
        var secretHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawSecret))).ToLowerInvariant();

        var client = new UserApiClient
        {
            Id = clientId,
            UserId = auth.Value.UserId,
            Name = body.Name.Trim(),
            RedirectUri = body.RedirectUri.Trim(),
            SecretHash = secretHash,
            CreatedAt = DateTimeOffset.UtcNow,
            IsRevoked = false
        };

        await _apiClientRepository.CreateAsync(client, cancellationToken);

        var response = req.CreateResponse(HttpStatusCode.Created);
        await response.WriteAsJsonAsync(new
        {
            clientId = client.Id,
            clientSecret = rawSecret, // Shown only once
            name = client.Name,
            redirectUri = client.RedirectUri,
            createdAt = client.CreatedAt
        }, cancellationToken);
        
        return response;
    }

    public record CreateApiClientRequest(string Name, string RedirectUri);
}
