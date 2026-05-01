using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using webParser.Data;

namespace webParser.Controllers;

[Route("api/[controller]")]
[ApiController]
public class ParsedDataController(AppDbContext context) : Controller
{
    [HttpGet("all")]
    public async Task<IActionResult> GetAll()
    {
        var data = await context.ParsedData
            .Select(p => new { p.SiteId, p.Field, p.Data, p.UpdatedAt })
            .ToListAsync();
        return Ok(data);
    }

    [HttpGet("site/{siteId}")]
    public async Task<IActionResult> GetBySite([FromRoute] int siteId)
    {
        var data = await context.ParsedData
            .Where(p => p.SiteId == siteId)
            .Select(p => new { p.Field, p.Data, p.UpdatedAt })
            .ToListAsync();
        return Ok(data);
    }

    [HttpDelete("site/{siteId}")]
    [Authorize]
    public async Task<IActionResult> ClearCache([FromRoute] int siteId)
    {
        var rows = context.ParsedData.Where(p => p.SiteId == siteId);
        context.ParsedData.RemoveRange(rows);
        await context.SaveChangesAsync();
        return Ok(new { deleted = true, siteId });
    }
}
