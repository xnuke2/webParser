using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using webParser.Data;
using webParser.Models.Database;
using webParser.Models.DTO;
using webParser.Models.DTO.AnalyzedSite;

namespace webParser.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class FaforiteSiteController(ILogger<HomeController> logger, AppDbContext context) : Controller
{
    [HttpGet("all")]
    //[Authorize(Roles = "Редактор,Администратор")]
    public IActionResult Get()
    {
        return Ok(context.FavoriteSites.ToList());
    }
    [HttpGet("my")]
    [Authorize]
    public IActionResult GetMy()
    {
        var id = Convert.ToInt32(User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
        if (id == 0)
            return BadRequest("no user id");
        return Ok(context.FavoriteSites.Where(f=>f.UserId==id).ToList());
    }

    [HttpGet("{siteId}")]
    [Authorize(Roles = "Редактор,Администратор")]
    public IActionResult Get([FromRoute] int siteId)
    {
        var site = context.FavoriteSites.Find(siteId);
        if (site == null)
            return NotFound();
        return Ok(site);
    }

    [HttpPost]
    [Authorize]
    public IActionResult Post([FromBody] FavoriteSiteDto site)
    {

        var id = Convert.ToInt32(User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
        if (id == 0)
            return BadRequest("no user id");
        if(!context.AnalyzedSites.Any(s=>s.Id==site.AnalyzedSiteId))
            return NotFound("site not found");
        context.FavoriteSites.Add(new FavoriteSite()
        {
            UserId = Convert.ToInt32(id),
            AnalyzedSiteId = site.AnalyzedSiteId
        });
        context.SaveChanges();
        return Ok(site);

    }
    
    [HttpDelete("{siteId}")]
    [Authorize]
    public IActionResult Delete([FromRoute] int siteId)
    {
        var id = Convert.ToInt32(User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
        if (id == 0)
            return BadRequest("no user id");
        if (siteId == 0)
            return BadRequest("no site id");
        var analyzedSite = context.FavoriteSites.FirstOrDefault(s => s.AnalyzedSiteId == siteId&&s.UserId==id);
        if (analyzedSite == null)
            return NotFound("site not found");
        context.FavoriteSites.Remove(analyzedSite);
        context.SaveChanges();
        return Ok();
    }
}