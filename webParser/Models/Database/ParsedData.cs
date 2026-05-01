using System.ComponentModel.DataAnnotations.Schema;

namespace webParser.Models.Database;

public class ParsedData
{
    public int Id { get; set; }
    [ForeignKey("AnalyzedSite")]
    public required int SiteId { get; set; }
    public required string Field { get; set; }
    public required string Data { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
