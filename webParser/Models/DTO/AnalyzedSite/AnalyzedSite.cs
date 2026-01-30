using System.ComponentModel.DataAnnotations.Schema;

namespace webParser.Models.DTO.AnalyzedSite;

public class CreateAnalyzedSiteDto
{
    public required string Name{ get; set; }
    public required string Url { get; set; }

    
    
}