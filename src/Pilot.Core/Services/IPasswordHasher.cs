namespace Pilot.Core.Services;

/// <summary>
/// Password hashing for app-managed users. No self-registration; admins set initial passwords.
/// </summary>
public interface IPasswordHasher
{
    string HashPassword(string password);
    bool VerifyPassword(string password, string hash);
}
