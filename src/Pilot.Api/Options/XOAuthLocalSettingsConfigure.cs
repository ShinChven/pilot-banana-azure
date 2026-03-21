using System.Text.Json;
using Microsoft.Extensions.Options;

namespace Pilot.Api.Options;

/// <summary>
/// If XOAuth is not set from config, load from local.settings.json so "Connect X" works when running under func host.
/// </summary>
public sealed class XOAuthLocalSettingsConfigure : IConfigureOptions<XOAuthOptions>
{
    public void Configure(XOAuthOptions options)
    {
        if (!string.IsNullOrWhiteSpace(options.ClientId) && !string.IsNullOrWhiteSpace(options.ApiBaseUrl))
            return;

        var paths = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "local.settings.json"),
            Path.Combine(Environment.CurrentDirectory, "local.settings.json"),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "local.settings.json"))
        };

        foreach (var fullPath in paths.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (string.IsNullOrEmpty(fullPath) || !File.Exists(fullPath)) continue;
            try
            {
                var json = File.ReadAllText(fullPath);
                using var doc = JsonDocument.Parse(json);
                if (!doc.RootElement.TryGetProperty("Values", out var values)) continue;

                string? Get(string key)
                {
                    if (values.TryGetProperty(key, out var p)) return p.GetString();
                    return null;
                }

                if (string.IsNullOrWhiteSpace(options.ClientId))
                    options.ClientId = Get("XOAuth__ClientId") ?? "";
                if (string.IsNullOrWhiteSpace(options.ClientSecret))
                    options.ClientSecret = Get("XOAuth__ClientSecret") ?? "";
                if (string.IsNullOrWhiteSpace(options.ApiBaseUrl))
                    options.ApiBaseUrl = Get("XOAuth__ApiBaseUrl") ?? "";
                if (string.IsNullOrWhiteSpace(options.DashboardBaseUrl))
                    options.DashboardBaseUrl = Get("XOAuth__DashboardBaseUrl") ?? "http://localhost:5173";
                if (string.IsNullOrWhiteSpace(options.StateSigningSecret))
                    options.StateSigningSecret = Get("XOAuth__StateSigningSecret") ?? "";

                break;
            }
            catch
            {
                // try next path
            }
        }
    }
}
