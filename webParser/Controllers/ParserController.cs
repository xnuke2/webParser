using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using webParser.Data;
using webParser.Models.DTO;
using webParser.Service;

namespace webParser.Controllers;

[Route("api/[controller]")]
[ApiController]
public class ParserController(ILogger<ParserController> logger, AppDbContext context, HtmlService htmlService, StringParser stringParser) : Controller
{
    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> ParseSite([FromRoute] int id)
    {
        try
        {
            var site = context.AnalyzedSites.Find(id);
            if (site == null)
                return BadRequest("Site not found");

            // Возвращаем из кэша если есть
            var cached = context.ParsedData
                .Where(p => p.SiteId == id)
                .Select(p => new { p.Field, p.Data })
                .ToList();

            if (cached.Count > 0)
            {
                logger.LogInformation("Returning cached data for site {Id}", id);
                return Ok(cached);
            }

            // Если кэша нет — парсим живьём
            logger.LogInformation("No cache for site {Id}, parsing live", id);

            var fields = context.AnalyzedFields
                .Where(f => f.AnalyzedSiteId == id)
                .Select(f => new DataField { Field = f.Name, Data = f.FieldToGet })
                .ToList();

            if (fields.Count == 0)
                return BadRequest("No Fields found");

            var page = await htmlService.GetHtmlWithPlaywrightAsync(site.Url);
            var result = stringParser.ParseString(page, fields);

            // Сохраняем в кэш
            var now = DateTime.UtcNow;
            context.ParsedData.AddRange(result.Select(r => new Models.Database.ParsedData
            {
                SiteId = id,
                Field = r.Field,
                Data = r.Data,
                UpdatedAt = now
            }));
            await context.SaveChangesAsync();

            return Ok(result.Select(f => new { f.Field, f.Data }).ToList());
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error parsing site ID: {Id}", id);
            return StatusCode(500, $"Internal server error: {ex.Message}");
        }
    }
    [HttpGet("test")]
    [AllowAnonymous]
    public async Task<IActionResult> TestParser([FromQuery] string url, [FromQuery] string selector)
    {
        try
        {
            logger.LogInformation("Testing parser with URL: {Url}, selector: {Selector}", url, selector);
        
            var html = await htmlService.GetHtmlAdaptiveAsync(url);
            logger.LogInformation("Got HTML: {Length} chars", html.Length);
        
            if (html.Length < 100)
            {
                return BadRequest($"HTML too short: {html.Length} chars");
            }
        
            // Сохраняем HTML для отладки
            var debugPath = Path.Combine(Directory.GetCurrentDirectory(), "debug.html");
            await System.IO.File.WriteAllTextAsync(debugPath, html);
            logger.LogInformation("HTML saved to: {Path}", debugPath);
        
            var testField = new DataField { Field = "test", Data = selector };
            var result =stringParser.ParseString(html, new List<DataField> { testField });
        
            return Ok(new { 
                htmlLength = html.Length,
                result = result.FirstOrDefault(),
                debugFile = debugPath 
            });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Test failed");
            return StatusCode(500, $"Test failed: {ex.Message}");
        }
    }
    [HttpGet("test_new")]
    [AllowAnonymous]
    public async Task<IActionResult> TestParser([FromQuery] string url)
    {
        try
        {
            logger.LogInformation("Testing parser with URL: {Url}", url);
        
            var html = await htmlService.GetHtmlAdaptiveAsync(url);
            logger.LogInformation("Got HTML: {Length} chars", html.Length);
        
            if (html.Length < 100)
            {
                return BadRequest($"HTML too short: {html.Length} chars");
            }
            
        
            return Ok(new { 
                htmlLength = html.Length,
                text = html
            });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Test failed");
            return StatusCode(500, $"Test failed: {ex.Message}");
        }
    }
}