namespace webParser.Models.DTO;

public class TokenDto
{
    public string AccessToken { get; set; }
    public string RefreshToken { get; set; }
    public string? Username { get; set; }
}