using System.ComponentModel.DataAnnotations.Schema;

namespace webParser.Models.Database;

public class AnalyzedField
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public required string FieldToGet { get; set; }
    [ForeignKey("AnalyzedSite")]
    public required int AnalyzedSiteId { get; set; }
    [ForeignKey("FieldName")]
    public int FieldNameId { get; set; }
}