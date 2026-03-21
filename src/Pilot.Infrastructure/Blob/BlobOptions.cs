namespace Pilot.Infrastructure.Blob;

public class BlobOptions
{
    public const string SectionName = "Blob";

    public string ConnectionString { get; set; } = string.Empty;
    public string ContainerName { get; set; } = "campaign-assets";
}
