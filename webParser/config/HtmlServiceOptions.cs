namespace webParser.config;

public class HtmlServiceOptions
{
    public int NavigationTimeoutMs { get; set; } = 60000;
    public int NetworkIdleTimeoutMs { get; set; } = 30000;
    public int AdditionalWaitMs { get; set; } = 2000;
    public int HttpTimeoutSeconds { get; set; } = 30;
    public int MinHtmlLengthForHttp { get; set; } = 3000;
    public string[] JsHeavySites { get; set; } = { "auto.ru", "drom.ru", "avito.ru", "sberauto.com","auto.drom.ru" };
    public bool ForcePlaywrightForJsSites { get; set; } = true;
    public string ProxyListPath { get; set; } = "config/Webshare 10 proxies.txt";

    public int RateLimitMinDelayMs { get; set; } = 5000;
    public int RateLimitMaxDelayMs { get; set; } = 8000;
    public int RetryDelayOnRateLimitMs { get; set; } = 30000;
}