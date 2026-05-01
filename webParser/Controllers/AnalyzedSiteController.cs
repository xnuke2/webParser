using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using webParser.Data;
using webParser.Models.Database;
using webParser.Models.DTO.AnalyzedSite;


namespace webParser.Controllers;
[Route("api/[controller]")]
[ApiController]
//временно
[AllowAnonymous]
//[Authorize(Roles = "Редактор,Администратор")]
public class AnalyzedSiteController(ILogger<HomeController> logger, AppDbContext context) : Controller
{
    [HttpGet("all")]
    [AllowAnonymous]

    public IActionResult Get()
    {
        return Ok(context.AnalyzedSites.ToList());
    }

    [HttpGet("{siteId}")]
    [AllowAnonymous]
    public IActionResult Get([FromRoute] int siteId)
    {
        var site = context.AnalyzedSites.FirstOrDefault(x => x.Id == siteId);
        if (site == null)
            return NotFound();
        return Ok(site);
    }

    [HttpPost]
    public IActionResult Post([FromBody] CreateAnalyzedSiteDto site)
    {
        if(site.Url=="")
            return BadRequest("Url is required");
        if(site.Name=="")
            return BadRequest("Name is required");
        var id = Convert.ToInt32(User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
        if (id == 0)
            return BadRequest("no user id");
        if(context.AnalyzedSites.Any(s=>s.Url==site.Url))
            return BadRequest("Site already exists");
        var entity = new AnalyzedSite()
        {
            Name = site.Name,
            Url = site.Url,
            UserId = Convert.ToInt32(id)
        };
        context.AnalyzedSites.Add(entity);
        context.SaveChanges();
        return Ok(entity);

    }

    [HttpPut("{siteId}")]
    public IActionResult Put([FromRoute] int siteId, [FromBody] CreateAnalyzedSiteDto site)
    {
        if(site.Name=="")
            return BadRequest("Name is required");
        if(site.Url=="")
            return BadRequest("Url is required");
        if (siteId == 0)
            return BadRequest("no site id");
        var analyzedSite = context.AnalyzedSites.Find(siteId);
        if (analyzedSite == null)
            return NotFound("site not found");
        analyzedSite.Url=site.Url;
        analyzedSite.Name = site.Name;
        context.SaveChanges();
        return Ok(site);
    }

    [HttpDelete("{siteId}")]
    public IActionResult Delete([FromRoute] int siteId)
    {
        if (siteId == 0)
            return BadRequest("no site id");
        var analyzedSite = context.AnalyzedSites.Find(siteId);
        if (analyzedSite == null)
            return NotFound("site not found");
        context.AnalyzedSites.Remove(analyzedSite);
        context.SaveChanges();
        return Ok(siteId);
    }
}