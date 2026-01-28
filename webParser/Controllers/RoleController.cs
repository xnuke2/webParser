using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using webParser.Data;
using webParser.Models.Database;

namespace webParser.Controllers;

[Route("api/[controller]")]
[ApiController]
[AllowAnonymous]
public class RoleController: Controller
{
    private readonly ILogger<HomeController> _logger;
    private readonly AppDbContext _context;
    
    public RoleController(ILogger<HomeController> logger,AppDbContext context)
    {
        _logger = logger;
        _context = context;
    }
    /// <summary>
    /// get all roles
    /// </summary>
    ///
    [HttpGet("all")]
    public IActionResult GetRoles()
    {
        var roles = _context.Roles.ToList();
        return Ok(roles);
    }
    /// <summary>
    /// get role by id
    /// </summary>
    [HttpGet]
    public IActionResult GetRole(int id)
    {
        var role = _context.Roles.Find(id);
        return role!=null? Ok(role):NotFound();
    }
    /// <summary>
    /// add role
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> PostRole(string inputName)
    {
        if (await _context.Roles.AnyAsync(r => r.Name == inputName))
        {
            return BadRequest("Role already exists");
        }

        Role newRole = new Role
        {
            Name = inputName
        };
    
        _context.Roles.Add(newRole);
        await _context.SaveChangesAsync(); 
    
        return Ok("Role created successfully");
    }
    /// <summary>
    /// delete role
    /// </summary>

    [HttpDelete]
    public async Task<IActionResult> DeleteRole(int id)
    {
        var role = _context.Roles.Find(id);
        if (role==null)
            return BadRequest("Role already exists");
        _context.Roles.Remove(role);
        await _context.SaveChangesAsync();
        return Ok("Role deleted successfully");
        
    }
}