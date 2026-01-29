namespace webParser.Models.DTO.AnalyzedField;

public class CreateAnalyzedFieldDto
{
    public required string Name { get; set; }
    public required string FieldToGet { get; set; }
    public required int AnalyzedSiteId { get; set; }
}