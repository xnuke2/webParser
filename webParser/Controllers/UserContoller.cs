using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using webParser.Data;
using webParser.Models.Database;
using webParser.Models.DTO;
using webParser.Models.DTO.user;

namespace webParser.Controllers;
[Route("api/[controller]")]
[ApiController]
[Authorize(Roles="Администратор")]
public class UserContoller(ILogger<HomeController> logger, AppDbContext context) : Controller
{

    [HttpGet("all")]
    public IActionResult GetUsers()
    {
        return Ok(context.Users.ToList());
    }
    [HttpGet("{id}")]
    public IActionResult GetUser(int id)
    {
        var user = context.Users.FirstOrDefault(u => u.Id == id);
        return user==null ? NotFound() : Ok(user);
    }
    [HttpPost]
    public async Task<IActionResult> AddUser(UserDto user,int roleId = 1)
    {
        if ((await context.Users.AnyAsync(u => u.Login == user.Login)))
            return BadRequest("Login is already occupied");
        User newUser = new User
        {
            Login = user.Login,
            Password = user.Password,
            RoleId = roleId
        };
        context.Users.Add(newUser);
        await context.SaveChangesAsync();
        return Ok(newUser);

    }
    [HttpPut]
    public async Task<IActionResult> UpdateUser(UpdateUserDto user)
    {
        User? oldUser = context.Users.Find(user.Id);
        if (oldUser == null)
            return BadRequest("User not found");
        oldUser.Login = string.IsNullOrEmpty(user.Login)?oldUser.Login:user.Login;
        oldUser.Password = string.IsNullOrEmpty(user.Login)?oldUser.Password:user.Password;
        oldUser.RoleId =(int)(user.RoleId==null?oldUser.RoleId:user.RoleId);
        context.Users.Update(oldUser);
        await context.SaveChangesAsync();
        return Ok(user);
        
    }
    [HttpDelete]
    public async Task<IActionResult> DeleteUser(int id)
    {
        User? user = context.Users.Find(id);
        if (user == null)
            return BadRequest("User not found");
        context.Users.Remove(user);
        await context.SaveChangesAsync();
        return Ok(user);
    }

}