using System.Net;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Pilot.Core.Domain;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class OAuthRegisterFunction
{
    private static readonly string[] SupportedGrantTypes = ["authorization_code"];
    private static readonly string[] DefaultGrantTypes = SupportedGrantTypes;
    private static readonly string[] DefaultResponseTypes = ["code"];
    private const int PerIpLimitPerHour = 1000;
    private const int GlobalLimitPerHour = 1000;
    private static readonly TimeSpan RegistrationWindow = TimeSpan.FromHours(1);
    private static readonly TimeSpan StaleDynamicClientTtl = TimeSpan.FromDays(30);
    private const int CleanupBatchSize = 100;
    private readonly IUserApiClientRepository _apiClientRepository;

    public OAuthRegisterFunction(IUserApiClientRepository apiClientRepository)
    {
        _apiClientRepository = apiClientRepository;
    }

    [Function("OAuthRegister")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "api/oauth/register")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        await CleanupStaleDynamicClientsAsync(cancellationToken);

        OAuthRegistrationRequest? body;
        try
        {
            body = await JsonSerializer.DeserializeAsync<OAuthRegistrationRequest>(req.Body, cancellationToken: cancellationToken);
        }
        catch (JsonException)
        {
            return await CreateErrorAsync(req, HttpStatusCode.BadRequest, "invalid_client_metadata", "Invalid JSON body.", cancellationToken);
        }

        if (body == null)
            return await CreateErrorAsync(req, HttpStatusCode.BadRequest, "invalid_client_metadata", "Request body is required.", cancellationToken);

        if (body.RedirectUris == null || body.RedirectUris.Length == 0)
            return await CreateErrorAsync(req, HttpStatusCode.BadRequest, "invalid_client_metadata", "redirect_uris is required.", cancellationToken);
        if (body.RedirectUris.Length != 1)
            return await CreateErrorAsync(req, HttpStatusCode.BadRequest, "invalid_client_metadata", "Exactly one redirect_uri is supported.", cancellationToken);

        foreach (var redirectUri in body.RedirectUris)
        {
            if (!TryValidateRedirectUri(redirectUri, out var error))
                return await CreateErrorAsync(req, HttpStatusCode.BadRequest, "invalid_redirect_uri", error, cancellationToken);
        }

        var authMethod = string.IsNullOrWhiteSpace(body.TokenEndpointAuthMethod) ? "none" : body.TokenEndpointAuthMethod.Trim();
        if (!string.Equals(authMethod, "none", StringComparison.Ordinal))
        {
            return await CreateErrorAsync(
                req,
                HttpStatusCode.BadRequest,
                "invalid_client_metadata",
                "Only token_endpoint_auth_method='none' is supported.",
                cancellationToken);
        }

        var requestIp = GetRequesterIp(req) ?? "unknown";
        var now = DateTimeOffset.UtcNow;
        var windowStart = now.Subtract(RegistrationWindow);
        var globalCount = await _apiClientRepository.CountDynamicCreatedSinceAsync(windowStart, cancellationToken);
        if (globalCount >= GlobalLimitPerHour)
            return await CreateRateLimitedAsync(req, "Too many client registrations. Try again later.", cancellationToken);

        var ipCount = await _apiClientRepository.CountDynamicCreatedSinceByIpAsync(requestIp, windowStart, cancellationToken);
        if (ipCount >= PerIpLimitPerHour)
            return await CreateRateLimitedAsync(req, "Too many registrations from this IP. Try again later.", cancellationToken);

        var clientId = "dyn_" + Convert.ToHexString(RandomNumberGenerator.GetBytes(12)).ToLowerInvariant();
        var created = await _apiClientRepository.CreateAsync(new UserApiClient
        {
            Id = clientId,
            UserId = "dynamic",
            Name = string.IsNullOrWhiteSpace(body.ClientName) ? "Dynamic Client" : body.ClientName.Trim(),
            RedirectUri = body.RedirectUris[0],
            SecretHash = null,
            IsDynamic = true,
            RegistrationSource = body.ClientName?.Trim(),
            RegistrationIp = requestIp,
            CreatedAt = now,
            IsRevoked = false
        }, cancellationToken);

        var grantTypes = NormalizeGrantTypes(body.GrantTypes);

        var response = req.CreateResponse(HttpStatusCode.Created);
        await response.WriteAsJsonAsync(new
        {
            client_id = created.Id,
            client_name = created.Name,
            redirect_uris = body.RedirectUris,
            grant_types = grantTypes,
            response_types = body.ResponseTypes is { Length: > 0 } ? body.ResponseTypes : DefaultResponseTypes,
            token_endpoint_auth_method = "none"
        }, cancellationToken);
        return response;
    }

    private static string[] NormalizeGrantTypes(string[]? requestedGrantTypes)
    {
        if (requestedGrantTypes == null || requestedGrantTypes.Length == 0)
            return DefaultGrantTypes;

        var normalized = requestedGrantTypes
            .Where(gt => !string.IsNullOrWhiteSpace(gt))
            .Select(gt => gt.Trim())
            .Where(gt => SupportedGrantTypes.Contains(gt, StringComparer.Ordinal))
            .Distinct(StringComparer.Ordinal)
            .ToArray();

        return normalized.Length > 0 ? normalized : DefaultGrantTypes;
    }

    private async Task CleanupStaleDynamicClientsAsync(CancellationToken cancellationToken)
    {
        var cutoff = DateTimeOffset.UtcNow.Subtract(StaleDynamicClientTtl);
        var stale = await _apiClientRepository.ListStaleDynamicUnlinkedAsync(cutoff, CleanupBatchSize, cancellationToken);
        foreach (var client in stale)
        {
            await _apiClientRepository.DeleteAsync(client.UserId, client.Id, cancellationToken);
        }
    }

    private static string? GetRequesterIp(HttpRequestData req)
    {
        if (req.Headers.TryGetValues("X-Forwarded-For", out var forwardedFor))
        {
            var first = forwardedFor.FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(first))
            {
                var ip = first.Split(',').Select(s => s.Trim()).FirstOrDefault();
                if (!string.IsNullOrWhiteSpace(ip))
                    return ip;
            }
        }

        if (req.Headers.TryGetValues("X-Real-IP", out var realIp))
        {
            var ip = realIp.FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(ip))
                return ip.Trim();
        }

        return null;
    }

    private static async Task<HttpResponseData> CreateRateLimitedAsync(HttpRequestData req, string message, CancellationToken cancellationToken)
    {
        var response = req.CreateResponse((HttpStatusCode)429);
        response.Headers.Add("Retry-After", ((int)RegistrationWindow.TotalSeconds).ToString());
        await response.WriteAsJsonAsync(new
        {
            error = "rate_limited",
            error_description = message
        }, cancellationToken);
        return response;
    }

    private static bool TryValidateRedirectUri(string? redirectUri, out string error)
    {
        error = string.Empty;
        if (string.IsNullOrWhiteSpace(redirectUri))
        {
            error = "redirect_uris must contain non-empty absolute URIs.";
            return false;
        }

        if (!Uri.TryCreate(redirectUri, UriKind.Absolute, out var parsed))
        {
            error = "redirect_uris contains an invalid URI.";
            return false;
        }

        var isLocalhost = parsed.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
            || parsed.Host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase);

        if (parsed.Scheme.Equals(Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
            return true;

        if (parsed.Scheme.Equals(Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase) && isLocalhost)
            return true;

        error = "Only https:// redirect URIs are allowed, except http://localhost or http://127.0.0.1.";
        return false;
    }

    private static async Task<HttpResponseData> CreateErrorAsync(
        HttpRequestData req,
        HttpStatusCode statusCode,
        string error,
        string errorDescription,
        CancellationToken cancellationToken)
    {
        var response = req.CreateResponse(statusCode);
        await response.WriteAsJsonAsync(new
        {
            error,
            error_description = errorDescription
        }, cancellationToken);
        return response;
    }

    public sealed record OAuthRegistrationRequest
    {
        [JsonPropertyName("client_name")]
        public string? ClientName { get; init; }

        [JsonPropertyName("redirect_uris")]
        public string[]? RedirectUris { get; init; }

        [JsonPropertyName("grant_types")]
        public string[]? GrantTypes { get; init; }

        [JsonPropertyName("response_types")]
        public string[]? ResponseTypes { get; init; }

        [JsonPropertyName("token_endpoint_auth_method")]
        public string? TokenEndpointAuthMethod { get; init; }
    }
}
