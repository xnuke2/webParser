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
        
        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired();
        });
        
        modelBuilder.Entity<AnalyzedSite>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Url).IsRequired();
            
            entity.HasOne<User>()
                .WithMany()
                .HasForeignKey(a => a.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        
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
        modelBuilder.Entity<Role>().HasData(
            new Role
            {
                Id = 1,
                Name = "Пользователь",
            },
            new Role
            {
                Id = 2,
                Name = "Редактор",
            },
             new Role
            {
                Id = 3,
                Name = "Администратор",
            }
            );
        modelBuilder.Entity<User>().HasData(
            new User
            {
                Id = -1,
                Login = "admin",
                Password = "admin",
                RoleId = 3
            });
    }
}