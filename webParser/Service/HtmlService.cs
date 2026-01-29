namespace webParser.Service;

public class HtmlService(IHttpClientFactory httpClientFactory)
{
    public async Task<string> GetHtmlAsync(string url)
    {
        var client = httpClientFactory.CreateClient();
        
        client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0");
        
        var response = await client.GetStringAsync(url);
        return response;
    }
}