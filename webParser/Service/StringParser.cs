using System.Text.RegularExpressions;
using HtmlAgilityPack;
using webParser.Models.DTO;

namespace webParser.Service;

public class StringParser
{
    private readonly ILogger<StringParser> _logger;

    public StringParser(ILogger<StringParser> logger)
    {
        _logger = logger;
    }

    public List<DataField> ParseString(string html, List<DataField> fields)
    {
        var result = new List<DataField>();
        
        if (string.IsNullOrEmpty(html))
        {
            _logger.LogWarning("HTML content is null or empty");
            return fields.Select(f => new DataField { Field = f.Field, Data = "No content" }).ToList();
        }

        var doc = new HtmlDocument();
        doc.LoadHtml(html);
        
        _logger.LogInformation("Parsing HTML with {Count} fields", fields.Count);

        foreach (var field in fields)
        {
            string extracted = null;
            var selector = field.Data?.Trim();
            if (string.IsNullOrEmpty(selector))
            {
                result.Add(new DataField { Field = field.Field, Data = "Empty selector" });
                continue;
            }

            try
            {
                _logger.LogDebug("Looking for field '{Field}' with selector: {Selector}", field.Field, selector);

                // 1. Если selector похож на XPath
                if (selector.StartsWith("//") || selector.StartsWith(".//"))
                {
                    var node = doc.DocumentNode.SelectSingleNode(selector);
                    if (node != null)
                        extracted = CleanText(node.InnerText);
                }
                
                // 2. Поиск по data-ftid
                if (extracted == null)
                    extracted = FindByDataFtid(doc, selector);
                
                // 3. Поиск как CSS-селектор
                if (extracted == null)
                    extracted = FindByCssSelector(doc, selector);
                
                // 4. Поиск по тексту соседнего элемента (например, "Пробег" -> следующая ячейка)
                if (extracted == null)
                    extracted = FindByAdjacentText(doc, selector);
                
                // 5. Конвертация HTML-фрагмента в XPath
                if (extracted == null)
                {
                    var xpath = ConvertHtmlToXPath(selector);
                    if (!string.IsNullOrEmpty(xpath))
                    {
                        var node = doc.DocumentNode.SelectSingleNode(xpath);
                        if (node != null)
                            extracted = CleanText(node.InnerText);
                    }
                }

                if (extracted == null)
                {
                    _logger.LogWarning("Field '{Field}' not found with selector: {Selector}", field.Field, selector);
                    result.Add(new DataField { Field = field.Field, Data = "Not Found" });
                }
                else
                {
                    result.Add(new DataField { Field = field.Field, Data = extracted });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error parsing field {Field}", field.Field);
                result.Add(new DataField { Field = field.Field, Data = $"Error: {ex.Message}" });
            }
        }

        return result;
    }

    private string FindByDataFtid(HtmlDocument doc, string selector)
    {
        var match = Regex.Match(selector, @"data-ftid=[""']([^""']*)[""']");
        if (match.Success)
        {
            var ftid = match.Groups[1].Value;
            var node = doc.DocumentNode.SelectSingleNode($"//*[@data-ftid='{ftid}']");
            return node != null ? CleanText(node.InnerText) : null;
        }
        return null;
    }

    private string FindByCssSelector(HtmlDocument doc, string selector)
    {
        // .classname
        if (selector.StartsWith('.'))
        {
            var className = selector.Substring(1);
            var node = doc.DocumentNode.SelectSingleNode($"//*[contains(@class, '{className}')]");
            return node != null ? CleanText(node.InnerText) : null;
        }
        // #id
        if (selector.StartsWith('#'))
        {
            var id = selector.Substring(1);
            var node = doc.DocumentNode.SelectSingleNode($"//*[@id='{id}']");
            return node != null ? CleanText(node.InnerText) : null;
        }
        // tag.class
        var tagClassMatch = Regex.Match(selector, @"^(\w+)\.([\w-]+)");
        if (tagClassMatch.Success)
        {
            var tag = tagClassMatch.Groups[1].Value;
            var className = tagClassMatch.Groups[2].Value;
            var node = doc.DocumentNode.SelectSingleNode($"//{tag}[contains(@class, '{className}')]");
            return node != null ? CleanText(node.InnerText) : null;
        }
        // tag[attr='value']
        var attrMatch = Regex.Match(selector, @"^(\w+)\[([\w-]+)=['""]([^'""]+)['""]\]");
        if (attrMatch.Success)
        {
            var tag = attrMatch.Groups[1].Value;
            var attr = attrMatch.Groups[2].Value;
            var value = attrMatch.Groups[3].Value;
            var node = doc.DocumentNode.SelectSingleNode($"//{tag}[@{attr}='{value}']");
            return node != null ? CleanText(node.InnerText) : null;
        }
        return null;
    }

    private string FindByAdjacentText(HtmlDocument doc, string selector)
    {
        var match = Regex.Match(selector, @"text=['""]([^'""]+)['""]");
        if (match.Success)
        {
            var searchText = match.Groups[1].Value;
            var nodes = doc.DocumentNode.SelectNodes($"//*[contains(text(), '{searchText}')]");
            if (nodes != null)
            {
                foreach (var node in nodes)
                {
                    var row = node.Ancestors("tr").FirstOrDefault();
                    if (row != null)
                    {
                        var valueCell = row.SelectSingleNode(".//td[@data-ftid='value']");
                        if (valueCell != null)
                            return CleanText(valueCell.InnerText);
                    }
                }
            }
        }
        return null;
    }

    private string ConvertHtmlToXPath(string htmlElement)
    {
        var tagMatch = Regex.Match(htmlElement, @"^<(\w+)");
        if (!tagMatch.Success)
            return null;

        string tagName = tagMatch.Groups[1].Value;
        var attrMatches = Regex.Matches(htmlElement, @"(\w+)=[""']([^""']*)[""']");
        if (attrMatches.Count == 0)
            return $"//{tagName}";

        var conditions = new List<string>();
        foreach (Match m in attrMatches)
        {
            string attr = m.Groups[1].Value;
            string value = m.Groups[2].Value;
            if (attr == "class")
            {
                var classes = value.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                foreach (var cls in classes)
                    conditions.Add($"contains(@class, '{cls}')");
            }
            else
            {
                conditions.Add($"@{attr}='{value}'");
            }
        }

        return $"//{tagName}[{string.Join(" and ", conditions)}]";
    }

    private string CleanText(string text)
    {
        if (string.IsNullOrEmpty(text))
            return text;
        text = Regex.Replace(text, @"\s+", " ");
        text = text.Trim();
        text = System.Net.WebUtility.HtmlDecode(text);
        return text;
    }
}