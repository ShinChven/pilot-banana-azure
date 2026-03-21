namespace Pilot.Core.Domain;

/// <summary>
/// Campaign lifecycle status.
/// </summary>
public enum CampaignStatus
{
    Draft = 0,
    Active = 1,
    Paused = 2,
    Finished = 3,
}
