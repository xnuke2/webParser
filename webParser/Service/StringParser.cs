using System.Text.Json;
using System.Text.RegularExpressions;
using HtmlAgilityPack;
using webParser.Models.DTO;

namespace webParser.Service;

public class StringParser
{
    private readonly ILogger<StringParser> _logger;
    private static readonly HashSet<string> InlineElements = new()
    {
        "a", "span", "strong", "em", "b", "i", "u", "sub", "sup", "mark", "small",
        "abbr", "cite", "code", "dfn", "kbd", "samp", "var", "q", "time", "ins", "del"
    };
    private static readonly HashSet<string> BlockElements = new()
    {
        "address", "article", "aside", "blockquote", "canvas", "dd", "div", "dl", "dt", "fieldset", "figcaption",
        "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hgroup", "hr", "li", "main",
        "nav", "noscript", "ol", "p", "pre", "section", "table", "tfoot", "thead", "tr", "ul"
    };

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
        doc.OptionDefaultStreamEncoding = System.Text.Encoding.UTF8;
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
                        extracted = ExtractTextWithStructure(node);
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

                // 5. Поиск по youla slug — ищем в исходном HTML, т.к. HtmlAgilityPack энкодит скрипты
                if (extracted == null)
                    extracted = FindByYoulaSlug(html, selector);

                // 6. Поиск по label/value div-парам (autospot, avito и подобные)
                if (extracted == null)
                    extracted = FindByLabelValueDiv(doc, selector);

                // 7. Поиск по dt/dd парам (drom и подобные)
                if (extracted == null)
                    extracted = FindByDtDd(doc, selector);

                // 8. Поиск по itemprop атрибуту (schema.org микроразметка)
                if (extracted == null)
                    extracted = FindByItemprop(doc, selector);

