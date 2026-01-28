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
    public IActionResult Index()
    {
        return Ok("index");
    }
    
    [Route("/Privacy")]
    [HttpGet]
    public IActionResult Privacy()
    {
        return Ok("Privacy()");
    }

    public IActionResult CreateRole()
    {
        return Ok("CreateRole()");
    }


}