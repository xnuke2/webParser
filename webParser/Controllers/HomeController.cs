using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using webParser.Data;

namespace webParser.Controllers;


public class HomeController : Controller
{
    private readonly ILogger<HomeController> _logger;
    private readonly AppDbContext _context;
    public HomeController(ILogger<HomeController> logger,AppDbContext context)
    {
        _logger = logger;
        _context = context;
    }

    /// <summary>
    /// test get 
    /// </summary>
    /// <return>"index"</return>
    [Route("/Index")]
    [HttpGet]
    public string Index()
    {
        return "index";
    }
    [Route("/Privacy")]
    [HttpGet]
    public string Privacy()
    {
        return "Privacy()";
    }
    [HttpGet("/todos")]
    public IActionResult GetTodos()
    {
        return Ok(_context.TodoItems.ToList());
    }

}