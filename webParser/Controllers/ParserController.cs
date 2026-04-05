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
public async Task<IActionResult> ParseSite([FromRoute]int id)
{
    try
    {
        var site = context.AnalyzedSites.Find(id);
        if (site == null)
            return BadRequest("Site not found");
        
        logger.LogInformation("Parsing site ID: {Id}, URL: {Url}", id, site.Url);
        
        var fields = context.AnalyzedFields
            .Where(f => f.AnalyzedSiteId == id)
            .Select(f => new DataField()
            {
                Field = f.Name,
                Data = f.FieldToGet
            }).ToList();
            
        if (fields.Count == 0)
            return BadRequest("No Fields found");
            
        logger.LogInformation("Found {Count} fields to parse", fields.Count);
        
        var page = await htmlService.GetHtmlWithPlaywrightAsync(site.Url);
        var result = stringParser.ParseString(page, fields);
        
        logger.LogInformation("Parsing completed. Results: {Results}", 
            string.Join(", ", result.Select(r => $"{r.Field}: '{r.Data}'")));
        
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