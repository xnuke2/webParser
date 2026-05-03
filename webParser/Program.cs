
using System.IdentityModel.Tokens.Jwt;
using System.Reflection;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.OpenApi;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using webParser.config;
using webParser.Data;
using webParser.Service;


var builder = WebApplication.CreateBuilder(args);
builder.Services.AddCors(options =>
{
    options.AddPolicy("Mobile",
        policy =>
        {
            policy.WithOrigins(
                    "http://localhost:8081",
                    "http://192.168.31.54:8081",
                    "http://192.168.31.200:8081")
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials();
        });
});

Environment.SetEnvironmentVariable("PLAYWRIGHT_BROWSERS_PATH", "/app/bin/.playwright");
Environment.SetEnvironmentVariable("DOTNET_PLAYWRIGHT_PATH", "/app/bin/.playwright");
builder.Services.Configure<HtmlServiceOptions>(builder.Configuration.GetSection("HtmlService"));
builder.Services.AddSingleton<HtmlService>();

builder.Services.Configure<HtmlServiceOptions>(
    builder.Configuration.GetSection("HtmlService"));

builder.Services.AddHttpClient();
builder.Services.AddSingleton<HtmlService>();
Console.WriteLine("Playwright browsers path: " + Environment.GetEnvironmentVariable("PLAYWRIGHT_BROWSERS_PATH"));

builder.Configuration.AddEnvironmentVariables();
builder.Services.AddAuthorization();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = AuthOptions.ISSUER,
            ValidateAudience = true,
            ValidAudience = AuthOptions.AUDIENCE,
            ValidateLifetime = true,
            IssuerSigningKey = AuthOptions.GetSymmetricSecurityKey(),
            ValidateIssuerSigningKey = true,
        };
    });
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddScoped<HtmlService>();
builder.Services.AddScoped<StringParser>();
builder.Services.AddHostedService<ParserBackgroundService>();
builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.PropertyNamingPolicy = null;
    options.JsonSerializerOptions.WriteIndented = true;
});
builder.Services.AddHttpClient();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Version = "v1",
        Title = "WebParser API",
        Description = "Web Parser API"
    });
    
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter JWT token"
    });


    c.AddSecurityRequirement(document => new() { [new OpenApiSecuritySchemeReference("Bearer", document)] = [] });
});

