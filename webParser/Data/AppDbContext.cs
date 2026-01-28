using Microsoft.EntityFrameworkCore;
using webParser.Models.Database;

namespace webParser.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Role> Roles => Set<Role>();
    public DbSet<User> Users => Set<User>();
    public DbSet<AnalyzedSite> AnalyzedSites => Set<AnalyzedSite>();
    
    public DbSet<FavoriteSite> FavoriteSites => Set<FavoriteSite>();
    
    public DbSet<AnalyzedField> AnalyzedFields => Set<AnalyzedField>();
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Конфигурация для User
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Login).IsRequired();
            entity.Property(e => e.Password).IsRequired();
            
            entity.HasOne<Role>()
                .WithMany()
                .HasForeignKey(u => u.RoleId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Конфигурация для Role
        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired();
        });

        // Конфигурация для AnalyzedSite
        modelBuilder.Entity<AnalyzedSite>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Url).IsRequired();
            
            entity.HasOne<User>()
                .WithMany()
                .HasForeignKey(a => a.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Конфигурация для AnalyzedField
        modelBuilder.Entity<AnalyzedField>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired();
            entity.Property(e => e.FieldToGet).IsRequired();
            
            entity.HasOne<AnalyzedSite>()
                .WithMany()
                .HasForeignKey(a => a.AnalyzedSiteId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Конфигурация для FavoriteSite (составной ключ)
        modelBuilder.Entity<FavoriteSite>(entity =>
        {
            entity.HasKey(e => new { e.AnalyzedSiteId, e.UserId });
            
            entity.HasOne<AnalyzedSite>()
                .WithMany()
                .HasForeignKey(f => f.AnalyzedSiteId)
                .OnDelete(DeleteBehavior.Cascade);
                
            entity.HasOne<User>()
                .WithMany()
                .HasForeignKey(f => f.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}