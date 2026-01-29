using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using webParser.Data;
using webParser.Models.Database;

namespace webParser.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(Roles ="Администратор")]
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
    [HttpGet("{id}")]
    public IActionResult GetRole([FromRoute]int id)
    {
        var role = _context.Roles.Find(id);
        return role!=null? Ok(role):NotFound();
    }
    /// <summary>
    /// add role
    /// </summary>
    [HttpPost]
    public IActionResult AddRole(string inputName)
    {
        if (_context.Roles.Any(r => r.Name == inputName))
        {
            return BadRequest("Role already exists");
        }

        Role newRole = new Role
        {
            Name = inputName
        };
    
        _context.Roles.Add(newRole);
        _context.SaveChangesAsync(); 
    
        return Ok("Role created successfully");
    }
    /// <summary>
    /// delete role
    /// </summary>

    [HttpDelete]
    
    public IActionResult DeleteRole(int id)
    {
        var role = _context.Roles.Find(id);
        if (role==null)
            return BadRequest("Role no exists");
        _context.Roles.Remove(role);
        _context.SaveChanges();
        return Ok("Role deleted successfully");
        
    }
}