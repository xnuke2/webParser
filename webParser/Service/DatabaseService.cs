using Microsoft.EntityFrameworkCore;
using webParser.Data;

namespace webParser.Service;

public static class DatabaseService
{
    public static async Task MigrateDatabaseAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        

        await WaitForDatabaseAsync(db);
        
        await db.Database.MigrateAsync();
    }
    
    private static async Task WaitForDatabaseAsync(AppDbContext dbContext, int maxRetries = 10)
    {
        for (int i = 0; i < maxRetries; i++)
        {
            try
            {
                if (await dbContext.Database.CanConnectAsync())
                {
                    Console.WriteLine("Database connection successful");
                    return;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Database connection attempt {i + 1} failed: {ex.Message}");
            }
            
            await Task.Delay(2000); 
        }
        
        throw new Exception("Could not connect to database after multiple attempts");
    }
}