                // 8. Конвертация HTML-фрагмента в XPath
                if (extracted == null)
                {
                    var xpath = ConvertHtmlToXPath(selector);
                    if (!string.IsNullOrEmpty(xpath))
                    {
                        var node = doc.DocumentNode.SelectSingleNode(xpath);
                        if (node != null)
                            extracted = ExtractTextWithStructure(node);
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
            return node != null ? ExtractTextWithStructure(node) : null;
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
            return node != null ? ExtractTextWithStructure(node) : null;
        }
        // #id
        if (selector.StartsWith('#'))
        {
            var id = selector.Substring(1);
            var node = doc.DocumentNode.SelectSingleNode($"//*[@id='{id}']");
            return node != null ? ExtractTextWithStructure(node) : null;
        }
        // tag.class
        var tagClassMatch = Regex.Match(selector, @"^(\w+)\.([\w-]+)");
        if (tagClassMatch.Success)
        {
            var tag = tagClassMatch.Groups[1].Value;
            var className = tagClassMatch.Groups[2].Value;
            var node = doc.DocumentNode.SelectSingleNode($"//{tag}[contains(@class, '{className}')]");
            return node != null ? ExtractTextWithStructure(node) : null;
        }
        
        // tag[attr='value']
        // var attrMatch = Regex.Match(selector, @"^(\w+)\[([\w-]+)=['""]([^'""]+)['""]\]");
        // if (attrMatch.Success)
        // {
        //     var tag = attrMatch.Groups[1].Value;
        //     var attr = attrMatch.Groups[2].Value;
        //     var value = attrMatch.Groups[3].Value;
        //     var node = doc.DocumentNode.SelectSingleNode($"//{tag}[@{attr}='{value}']");
        //     return node != null ? CleanText(node.InnerText) : null;
        // }
        
        // tag[attr='value']
        var attrMatch = Regex.Match(selector, @"^(\w+)?\[([\w-]+)=['""]([^'""]+)['""]\]");
        if (attrMatch.Success)
        {
            var tag = attrMatch.Groups[1].Value; // Может быть пустой строкой
            var attr = attrMatch.Groups[2].Value;
            var value = attrMatch.Groups[3].Value;

            string xpathExpression;
            if (string.IsNullOrEmpty(tag))
                xpathExpression = $"//*[@{attr}='{value}']";
            else
                xpathExpression = $"//{tag}[@{attr}='{value}']";

            var node = doc.DocumentNode.SelectSingleNode(xpathExpression);
            return node != null ? ExtractTextWithStructure(node) : null;
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
                    // tr/td pattern
                    var row = node.Ancestors("tr").FirstOrDefault();
                    if (row != null)
                    {
                        var valueCell = row.SelectSingleNode(".//td[@data-ftid='value']")
                                     ?? row.SelectNodes(".//td")?.Skip(1).FirstOrDefault();
                        if (valueCell != null)
                            return ExtractTextWithStructure(valueCell);
                    }

                    // dt/dd pattern
                    if (node.Name == "dt" || node.Ancestors("dt").Any())
                    {
                        var dt = node.Name == "dt" ? node : node.Ancestors("dt").First();
                        var dd = dt.NextSibling;
                        while (dd != null && dd.NodeType != HtmlNodeType.Element)
                            dd = dd.NextSibling;
                        if (dd?.Name == "dd")
                            return ExtractTextWithStructure(dd);
                    }

                    // div label/value pattern (autospot, avito)
                    var labelDiv = node.Ancestors().FirstOrDefault(a =>
                        a.GetAttributeValue("class", "").Contains("title") ||
                        a.GetAttributeValue("class", "").Contains("label") ||
                        a.GetAttributeValue("class", "").Contains("name"));
                    if (labelDiv != null)
                    {
                        var parent = labelDiv.ParentNode;
                        if (parent != null)
                        {
                            var valueDiv = parent.ChildNodes
                                .Where(c => c.NodeType == HtmlNodeType.Element && c != labelDiv)
                                .FirstOrDefault(c =>
                                    c.GetAttributeValue("class", "").Contains("value") ||
                                    c.GetAttributeValue("class", "").Contains("val"));
                            if (valueDiv != null)
                                return ExtractTextWithStructure(valueDiv);
                        }
                    }
                }
            }
        }
        return null;
    }

    // schema.org: selector = "itemprop:price"
    private string FindByItemprop(HtmlDocument doc, string selector)
    {
        var match = Regex.Match(selector, @"^itemprop:(.+)$");
        if (!match.Success) return null;

        var prop = match.Groups[1].Value.Trim();
        var node = doc.DocumentNode.SelectSingleNode($"//*[@itemprop='{prop}']");
        if (node == null) return null;

        // Prefer content attribute (meta tags), then innerText
        var content = node.GetAttributeValue("content", null);
        if (!string.IsNullOrWhiteSpace(content))
            return content.Trim();

        return ExtractTextWithStructure(node);
    }

    // youla.ru: selector = "youla:auto_mileage" or "youla:price"
    private string FindByYoulaSlug(string rawHtml, string selector)
    {
        var match = Regex.Match(selector, @"^youla:([\w]+)$");
        if (!match.Success) return null;

        var slug = match.Groups[1].Value;

        // Special case: price is stored in kopecks as "price":230000000
        if (slug == "price")
        {
            var pm = Regex.Match(rawHtml, @"""price""\s*:\s*(\d+)");
            if (pm.Success && long.TryParse(pm.Groups[1].Value, out var kopecks))
                return (kopecks / 100).ToString("N0").Replace(",", " ") + " ₽";
            return null;
        }

        // auto_* slugs: "slug":"auto_xxx",...,"rawValue":"..."
        var pattern = $@"""slug""\s*:\s*""{Regex.Escape(slug)}""[\s\S]{{0,400}}?""rawValue""\s*:\s*""((?:[^""\\]|\\.)*)""";
        var m = Regex.Match(rawHtml, pattern);
        if (!m.Success) return null;

        var rawVal = m.Groups[1].Value;
        rawVal = Regex.Replace(rawVal, @"\\u([0-9a-fA-F]{4})", mx =>
            ((char)Convert.ToInt32(mx.Groups[1].Value, 16)).ToString());
        return rawVal;
    }

    // autospot.ru and similar: selector = "label:Двигатель"
    private string FindByLabelValueDiv(HtmlDocument doc, string selector)
    {
        var match = Regex.Match(selector, @"^label:(.+)$");
        if (!match.Success) return null;

        var labelText = match.Groups[1].Value.Trim();

        // Pattern: <div class="*title*">Label</div><div class="*value*">Value</div>
        var titleNodes = doc.DocumentNode.SelectNodes(
            $"//*[contains(@class,'title') or contains(@class,'label') or contains(@class,'name')]");
        if (titleNodes != null)
        {
            foreach (var titleNode in titleNodes)
            {
                var nodeText = titleNode.InnerText.Trim();
                if (!nodeText.Equals(labelText, StringComparison.OrdinalIgnoreCase)) continue;

                var parent = titleNode.ParentNode;
                if (parent == null) continue;

                // Look for sibling with value class
                var valueNode = parent.ChildNodes
                    .Where(c => c.NodeType == HtmlNodeType.Element && c != titleNode)
                    .FirstOrDefault(c =>
                        c.GetAttributeValue("class", "").Contains("value") ||
                        c.GetAttributeValue("class", "").Contains("val"));
                if (valueNode != null)
                    return ExtractTextWithStructure(valueNode);

                // Or just the next sibling element
                var next = titleNode.NextSibling;
                while (next != null && next.NodeType != HtmlNodeType.Element)
                    next = next.NextSibling;
                if (next != null && next != titleNode)
                    return ExtractTextWithStructure(next);
            }
        }
        return null;
    }

    // drom.ru and similar: selector = "dt:Пробег"
    private string FindByDtDd(HtmlDocument doc, string selector)
    {
        var match = Regex.Match(selector, @"^dt:(.+)$");
        if (!match.Success) return null;

        var labelText = match.Groups[1].Value.Trim();

        var dtNodes = doc.DocumentNode.SelectNodes("//dt");
        if (dtNodes == null) return null;

        foreach (var dt in dtNodes)
        {
            if (!dt.InnerText.Trim().Equals(labelText, StringComparison.OrdinalIgnoreCase)) continue;

            var dd = dt.NextSibling;
            while (dd != null && dd.NodeType != HtmlNodeType.Element)
                dd = dd.NextSibling;
            if (dd?.Name == "dd")
                return ExtractTextWithStructure(dd);
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

    // private string CleanText(string text)
    // {
    //     if (string.IsNullOrEmpty(text))
    //         return text;
    //     text = text.Trim();
    //     text = Regex.Replace(text, @"\s{2,}", " ");
    //     text = System.Net.WebUtility.HtmlDecode(text);
    //     return text;
    // }
    
    // private string ExtractTextWithStructure(HtmlNode node)
    // {
    //     var sb = new System.Text.StringBuilder();
    //
    //     // Состояние: нужно ли добавить пробел перед следующим текстовым узлом?
    //     bool needSpaceBeforeNextText = false;
    //
    //     void Traverse(HtmlNode n)
    //     {
    //         if (n.NodeType == HtmlNodeType.Text)
    //         {
    //             var text = n.InnerText.Trim();
    //             if (!string.IsNullOrEmpty(text))
    //             {
    //                 // Если требуется пробел — добавляем его
    //                 if (needSpaceBeforeNextText)
    //                 {
    //                     sb.Append(" ");
    //                     needSpaceBeforeNextText = false; // сбросили флаг
    //                 }
    //                 sb.Append(text);
    //             }
    //             // После текстового узла: следующий inline-элемент НЕ требует пробела перед собой
    //             // (мы уже добавили пробел при входе в текст)
    //         }
    //         else if (n.NodeType == HtmlNodeType.Element)
    //         {
    //             string tagName = n.Name.ToLowerInvariant();
    //
    //             // 1. Если это блочный элемент — добавляем \n до и после
    //             if (BlockElements.Contains(tagName))
    //             {
    //                 if (sb.Length > 0 && !sb.ToString().EndsWith("\n"))
    //                     sb.AppendLine(); // \n перед блоком
    //             }
    //
    //             // 2. Обрабатываем дочерние узлы
    //             foreach (var child in n.ChildNodes)
    //             {
    //                 // Перед каждым дочерним узлом: если текущий узел — inline, и следующий — текстовый,
    //                 // то установим флаг `needSpaceBeforeNextText = true`
    //                 // Но мы не знаем тип следующего узла заранее, поэтому делаем так:
    //                 // → После выхода из inline-элемента ставим флаг
    //                 Traverse(child);
    //             }
    //
    //             // 3. После обработки всех дочерних узлов:
    //             //    Если текущий элемент — inline, то следующий текстовый узел (на уровне родителя) должен начинаться с пробела.
    //             if (InlineElements.Contains(tagName))
    //             {
    //                 needSpaceBeforeNextText = true;
    //             }
    //
    //             // 4. После блочного элемента — тоже ставим перенос
    //             if (BlockElements.Contains(tagName))
    //             {
    //                 sb.AppendLine(); // \n после блока
    //             }
    //         }
    //         // Для других типов узлов (comment, document) — ничего не делаем
    //     }
    //
    //     Traverse(node);
    //
    //     return sb.ToString().Trim();
    // }

    private string ExtractTextWithStructure(HtmlNode node)
    {
        var sb = new System.Text.StringBuilder();
        bool needSpaceBeforeNextOutput = false;
        
        void TraverseSimple(HtmlNode n)
        {
            if (n.NodeType == HtmlNodeType.Text)
            {
                var text = System.Net.WebUtility.HtmlDecode(n.InnerText).Trim();
                if (!string.IsNullOrEmpty(text))
                {
                    if (needSpaceBeforeNextOutput && sb.Length > 0 && !sb.ToString().EndsWith(" ") && !sb.ToString().EndsWith("\n"))
                    {
                        sb.Append(" ");
                        needSpaceBeforeNextOutput = false;
                    }
                    sb.Append(text);
                }
            }
            else if (n.NodeType == HtmlNodeType.Element)
            {
                string tagName = n.Name.ToLowerInvariant();

                if (BlockElements.Contains(tagName))
                {
                    if (sb.Length > 0 && !sb.ToString().EndsWith("\n"))
                        sb.AppendLine();
                }

                // Обработка дочерних узлов с учетом пробелов между ними
                var childNodes = n.ChildNodes;
                for (int i = 0; i < childNodes.Count; i++)
                {
                    var child = childNodes[i];

                    // Пробел ставится *перед* inline-элементом или текстом
                    var currentIsText = child.NodeType == HtmlNodeType.Text && !string.IsNullOrWhiteSpace(child.InnerText);
                    var currentIsInline = child.NodeType == HtmlNodeType.Element && InlineElements.Contains(child.Name.ToLowerInvariant());

                    if (i > 0 && (currentIsText || currentIsInline))
                    {
                        // Был ли предыдущий узел текстом или inline
                        var prevSibling = childNodes[i - 1];
                        var prevWasTextOrInline = (prevSibling.NodeType == HtmlNodeType.Text && !string.IsNullOrWhiteSpace(prevSibling.InnerText))
                                               || (prevSibling.NodeType == HtmlNodeType.Element && InlineElements.Contains(prevSibling.Name.ToLowerInvariant()));

                        if (prevWasTextOrInline)
                        {
                            if (sb.Length > 0 && !sb.ToString().EndsWith(" ") && !sb.ToString().EndsWith("\n"))
                            {
                                sb.Append(" ");
                            }
                        }
                    }

                    TraverseSimple(child);

                    // После обработки inline-элемента, следующий текст/inline должен начинаться с пробела
                    if (currentIsInline)
                    {
                        needSpaceBeforeNextOutput = true;
                    }
                    else if (currentIsText && !string.IsNullOrEmpty(child.InnerText.Trim()))
                    {
                        // После текстового узла, если он не пустой, следующий inline должен начинаться с пробела
                        needSpaceBeforeNextOutput = true;
                    }
                    else
                    {
                        // Для блочных и других элементов, флаг сбрасывается
                        needSpaceBeforeNextOutput = false;
                    }
                }

                if (BlockElements.Contains(tagName))
                {
                    sb.AppendLine();
                }
            }
        }


        TraverseSimple(node);

        return FixExtraSpaces(sb.ToString()).Trim();
    }
    
    private string FixExtraSpaces(string text)
    {
        // Удаляем пробел перед запятой, точкой, восклицательным и вопросительным знаком
        text = Regex.Replace(text, @"\s+([,.!?])", "$1");
        // Удаляем двойные пробелы
        text = Regex.Replace(text, @"\s+", " ");
        return text.Trim();
    }
}