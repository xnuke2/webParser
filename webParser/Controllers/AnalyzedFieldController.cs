using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using webParser.Data;
using webParser.Models.Database;
using webParser.Models.DTO.AnalyzedField;

namespace webParser.Controllers;


[Route("api/[controller]")]
[ApiController]
//[Authorize(Roles = "Редактор,Администратор")]
public class AnalyzedFieldController(ILogger<HomeController> logger, AppDbContext context) : Controller
{
    [HttpGet("all")]
    public IActionResult Get()
    {
        return Ok(context.AnalyzedFields.ToList());
    }

    [HttpGet("{id}")]
    public IActionResult Get([FromRoute] int id)
    {
        var site = context.AnalyzedFields.FirstOrDefault(x => x.Id == id);
        if (site == null)
            return NotFound();
        return Ok(site);
    }
    [HttpGet("site/{siteId}")]
    public IActionResult GetBySiteId([FromRoute] int siteId)
    {
        var site = context.AnalyzedFields.Where(x => x.AnalyzedSiteId == siteId).ToList();
        if (site == null)
            return NotFound();
        return Ok(site);
    }

    [HttpPost]
    public IActionResult Post([FromBody] CreateAnalyzedFieldDto dto)
    {
        if (dto == null)
            return BadRequest("no body");
        if (dto.Name == "")
            return BadRequest("name is required");
        if (dto.AnalyzedSiteId == 0)
            return BadRequest("site id is required");
        if (dto.FieldToGet == "")
            return BadRequest("field id is required");
        if(context.AnalyzedSites.Find(dto.AnalyzedSiteId)==null)
            return NotFound("site not found");
        context.AnalyzedFields.Add(new AnalyzedField()
        {
            Name = dto.Name,
            FieldToGet = dto.FieldToGet,
            AnalyzedSiteId = dto.AnalyzedSiteId
        });
        context.SaveChanges();
        return Ok(dto);

    }

    [HttpPatch("{id}")]
    public IActionResult Put([FromRoute] int id, [FromBody] UpdateAnalyzedFieldDto dto)
    {
        if(id == 0)
            return BadRequest("id is required");
        if (dto is { Name: "", FieldToGet: "", AnalyzedSiteId: null })
            return BadRequest("changed fields is required");
        var site = context.AnalyzedFields.Find(id);
        if (site == null)
            return NotFound("site not found");
        if (dto.AnalyzedSiteId != null)
            site.AnalyzedSiteId =(int)dto.AnalyzedSiteId;
        site.Name = dto.Name??site.Name;
        site.FieldToGet = dto.FieldToGet??site.FieldToGet;
        context.SaveChanges();
        return Ok(dto);
    }

    [HttpDelete("{id}")]
    public IActionResult Delete([FromRoute] int id)
    {
        if (id == 0)
            return BadRequest("no correct id");
        var analyzedSite = context.AnalyzedFields.Find(id);
        if (analyzedSite == null)
            return NotFound("field not found");
        context.AnalyzedFields.Remove(analyzedSite);
        context.SaveChanges();
        return Ok(id);
    }
}