namespace webParser.Models.DTO.user;

public class UpdateUserDto
{
    public int Id { get; set; }
    public string? Login { get; set; }
    public string? Password { get; set; }
    public int? RoleId { get; set; }
}