using System.Text.Json;
using Microsoft.Azure.Cosmos;

namespace Pilot.Infrastructure.Cosmos;

/// <summary>
/// Cosmos serializer that uses camelCase for property names so documents have the required "id" field.
/// </summary>
public sealed class CamelCaseCosmosSerializer : CosmosSerializer
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public override T FromStream<T>(Stream stream)
    {
        if (stream is null || stream.CanSeek && stream.Length == 0)
            return default!;
        using var reader = new StreamReader(stream);
        var json = reader.ReadToEnd();
        return string.IsNullOrEmpty(json) ? default! : JsonSerializer.Deserialize<T>(json, Options)!;
    }

    public override Stream ToStream<T>(T input)
    {
        var stream = new MemoryStream();
        using (var writer = new StreamWriter(stream, leaveOpen: true))
            writer.Write(JsonSerializer.Serialize(input, Options));
        stream.Position = 0;
        return stream;
    }
}
