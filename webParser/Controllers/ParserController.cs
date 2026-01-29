using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using webParser.Data;
using webParser.Models.DTO;
using webParser.Service;

namespace webParser.Controllers;

[Route("api/[controller]")]
[ApiController]
public class ParserController(ILogger<HomeController> logger, AppDbContext context,HtmlService htmlService,StringParser stringParser) : Controller
{
    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> ParseSite([FromRoute]int id)
    {
        var site = context.AnalyzedSites.Find(id);
        if (site == null)
            return BadRequest("Site not found");
        var fields = context.AnalyzedFields.Where(f => f.AnalyzedSiteId == id)
            .Select(f=>new DataField()
            {
                Field = f.Name,
                Data = f.FieldToGet
            }).ToList();
        if (fields.Count == 0)
            return BadRequest("No Fields found");
        var page =await htmlService.GetHtmlAsync(site.Url);
        var result = stringParser.ParseString(page,fields);
        return Ok(result.Select(f=>new {f.Field,f.Data}).ToList());
    }
}