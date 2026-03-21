namespace Pilot.Core.Domain;

/// <summary>
/// User role for authorization. Admins can manage users; all users see only their own campaigns and channels.
/// </summary>
public enum UserRole
{
    User = 0,
    Admin = 1,
}
