using System.ComponentModel.DataAnnotations.Schema;

namespace webParser.Models.Database;

public class User
{
    public  int Id { get; set; }
    public required string Login { get; set; }
    public required string Password { get; set; }
    [ForeignKey("Role")]
    public required int RoleId { get; set; }
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiryTime { get; set; }
}