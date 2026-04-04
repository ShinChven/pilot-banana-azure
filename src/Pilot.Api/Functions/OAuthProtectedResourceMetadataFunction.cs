using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Configuration;

namespace Pilot.Api.Functions;

public class OAuthProtectedResourceMetadataFunction
{
    private readonly string _baseUrl;

    public OAuthProtectedResourceMetadataFunction(IConfiguration configuration)
    {
        var raw = configuration["ApiBaseUrl"] ?? "http://localhost:7071";
        _baseUrl = raw.TrimEnd('/');
    }

    /// <summary>
    /// RFC 9728 — Protected Resource Metadata (canonical well-known path).
    /// Claude.ai and Claude Desktop require this at /.well-known/oauth-protected-resource.
    /// </summary>
    [Function("OAuthProtectedResourceMetadataWellKnown")]
    public async Task<HttpResponseData> RunWellKnown(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = ".well-known/oauth-protected-resource")] HttpRequestData req,
        CancellationToken cancellationToken)
        => await BuildResponse(req, cancellationToken);

    /// <summary>
    /// RFC 9728 — Protected Resource Metadata (legacy /api path, kept for backward compatibility).
    /// </summary>
    [Function("OAuthProtectedResourceMetadata")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "api/oauth-protected-resource")] HttpRequestData req,
        CancellationToken cancellationToken)
        => await BuildResponse(req, cancellationToken);

    private async Task<HttpResponseData> BuildResponse(HttpRequestData req, CancellationToken cancellationToken)
    {
        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new
        {
            resource = $"{_baseUrl}/api/mcp",
            authorization_servers = new[] { _baseUrl },
            scopes_supported = new[] { "mcp" }
        }, cancellationToken);
        return response;
    }
}
