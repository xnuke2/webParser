using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using webParser.Data;
using webParser.Models.Database;
using webParser.Models.DTO.FieldName;

namespace webParser.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(Roles = "Редактор,Администратор")]
public class FieldNameController(ILogger<FieldNameController> logger, AppDbContext context) : Controller
{
    [HttpGet("all")]
    [AllowAnonymous]
    public IActionResult Get()
    {
        return Ok(context.FieldNames.ToList());
    }

    [HttpGet("{id}")]
    [AllowAnonymous]
    public IActionResult Get([FromRoute] int id)
    {
        var fieldName = context.FieldNames.FirstOrDefault(x => x.Id == id);
        if (fieldName == null)
            return NotFound();
        return Ok(fieldName);
    }

    [HttpPost]
    public IActionResult Post([FromBody] CreateFieldNameDto dto)
    {
        if (dto.Name == "")
            return BadRequest("Name is required");
        if (context.FieldNames.Any(f => f.Name == dto.Name))
            return BadRequest("Field name already exists");
        context.FieldNames.Add(new FieldName { Name = dto.Name });
        context.SaveChanges();
        return Ok(dto);
    }

    [HttpPatch("{id}")]
    public IActionResult Patch([FromRoute] int id, [FromBody] UpdateFieldNameDto dto)
    {
        if (id == 0)
            return BadRequest("id is required");
        if (dto.Name == null)
            return BadRequest("Name is required");
        var fieldName = context.FieldNames.Find(id);
        if (fieldName == null)
            return NotFound("Field name not found");
        fieldName.Name = dto.Name;
        context.SaveChanges();
        return Ok(fieldName);
    }

    [HttpDelete("{id}")]
    public IActionResult Delete([FromRoute] int id)
    {
        if (id == 0)
            return BadRequest("id is required");
        var fieldName = context.FieldNames.Find(id);
        if (fieldName == null)
            return NotFound("Field name not found");
        context.FieldNames.Remove(fieldName);
        context.SaveChanges();
        return Ok(id);
    }
}
