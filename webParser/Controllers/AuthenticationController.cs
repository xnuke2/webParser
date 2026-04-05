using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
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
public class AuthenticationController(ILogger<AuthenticationController> logger, AppDbContext context) : Controller
{
    private string GenerateRefreshToken()
    {
        var randomNumber = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomNumber);
        return Convert.ToBase64String(randomNumber);
    }

    private ClaimsPrincipal GetPrincipalFromExpiredToken(string token)
    {
        var tokenValidationParameters = new TokenValidationParameters
        {
            ValidateAudience = true,
            ValidAudience = AuthOptions.AUDIENCE,
            ValidateIssuer = true,
            ValidIssuer = AuthOptions.ISSUER,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = AuthOptions.GetSymmetricSecurityKey(),
            ValidateLifetime = false 
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var principal = tokenHandler.ValidateToken(token, tokenValidationParameters, out SecurityToken securityToken);
        
        if (securityToken is not JwtSecurityToken jwtSecurityToken || 
            !jwtSecurityToken.Header.Alg.Equals(SecurityAlgorithms.HmacSha256, StringComparison.InvariantCultureIgnoreCase))
            throw new SecurityTokenException("Invalid token");
            
        return principal;
    }

    [HttpPost("Login")]
    public async Task<IActionResult> Login(UserDto user)
    {
        var findUser = await context.Users.FirstOrDefaultAsync(u => u.Login == user.Login && u.Password == user.Password);
        if (findUser is null)
            return Unauthorized("Invalid credentials");
            
        var roleName = context.Roles.Find(findUser.RoleId)?.Name;
        if (roleName is null)
            return Unauthorized("Role not found");

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, findUser.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Login),
            new Claim(ClaimTypes.Role, roleName),
        };

        // Access Token
        var accessToken = new JwtSecurityToken(
            issuer: AuthOptions.ISSUER,
            audience: AuthOptions.AUDIENCE,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(AuthOptions.ACCESS_TOKEN_LIFETIME_MINUTES),
            signingCredentials: new SigningCredentials(AuthOptions.GetSymmetricSecurityKey(), SecurityAlgorithms.HmacSha256));

        var encodedAccessToken = new JwtSecurityTokenHandler().WriteToken(accessToken);

        // Refresh Token
        var refreshToken = GenerateRefreshToken();
        findUser.RefreshToken = refreshToken;
        findUser.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(AuthOptions.REFRESH_TOKEN_LIFETIME_DAYS);
        
        await context.SaveChangesAsync();

        var response = new TokenDto
        {
            AccessToken = encodedAccessToken,
            RefreshToken = refreshToken,
            Username = user.Login
        };
        
        return Ok(response);
    }

    [HttpGet("check")]
    [Authorize]
    public IActionResult Check()
    {
        return Ok();
    }
    [HttpGet("my")]
    [Authorize]
    public IActionResult Profile()
    {
        var name =User.FindFirst(ClaimTypes.Name)?.Value;
        if (name is null)
            return Unauthorized();
        var role =User.FindFirst(ClaimTypes.Role)?.Value;
        if (role is null)
            return Unauthorized();
        return Ok(new ProfileUserDto()
        {
            Login =  name,
            Role = role
        });
    }
    [HttpPost("Refresh")]
    public async Task<IActionResult> Refresh(TokenDto tokenDto)
    {
        if (string.IsNullOrEmpty(tokenDto.AccessToken) || string.IsNullOrEmpty(tokenDto.RefreshToken))
            return BadRequest("Invalid client request");

        var principal = GetPrincipalFromExpiredToken(tokenDto.AccessToken);
        var userId = int.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
        
        var user = await context.Users.FindAsync(userId);
        if (user == null || user.RefreshToken != tokenDto.RefreshToken || user.RefreshTokenExpiryTime <= DateTime.UtcNow)
            return Unauthorized("Invalid refresh token");


        var newAccessToken = new JwtSecurityToken(
            issuer: AuthOptions.ISSUER,
            audience: AuthOptions.AUDIENCE,
            claims: principal.Claims,
            expires: DateTime.UtcNow.AddMinutes(AuthOptions.ACCESS_TOKEN_LIFETIME_MINUTES),
            signingCredentials: new SigningCredentials(AuthOptions.GetSymmetricSecurityKey(), SecurityAlgorithms.HmacSha256));

        var encodedAccessToken = new JwtSecurityTokenHandler().WriteToken(newAccessToken);
        
        var newRefreshToken = GenerateRefreshToken();
        user.RefreshToken = newRefreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(AuthOptions.REFRESH_TOKEN_LIFETIME_DAYS);
        
        await context.SaveChangesAsync();

        var response = new TokenDto
        {
            AccessToken = encodedAccessToken,
            RefreshToken = newRefreshToken,
            Username = user.Login
        };
        
        return Ok(response);
    }

    [HttpPost("Revoke")]
    [Authorize]
    public async Task<IActionResult> Revoke()
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
        var user = await context.Users.FindAsync(userId);
        
        if (user == null) 
            return NotFound();
            
        user.RefreshToken = null;
        user.RefreshTokenExpiryTime = null;
        
        await context.SaveChangesAsync();
        
        return NoContent();
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
        
        return Ok(new { Message = "Registration successful", UserId = newUser.Id });
    }
}