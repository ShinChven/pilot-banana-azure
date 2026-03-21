using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Pilot.Core.Services;

namespace Pilot.Infrastructure.AI;

public class GeminiAiService : IAiService
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;
    private readonly ILogger<GeminiAiService> _logger;
    private const string ModelName = "gemini-3.1-flash-lite-preview";
    private const string ApiUrl = "https://generativelanguage.googleapis.com/v1beta/models/{0}:generateContent?key={1}";

    public GeminiAiService(HttpClient httpClient, IConfiguration configuration, ILogger<GeminiAiService> logger)
    {
        _httpClient = httpClient;
        _apiKey = configuration["GEMINI_API_KEY"] ?? string.Empty;
        _logger = logger;
    }

    public async Task<string> GeneratePostTextAsync(List<byte[]> images, string prompt, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(_apiKey))
        {
            _logger.LogError("GEMINI_API_KEY is not configured.");
            throw new InvalidOperationException("AI service is not configured.");
        }

        var url = string.Format(ApiUrl, ModelName, _apiKey);

        var contents = new List<object>
        {
            new
            {
                parts = new List<object>
                {
                    new { text = prompt }
                }
            }
        };

        // Add images if any
        if (images != null && images.Any())
        {
            var parts = (List<object>)((dynamic)contents[0]).parts;
            foreach (var img in images)
            {
                parts.Add(new
                {
                    inline_data = new
                    {
                        mime_type = "image/jpeg", // Assuming JPEG for now, could be dynamic
                        data = Convert.ToBase64String(img)
                    }
                });
            }
        }

        var payload = new { contents };

        try
        {
            var response = await _httpClient.PostAsJsonAsync(url, payload, ct);
            var responseBody = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Gemini API error: {StatusCode} {Body}", response.StatusCode, responseBody);
                throw new Exception($"Gemini API error: {response.StatusCode}");
            }

            using var doc = JsonDocument.Parse(responseBody);
            var candidates = doc.RootElement.GetProperty("candidates");
            if (candidates.GetArrayLength() > 0)
            {
                var content = candidates[0].GetProperty("content");
                var parts = content.GetProperty("parts");
                if (parts.GetArrayLength() > 0)
                {
                    return parts[0].GetProperty("text").GetString() ?? string.Empty;
                }
            }

            return string.Empty;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to call Gemini API");
            throw;
        }
    }
}
