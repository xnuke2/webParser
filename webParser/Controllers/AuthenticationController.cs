using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
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
public class AuthenticationController: Controller
{
    private readonly ILogger<HomeController> _logger;
    private readonly AppDbContext _context;
    public AuthenticationController(ILogger<HomeController> logger,AppDbContext context)
    {
        _logger = logger;
        _context = context;
    }
    [HttpPost("Login")]
    public async Task<IActionResult> Login(UserDto user)
    {
        if (!(await _context.Users.AnyAsync(u => u.Login == user.Login && u.Password == user.Password)))
            return Unauthorized();
        
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.Name, user.Login), 
            //new Claim(ClaimTypes.Role, _context.Roles.Find(user.roleId).Name), 
            
        };
        // создаем JWT-токен
        var jwt = new JwtSecurityToken(
            issuer: AuthOptions.ISSUER,
            audience: AuthOptions.AUDIENCE,
            claims: claims,
            expires: DateTime.UtcNow.Add(TimeSpan.FromMinutes(2)),
            signingCredentials: new SigningCredentials(AuthOptions.GetSymmetricSecurityKey(), SecurityAlgorithms.HmacSha256));
        var encodedJwt = new JwtSecurityTokenHandler().WriteToken(jwt);
        
        var response = new
        {
            access_token = encodedJwt,
            username = user.Login
        };    
        return Ok(encodedJwt);
    }
    [HttpPost("Register")]
    public async Task<IActionResult> Register(UserDto user)
    {
        if ((await _context.Users.AnyAsync(u => u.Login == user.Login)))
            return BadRequest("Login is already occupied");
        User newUser = new User
        {
            Login = user.Login,
            Password = user.Password,
            RoleId = 1
        };
        _context.Users.Add(newUser);
        await _context.SaveChangesAsync();
        return Ok(newUser);

    }
}