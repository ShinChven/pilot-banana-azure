using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Pilot.Core.Services;

namespace Pilot.Infrastructure.KeyVault;

/// <summary>
/// File-based implementation when Key Vault is not configured (e.g. local dev).
/// </summary>
public class LocalFileSecretStore : ISecretStore
{
    private readonly string _dir;

    public LocalFileSecretStore()
    {
        // Use LocalApplicationData (e.g. ~/Library/Application Support/ on macOS) instead of TempPath
        // to ensure secrets survive OS temp cleanups and reboots during development.
        var baseDir = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        _dir = Path.Combine(baseDir, "PilotBanana", "Secrets");
        
        if (!Directory.Exists(_dir))
        {
            Directory.CreateDirectory(_dir);
        }
    }

    public async Task<string?> GetSecretAsync(string secretName, CancellationToken cancellationToken = default)
    {
        var path = Path.Combine(_dir, secretName + ".txt");
        if (!File.Exists(path)) return null;
        return await File.ReadAllTextAsync(path, cancellationToken);
    }

    public async Task SetSecretAsync(string secretName, string value, CancellationToken cancellationToken = default)
    {
        var path = Path.Combine(_dir, secretName + ".txt");
        await File.WriteAllTextAsync(path, value, cancellationToken);
    }

    public Task DeleteSecretAsync(string secretName, CancellationToken cancellationToken = default)
    {
        var path = Path.Combine(_dir, secretName + ".txt");
        if (File.Exists(path))
        {
            File.Delete(path);
        }
        return Task.CompletedTask;
    }
}
