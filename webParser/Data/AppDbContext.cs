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
    public DbSet<FieldName> FieldNames => Set<FieldName>();
    public DbSet<ParsedData> ParsedData => Set<ParsedData>();
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
        
        modelBuilder.Entity<FieldName>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(40);
        });

        modelBuilder.Entity<ParsedData>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Field).IsRequired();
            entity.Property(e => e.Data).IsRequired();
            entity.HasOne<AnalyzedSite>()
                .WithMany()
                .HasForeignKey(p => p.SiteId)
                .OnDelete(DeleteBehavior.Cascade);
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

            entity.HasOne<FieldName>()
                .WithMany()
                .HasForeignKey(a => a.FieldNameId)
                .OnDelete(DeleteBehavior.SetNull)
                .IsRequired(false);
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
        modelBuilder.Entity<FieldName>().HasData(
            new FieldName { Id = 1, Name = "Цена" },
            new FieldName { Id = 2, Name = "Год выпуска" },
            new FieldName { Id = 3, Name = "Марка" },
            new FieldName { Id = 4, Name = "Модель" },
            new FieldName { Id = 5, Name = "Пробег" },
            new FieldName { Id = 6, Name = "Мощность двигателя" },
            new FieldName { Id = 7, Name = "Объём двигателя" },
            new FieldName { Id = 8, Name = "Тип топлива" },
            new FieldName { Id = 9, Name = "Коробка передач" },
            new FieldName { Id = 10, Name = "Привод" },
            new FieldName { Id = 11, Name = "Цвет" },
            new FieldName { Id = 12, Name = "Кузов" }
        );
    }
}