using System.ComponentModel.DataAnnotations.Schema;

namespace webParser.Models.Database;

public class FavoriteSite
{
    [ForeignKey("AnalyzedSite")]
    public required int AnalyzedSiteId { get; set; }
    [ForeignKey("User")]
    public required int UserId { get; set; }
}