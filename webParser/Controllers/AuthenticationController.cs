using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using webParser.config;
using webParser.Data;
using webParser.Models.Database;
using webParser.Models.DTO;
using webParser.Models.DTO.user;

namespace webParser.Controllers;
[AllowAnonymous]
[Route("api/[controller]")]
[ApiController]
public class AuthenticationController(ILogger<HomeController> logger, AppDbContext context) : Controller
{

    [HttpPost("Login")]
    public IActionResult Login(UserDto user)
    {
        var findUser = context.Users.FirstOrDefault(u => u.Login == user.Login && u.Password == user.Password);
        if (findUser is null)
            return Unauthorized();
        var roleName = context.Roles.Find(findUser.RoleId)?.Name;
        if (roleName is null)
            return Unauthorized();
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, findUser.Id.ToString()), 
            new Claim(ClaimTypes.Name, user.Login),
            new Claim(ClaimTypes.Role, roleName),
        };
        // создаем JWT-токен
        var jwt = new JwtSecurityToken(
            issuer: AuthOptions.ISSUER,
            audience: AuthOptions.AUDIENCE,
            claims: claims,
            expires: DateTime.UtcNow.Add(TimeSpan.FromHours(5)),
            signingCredentials: new SigningCredentials(AuthOptions.GetSymmetricSecurityKey(), SecurityAlgorithms.HmacSha256));
        var encodedJwt = new JwtSecurityTokenHandler().WriteToken(jwt);
        
        var response = new
        {
            access_token = encodedJwt,
            username = user.Login
        };
        return Ok(JsonSerializer.Serialize(new { access_token = encodedJwt, username = user.Login }));
    }
    [HttpPost("Register")]
    public async Task<IActionResult> Register(UserDto user)
    {
        if ((await context.Users.AnyAsync(u => u.Login == user.Login)))
            return BadRequest("Login is already occupied");
        User newUser = new User
        {
            Login = user.Login,
            Password = user.Password,
            RoleId = 1
        };
        context.Users.Add(newUser);
        await context.SaveChangesAsync();
        return Ok(newUser);

    }
}