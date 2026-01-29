using System.Text.RegularExpressions;
using HtmlAgilityPack;
using webParser.Models.DTO;

namespace webParser.Service;

public class StringParser
{
    public List<DataField> ParseString(string html,List<DataField> fields)
    {
        var result = new List<DataField>();
        var doc = new HtmlDocument();
        doc.LoadHtml(html);
        foreach (var field in fields)
        {
            var newField = Convert(field.Data);
            var node = doc.DocumentNode.SelectSingleNode(newField);
            if (node == null)
                result.Add(new DataField()
                {
                    Field = field.Field,
                    Data = "Not Found"
                });
            else
                result.Add(new DataField()
                {
                    Field = field.Field,
                    Data = node.InnerText
                });
        }
        return result;

    }

    private static string Convert(string htmlElement)
    {
        
        var tagMatch = Regex.Match(htmlElement, @"^<(\w+)");
        if (!tagMatch.Success)
            throw new ArgumentException("Неверный формат HTML тега");
        
        string tagName = tagMatch.Groups[1].Value;
        
        var attributes = new Dictionary<string, string>();
        var attrMatches = Regex.Matches(htmlElement, @"(\w+)=[""']([^""']*)[""']");
        
        foreach (Match match in attrMatches)
        {
            string attrName = match.Groups[1].Value;
            string attrValue = match.Groups[2].Value;
            attributes[attrName] = attrValue;
        }
        
        if (attributes.Count == 0)
            return $"//{tagName}";
        
        var conditions = new List<string>();
        foreach (var attr in attributes)
        {
            conditions.Add($"@{attr.Key}='{attr.Value}'");
        }
        
        return $"//{tagName}[{string.Join(" and ", conditions)}]";
    }
}