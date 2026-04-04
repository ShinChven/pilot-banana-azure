using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Configuration;

namespace Pilot.Api.Functions;

public class OAuthAuthorizationServerMetadataFunction
{
    private readonly string _baseUrl;

    public OAuthAuthorizationServerMetadataFunction(IConfiguration configuration)
    {
        var raw = configuration["ApiBaseUrl"] ?? "http://localhost:7071";
        _baseUrl = raw.TrimEnd('/');
    }

    /// <summary>
    /// RFC 8414 — Authorization Server Metadata.
    /// Claude fetches this to discover OAuth endpoints and capabilities.
    /// </summary>
    [Function("OAuthAuthorizationServerMetadata")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = ".well-known/oauth-authorization-server")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new
        {
            issuer = _baseUrl,
            authorization_endpoint = $"{_baseUrl}/api/oauth/authorize",
            token_endpoint = $"{_baseUrl}/api/oauth/token",
            registration_endpoint = $"{_baseUrl}/api/oauth/register",
            scopes_supported = new[] { "mcp" },
            response_types_supported = new[] { "code" },
            grant_types_supported = new[] { "authorization_code" },
            code_challenge_methods_supported = new[] { "S256" },
            token_endpoint_auth_methods_supported = new[] { "none" }
        }, cancellationToken);
        return response;
    }
}