var app = builder.Build();
app.UseCors("Mobile");
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();

    if (!db.AnalyzedSites.Any())
    {
        db.AnalyzedSites.AddRange(
            new webParser.Models.Database.AnalyzedSite { Id = 1, Name = "Toyota Camry 2018", Url = "https://example.com/camry-2018", UserId = -1 },
            new webParser.Models.Database.AnalyzedSite { Id = 2, Name = "BMW 3 Series 2020", Url = "https://example.com/bmw-3-2020", UserId = -1 },
            new webParser.Models.Database.AnalyzedSite { Id = 3, Name = "Hyundai Tucson 2019", Url = "https://example.com/tucson-2019", UserId = -1 },
            new webParser.Models.Database.AnalyzedSite { Id = 4, Name = "Kia Sportage 2021", Url = "https://example.com/sportage-2021", UserId = -1 },
            new webParser.Models.Database.AnalyzedSite { Id = 5, Name = "Volkswagen Passat 2017", Url = "https://example.com/passat-2017", UserId = -1 }
        );
        db.SaveChanges();

        db.AnalyzedFields.AddRange(
            new webParser.Models.Database.AnalyzedField { Name = "Цена", FieldToGet = "1 250 000 ₽", AnalyzedSiteId = 1, FieldNameId = 1 },
            new webParser.Models.Database.AnalyzedField { Name = "Год выпуска", FieldToGet = "2018", AnalyzedSiteId = 1, FieldNameId = 2 },
            new webParser.Models.Database.AnalyzedField { Name = "Марка", FieldToGet = "Toyota", AnalyzedSiteId = 1, FieldNameId = 3 },
            new webParser.Models.Database.AnalyzedField { Name = "Модель", FieldToGet = "Camry", AnalyzedSiteId = 1, FieldNameId = 4 },
            new webParser.Models.Database.AnalyzedField { Name = "Пробег", FieldToGet = "78 000 км", AnalyzedSiteId = 1, FieldNameId = 5 },
            new webParser.Models.Database.AnalyzedField { Name = "Тип топлива", FieldToGet = "Бензин", AnalyzedSiteId = 1, FieldNameId = 8 },

            new webParser.Models.Database.AnalyzedField { Name = "Цена", FieldToGet = "3 800 000 ₽", AnalyzedSiteId = 2, FieldNameId = 1 },
            new webParser.Models.Database.AnalyzedField { Name = "Год выпуска", FieldToGet = "2020", AnalyzedSiteId = 2, FieldNameId = 2 },
            new webParser.Models.Database.AnalyzedField { Name = "Марка", FieldToGet = "BMW", AnalyzedSiteId = 2, FieldNameId = 3 },
            new webParser.Models.Database.AnalyzedField { Name = "Модель", FieldToGet = "3 Series", AnalyzedSiteId = 2, FieldNameId = 4 },
            new webParser.Models.Database.AnalyzedField { Name = "Мощность двигателя", FieldToGet = "184 л.с.", AnalyzedSiteId = 2, FieldNameId = 6 },
            new webParser.Models.Database.AnalyzedField { Name = "Коробка передач", FieldToGet = "Автомат", AnalyzedSiteId = 2, FieldNameId = 9 },

            new webParser.Models.Database.AnalyzedField { Name = "Цена", FieldToGet = "2 050 000 ₽", AnalyzedSiteId = 3, FieldNameId = 1 },
            new webParser.Models.Database.AnalyzedField { Name = "Год выпуска", FieldToGet = "2019", AnalyzedSiteId = 3, FieldNameId = 2 },
            new webParser.Models.Database.AnalyzedField { Name = "Марка", FieldToGet = "Hyundai", AnalyzedSiteId = 3, FieldNameId = 3 },
            new webParser.Models.Database.AnalyzedField { Name = "Модель", FieldToGet = "Tucson", AnalyzedSiteId = 3, FieldNameId = 4 },
            new webParser.Models.Database.AnalyzedField { Name = "Привод", FieldToGet = "Полный", AnalyzedSiteId = 3, FieldNameId = 10 },
            new webParser.Models.Database.AnalyzedField { Name = "Цвет", FieldToGet = "Белый", AnalyzedSiteId = 3, FieldNameId = 11 },

            new webParser.Models.Database.AnalyzedField { Name = "Цена", FieldToGet = "2 450 000 ₽", AnalyzedSiteId = 4, FieldNameId = 1 },
            new webParser.Models.Database.AnalyzedField { Name = "Год выпуска", FieldToGet = "2021", AnalyzedSiteId = 4, FieldNameId = 2 },
            new webParser.Models.Database.AnalyzedField { Name = "Марка", FieldToGet = "Kia", AnalyzedSiteId = 4, FieldNameId = 3 },
            new webParser.Models.Database.AnalyzedField { Name = "Модель", FieldToGet = "Sportage", AnalyzedSiteId = 4, FieldNameId = 4 },
            new webParser.Models.Database.AnalyzedField { Name = "Кузов", FieldToGet = "SUV", AnalyzedSiteId = 4, FieldNameId = 12 },
            new webParser.Models.Database.AnalyzedField { Name = "Тип топлива", FieldToGet = "Дизель", AnalyzedSiteId = 4, FieldNameId = 8 },

            new webParser.Models.Database.AnalyzedField { Name = "Цена", FieldToGet = "1 650 000 ₽", AnalyzedSiteId = 5, FieldNameId = 1 },
            new webParser.Models.Database.AnalyzedField { Name = "Год выпуска", FieldToGet = "2017", AnalyzedSiteId = 5, FieldNameId = 2 },
            new webParser.Models.Database.AnalyzedField { Name = "Марка", FieldToGet = "Volkswagen", AnalyzedSiteId = 5, FieldNameId = 3 },
            new webParser.Models.Database.AnalyzedField { Name = "Модель", FieldToGet = "Passat", AnalyzedSiteId = 5, FieldNameId = 4 },
            new webParser.Models.Database.AnalyzedField { Name = "Пробег", FieldToGet = "112 000 км", AnalyzedSiteId = 5, FieldNameId = 5 },
            new webParser.Models.Database.AnalyzedField { Name = "Объём двигателя", FieldToGet = "1.8 л", AnalyzedSiteId = 5, FieldNameId = 7 }
        );
        db.SaveChanges();
    }
}
var configuration = builder.Configuration;

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "v1");
        options.RoutePrefix = String.Empty;

        options.OAuthClientId("swagger-ui");
        options.OAuthAppName("Swagger UI");
        options.OAuthClientId("swagger-ui");
        options.OAuthAppName("Swagger UI");
        options.OAuthUsePkce();
        options.EnablePersistAuthorization();
        options.OAuth2RedirectUrl($"{configuration["Swagger:RedirectUrl"]}/swagger/oauth2-redirect.html");

        options.ConfigObject.AdditionalItems.Add("requestInterceptor", "(req) => { console.log('Request:', req); return req; }");

        options.EnablePersistAuthorization();
        options.DefaultModelsExpandDepth(-1);
    });
}
else
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.MapStaticAssets();
app.MapSwagger();
app.MapControllerRoute(
        name: "default",
        pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();

app.Run();
