using System.ComponentModel.DataAnnotations.Schema;

namespace webParser.Models.Database;

public class AnalyzedSite
{
    public int Id { get; set; }
    public required string Url { get; set; }
    [ForeignKey("User")]
    public required int UserId { get; set; }
    
    
}