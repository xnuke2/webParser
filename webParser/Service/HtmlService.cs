using System.Net;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.Playwright;
using webParser.config;

namespace webParser.Service;

public sealed class HtmlService : IAsyncDisposable
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<HtmlService> _logger;
    private readonly HtmlServiceOptions _options;
    private readonly string _contentRoot;

    private static IPlaywright? _playwright;
    private static IBrowser? _browser;
    private static readonly SemaphoreSlim _semaphore = new(1, 1);
    private bool _disposed;

    public HtmlService(
        IHttpClientFactory httpClientFactory,
        IOptions<HtmlServiceOptions> options,
        ILogger<HtmlService> logger,
        IWebHostEnvironment environment)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _options = options.Value;
        _contentRoot = environment.ContentRootPath;

        _ = InitializeBrowserAsync();
    }
    
    private async Task ApplyRateLimitDelay()
    {
        var delayMs = Random.Shared.Next(_options.RateLimitMinDelayMs, _options.RateLimitMaxDelayMs + 1);
        _logger.LogDebug("Applying rate limit delay: {DelayMs} ms", delayMs);
        await Task.Delay(delayMs);
    }

    private IEnumerable<Uri> LoadProxyUris()
    {
        var path = Path.IsPathRooted(_options.ProxyListPath)
            ? _options.ProxyListPath
            : Path.Combine(_contentRoot, _options.ProxyListPath);

        if (!File.Exists(path))
            return Array.Empty<Uri>();

        return File.ReadLines(path)
            .Select(line => line.Trim())
            .Where(line => !string.IsNullOrWhiteSpace(line))
            .Select(line => line.Split(':'))
            .Where(parts => parts.Length >= 2)
            .Select(parts => new Uri($"http://{parts[0]}:{parts[1]}"));
    }

    private HttpClient CreateHttpClient(Uri? proxy)
    {
        if (proxy is null)
            return _httpClientFactory.CreateClient();

        var handler = new HttpClientHandler
        {
            Proxy = new WebProxy(proxy),
            UseProxy = true
        };

        return new HttpClient(handler, disposeHandler: true);
    }

    private async Task<string> FetchHtmlWithHttpClientAsync(string url, Uri? proxy)
    {
        using var client = CreateHttpClient(proxy);
        client.Timeout = TimeSpan.FromSeconds(_options.HttpTimeoutSeconds);
        client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        client.DefaultRequestHeaders.Accept.ParseAdd("text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8");
        client.DefaultRequestHeaders.AcceptLanguage.ParseAdd("ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7");

        var response = await client.GetAsync(url);
        if ((int)response.StatusCode == 429)
        {
            var retryAfter = response.Headers.RetryAfter?.Delta ?? TimeSpan.FromSeconds(30);
            throw new HttpRequestException($"Rate limited (429): {url}. Retry after {retryAfter.TotalSeconds}s", null, response.StatusCode);
        }

        response.EnsureSuccessStatusCode();
        var byteArray = await response.Content.ReadAsByteArrayAsync();
        Encoding encoding = null;
        if (response.Content.Headers.ContentType?.CharSet != null)
        {
            try { encoding = Encoding.GetEncoding(response.Content.Headers.ContentType.CharSet); } catch { }
        }
        if (encoding == null)
        {
            // Latin-1 preserves all byte values unlike ASCII, so charset detection works even after non-ASCII content
            var latin1 = Encoding.GetEncoding("iso-8859-1").GetString(byteArray, 0, Math.Min(byteArray.Length, 4096));
            var metaCharset = System.Text.RegularExpressions.Regex.Match(latin1, @"<meta[^>]+charset=[""']?\s*([\w-]+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (metaCharset.Success)
            {
                try { encoding = Encoding.GetEncoding(metaCharset.Groups[1].Value); } catch { }
            }
        }
        // Last resort: try to detect UTF-8 BOM or valid UTF-8 sequence, otherwise fall back to Windows-1251 for Cyrillic sites
        if (encoding == null)
        {
            if (byteArray.Length >= 3 && byteArray[0] == 0xEF && byteArray[1] == 0xBB && byteArray[2] == 0xBF)
            {
                encoding = Encoding.UTF8;
            }
            else
            {
                try
                {
                    var utf8 = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);
                    utf8.GetString(byteArray);
                    encoding = Encoding.UTF8;
                }
                catch
                {
                    encoding = Encoding.GetEncoding("windows-1251");
                }
            }
        }
        return encoding.GetString(byteArray);
    }

    private async Task InitializeBrowserAsync()
    {
        try
        {
            await EnsureBrowserInitializedAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialize Playwright browser on startup");
        }
    }

    private async Task EnsureBrowserInitializedAsync()
    {
        if (_browser is { IsConnected: true })
            return;

        await _semaphore.WaitAsync();
        try
        {
            if (_browser is { IsConnected: true })
                return;

            // Закрываем старые экземпляры, если они есть
            await CloseBrowserAsync();

            _logger.LogInformation("Initializing Playwright browser...");
            
            // Playwright сам найдёт браузеры по PLAYWRIGHT_BROWSERS_PATH
            _playwright = await Playwright.CreateAsync();
            _browser = await _playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
            {
                Headless = true,
                Args = new[]
                {
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--disable-blink-features=AutomationControlled", // скрывает navigator.webdriver
                    "--disable-features=ChromeWhatsNewUI",
                    "--disable-component-extensions-with-background-pages",
                    "--disable-default-apps",
                    "--disable-extensions",
                    "--disable-sync",
                    "--hide-scrollbars",
                    "--mute-audio",
                    "--no-first-run",
                    "--no-default-browser-check"
                },
                Timeout = _options.NavigationTimeoutMs
            });

            
            _logger.LogInformation("Playwright browser initialized successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialize Playwright browser");
            throw new InvalidOperationException("Playwright browser unavailable", ex);
        }
        finally
        {
            _semaphore.Release();
        }
    }

    private async Task CloseBrowserAsync()
    {
        try
        {
            if (_browser != null)
            {
                await _browser.CloseAsync();
                await _browser.DisposeAsync();
            }
            _playwright?.Dispose();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error while closing Playwright browser");
        }
        finally
        {
            _browser = null;
            _playwright = null;
        }
    }

    public async Task<string> GetHtmlWithPlaywrightAsync(string url)
    {
        url = CleanUrl(url);
        _logger.LogInformation("Fetching with Playwright: {Url}", url);

        const int maxRetries = 3;
        for (int attempt = 1; attempt <= maxRetries; attempt++)
        {
            await ApplyRateLimitDelay();
            try
            {
                return await FetchWithPlaywrightInternalAsync(url);
            }
            catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
            {
                if (attempt == maxRetries)
                    throw;
                var delay = _options.RetryDelayOnRateLimitMs * attempt;
                _logger.LogWarning("Rate limited, attempt {Attempt}/{Max}, waiting {Delay}ms before retry", attempt, maxRetries, delay);
                await Task.Delay(delay);
            }
        }

        throw new InvalidOperationException("Unreachable");
    }

    private async Task<string> FetchWithPlaywrightInternalAsync(string url)
    {
        try
        {
            await EnsureBrowserInitializedAsync();

            // Создаём контекст и страницу для каждого запроса (изолированно)
            await using var context = await _browser!.NewContextAsync(new BrowserNewContextOptions
            {
                UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                ViewportSize = new ViewportSize { Width = 1920, Height = 1080 },
                IgnoreHTTPSErrors = true,
                JavaScriptEnabled = true,
                BypassCSP = true,
                Locale = "ru-RU",
                TimezoneId = "Europe/Moscow",
                ExtraHTTPHeaders = new Dictionary<string, string>
                {
                    ["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                    ["Accept-Language"] = "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
                    ["Accept-Encoding"] = "gzip, deflate, br",
                    ["Cache-Control"] = "no-cache",
                    ["Pragma"] = "no-cache",
                    ["Sec-Ch-Ua"] = "\"Chromium\";v=\"124\", \"Google Chrome\";v=\"124\", \"Not-A.Brand\";v=\"99\"",
                    ["Sec-Ch-Ua-Mobile"] = "?0",
                    ["Sec-Ch-Ua-Platform"] = "\"Windows\"",
                    ["Sec-Fetch-Dest"] = "document",
                    ["Sec-Fetch-Mode"] = "navigate",
                    ["Sec-Fetch-Site"] = "none",
                    ["Sec-Fetch-User"] = "?1",
                    ["Upgrade-Insecure-Requests"] = "1"
                }
            });
            
            var page = await context.NewPageAsync();
            try
            {
                // Навигация с ожиданием DOMContentLoaded
                var response = await page.GotoAsync(url, new PageGotoOptions
                {
                    WaitUntil = WaitUntilState.DOMContentLoaded,
                    Timeout = _options.NavigationTimeoutMs
                });

                if (response?.Status == 429)
                {
                    _logger.LogWarning("Rate limited (429) by {Url} via Playwright", url);
                    throw new HttpRequestException($"Rate limited (429): {url}", null, System.Net.HttpStatusCode.TooManyRequests);
                }

                // Ожидание, пока сеть не станет бездействующей (для AJAX/SPA)
                await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new PageWaitForLoadStateOptions
                {
                    Timeout = _options.NetworkIdleTimeoutMs
                });

                // Умное ожидание: пробуем дождаться пропадания спиннера или появления контента
                await WaitForContentAsync(page);

                var html = await page.ContentAsync();
                _logger.LogInformation("Playwright: received {Length} chars", html.Length);
                return html;
            }
            finally
            {
                await page.CloseAsync();
                // context автоматически закроется при await using
            }
        }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Playwright failed for {Url}, falling back to HttpClient", url);
            await CloseBrowserAsync();
            return await GetHtmlAsync(url);
        }
    }

    private async Task WaitForContentAsync(IPage page)
    {
        // Ждём, пока исчезнут типичные индикаторы загрузки
        var loadingSelectors = new[] { "#spinner", ".loading", ".loader", ".spinner", "[data-loading]" };
        foreach (var selector in loadingSelectors)
        {
            try
            {
                var element = await page.QuerySelectorAsync(selector);
                if (element != null && await element.IsVisibleAsync())
                {
                    _logger.LogDebug("Waiting for {Selector} to disappear", selector);
                    await page.WaitForSelectorAsync(selector, new PageWaitForSelectorOptions { State = WaitForSelectorState.Hidden, Timeout = 5000 });
                }
            }
            catch (TimeoutException) { /* игнорируем, если не дождались */ }
        }

        // Даём дополнительное время для рендеринга динамического контента
        if (_options.AdditionalWaitMs > 0)
            await Task.Delay(_options.AdditionalWaitMs);
    }

    public async Task<string> GetHtmlAsync(string url)
    {
        url = CleanUrl(url);
        _logger.LogInformation("Fetching with HttpClient: {Url}", url);

        await ApplyRateLimitDelay();

        try
        {
            return await FetchHtmlWithHttpClientAsync(url, null);
        }
        catch (Exception directEx)
        {
            _logger.LogWarning(directEx, "Direct request failed for {Url}, trying proxies", url);
        }

        foreach (var proxy in LoadProxyUris())
        {
            try
            {
                _logger.LogInformation("Retrying with proxy {Proxy} for {Url}", proxy, url);
                var content = await FetchHtmlWithHttpClientAsync(url, proxy);
                _logger.LogInformation("HttpClient via proxy: received {Length} chars", content.Length);
                return content;
            }
            catch (Exception proxyEx)
            {
                _logger.LogWarning(proxyEx, "Proxy {Proxy} failed for {Url}", proxy, url);
            }
        }

        throw new InvalidOperationException($"Unable to fetch {url} with direct connection or proxies");
    }

    public async Task<string> GetHtmlAdaptiveAsync(string url)
    {
        url = CleanUrl(url);
        _logger.LogInformation("Adaptive fetch: {Url}", url);

        bool shouldUsePlaywright = _options.ForcePlaywrightForJsSites &&
            _options.JsHeavySites.Any(site => url.Contains(site, StringComparison.OrdinalIgnoreCase));

        if (shouldUsePlaywright)
        {
            _logger.LogInformation("JS-heavy site detected, using Playwright");
            try
            {
                return await GetHtmlWithPlaywrightAsync(url);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Playwright failed, fallback to HttpClient");
                return await GetHtmlAsync(url);
            }
        }

        // Сначала пробуем простой HTTP
        try
        {
            var simpleHtml = await GetHtmlAsync(url);
            if (!IsEmptyPage(simpleHtml) && simpleHtml.Length >= _options.MinHtmlLengthForHttp)
            {
                _logger.LogInformation("HttpClient returned sufficient content");
                return simpleHtml;
            }
            _logger.LogInformation("HttpClient content insufficient, switching to Playwright");
            return await GetHtmlWithPlaywrightAsync(url);
        }
        catch (Exception httpEx)
        {
            _logger.LogWarning(httpEx, "HttpClient failed, trying Playwright");
            return await GetHtmlWithPlaywrightAsync(url);
        }
    }

    private string CleanUrl(string url)
    {
        if (string.IsNullOrWhiteSpace(url))
            return string.Empty;

        // Убираем управляющие символы
        var cleaned = new string(url.Where(c => !char.IsControl(c)).ToArray());
        cleaned = cleaned.Trim();

        // Кодируем пробелы и другие небезопасные символы
        if (cleaned.Contains(' '))
            cleaned = Uri.EscapeUriString(cleaned);

        return cleaned;
    }

    private bool IsEmptyPage(string html)
    {
        if (string.IsNullOrEmpty(html) || html.Length < 500)
            return true;

        var indicators = new[]
        {
            "id_spinner", "spinner", "noscript",
            "<meta http-equiv=\"refresh\"", "Loading...",
            "Загрузка...", "Loading data"
        };

        foreach (var indicator in indicators)
        {
            if (html.Contains(indicator, StringComparison.OrdinalIgnoreCase))
                return true;
        }

        // Проверяем, что после <body> есть достаточно текста
        var bodyStart = html.IndexOf("<body", StringComparison.OrdinalIgnoreCase);
        if (bodyStart >= 0)
        {
            var bodyContent = html.Substring(bodyStart);
            if (bodyContent.Length < 500)
                return true;
        }

        return false;
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed) return;
        _disposed = true;
        await CloseBrowserAsync();
        _semaphore.Dispose();
        GC.SuppressFinalize(this);
    }
}