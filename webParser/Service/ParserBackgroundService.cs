using Microsoft.EntityFrameworkCore;
using webParser.Data;
using webParser.Models.Database;
using webParser.Models.DTO;

namespace webParser.Service;

public class ParserBackgroundService(IServiceScopeFactory scopeFactory, ILogger<ParserBackgroundService> logger) : BackgroundService
{
    // Интервал обновления кэша — 6 часов
    private readonly TimeSpan _interval = TimeSpan.FromHours(6);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Parser background service started");

        // Первый запуск сразу при старте
        await ParseAllSitesAsync(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(_interval, stoppingToken);
            await ParseAllSitesAsync(stoppingToken);
        }
    }

    private async Task ParseAllSitesAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Starting scheduled parsing of all sites");

        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var htmlService = scope.ServiceProvider.GetRequiredService<HtmlService>();
        var stringParser = scope.ServiceProvider.GetRequiredService<StringParser>();

        var sites = await db.AnalyzedSites.ToListAsync(stoppingToken);

        foreach (var site in sites)
        {
            if (stoppingToken.IsCancellationRequested) break;

            try
            {
                var fields = await db.AnalyzedFields
                    .Where(f => f.AnalyzedSiteId == site.Id)
                    .Select(f => new DataField { Field = f.Name, Data = f.FieldToGet })
                    .ToListAsync(stoppingToken);

                if (fields.Count == 0) continue;

                var html = await htmlService.GetHtmlWithPlaywrightAsync(site.Url);
                var results = stringParser.ParseString(html, fields);

                // Удаляем старый кэш для этого сайта
                var existing = db.ParsedData.Where(p => p.SiteId == site.Id);
                db.ParsedData.RemoveRange(existing);

                // Сохраняем новые данные
                var now = DateTime.UtcNow;
                db.ParsedData.AddRange(results.Select(r => new ParsedData
                {
                    SiteId = site.Id,
                    Field = r.Field,
                    Data = r.Data,
                    UpdatedAt = now
                }));

                await db.SaveChangesAsync(stoppingToken);
                logger.LogInformation("Parsed site {Id} ({Url})", site.Id, site.Url);

                // Небольшая пауза между сайтами чтобы не нагружать
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to parse site {Id} ({Url})", site.Id, site.Url);
            }
        }

        logger.LogInformation("Scheduled parsing completed");
    }
}
