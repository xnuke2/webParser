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
            policy.AllowAnyOrigin()
                .WithOrigins(
                    "http://localhost:8081",
                    "http://192.168.31.200:8081")
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials(); 
        });
});
// Устанавливаем переменную окружения для правильного пути
Environment.SetEnvironmentVariable("PLAYWRIGHT_BROWSERS_PATH", "/app/bin/.playwright");
Environment.SetEnvironmentVariable("DOTNET_PLAYWRIGHT_PATH", "/app/bin/.playwright");
builder.Services.Configure<HtmlServiceOptions>(builder.Configuration.GetSection("HtmlService"));
builder.Services.AddSingleton<HtmlService>();
// Настройки из appsettings.json
builder.Services.Configure<HtmlServiceOptions>(
    builder.Configuration.GetSection("HtmlService"));

builder.Services.AddHttpClient();
builder.Services.AddSingleton<HtmlService>();
Console.WriteLine("Playwright browsers path: " + Environment.GetEnvironmentVariable("PLAYWRIGHT_BROWSERS_PATH"));

// try
// {
//     // Проверяем установку Playwright
//     var playwrightBrowsersPath = Environment.GetEnvironmentVariable("PLAYWRIGHT_BROWSERS_PATH") ?? "/app/bin/.playwright";
//     Console.WriteLine($"Playwright browsers path: {playwrightBrowsersPath}");
//     
//     // Проверяем существование драйвера
//     var driverPath = Path.Combine(playwrightBrowsersPath, "node", "linux-arm64", "node");
//     Console.WriteLine($"Looking for Playwright driver at: {driverPath}");
//     
//     if (!File.Exists(driverPath))
//     {
//         Console.WriteLine("Playwright driver not found, attempting installation...");
//         
//         // Создаем директорию, если не существует
//         Directory.CreateDirectory(Path.Combine(playwrightBrowsersPath, "node", "linux-arm64"));
//         
//         // Запускаем установку через процесс
//         var process = new System.Diagnostics.Process
//         {
//             StartInfo = new System.Diagnostics.ProcessStartInfo
//             {
//                 FileName = "dotnet",
//                 Arguments = $"playwright install chromium --with-deps --path \"{playwrightBrowsersPath}\"",
//                 RedirectStandardOutput = true,
//                 RedirectStandardError = true,
//                 UseShellExecute = false,
//                 CreateNoWindow = true,
//             }
//         };
//         
//         process.Start();
//         var output = await process.StandardOutput.ReadToEndAsync();
//         var error = await process.StandardError.ReadToEndAsync();
//         process.WaitForExit();
//         
//         Console.WriteLine($"Installation output: {output}");
//         if (!string.IsNullOrEmpty(error))
//             Console.WriteLine($"Installation errors: {error}");
//         Console.WriteLine($"Playwright installation completed with exit code: {process.ExitCode}");
//         
//         // Проверяем снова
//         if (File.Exists(driverPath))
//         {
//             Console.WriteLine($"Playwright driver successfully installed at: {driverPath}");
//         }
//         else
//         {
//             Console.WriteLine($"Playwright driver still not found at: {driverPath}");
//             Console.WriteLine("Directory contents:");
//             try
//             {
//                 var dir = Path.GetDirectoryName(driverPath);
//                 if (Directory.Exists(dir))
//                 {
//                     foreach (var file in Directory.GetFiles(dir, "*", SearchOption.AllDirectories))
//                     {
//                         Console.WriteLine($"  - {file}");
//                     }
//                 }
//             }
//             catch { }
//         }
//     }
//     else
//     {
//         Console.WriteLine($"Playwright driver found at: {driverPath}");
//     }
// }
// catch (Exception ex)
// {
//     Console.WriteLine($"Warning: Could not initialize Playwright: {ex.Message}");
// }
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
builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.PropertyNamingPolicy = null; 
    options.JsonSerializerOptions.WriteIndented = true;
});
builder.Services.AddHttpClient();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Version = "v1",
        Title = "WebParser API",
        Description = "An ASP.NET Core Web API for managing ToDo items",
        TermsOfService = new Uri("https://example.com/terms"),
        Contact = new OpenApiContact
        {
            Name = "Example Contact",
            Url = new Uri("https://example.com/contact")
        },
        License = new OpenApiLicense
        {
            Name = "Example License",
            Url = new Uri("https://example.com/license")
        }
        
    });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme.\r\n\r\n" +
                      "Enter 'Bearer' [space] and then your token.\r\n\r\n" +
                      "Example: 'Bearer 12345abcdef'",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        BearerFormat = "JWT",
        Scheme = "Bearer" 
    });
    
    options.AddSecurityRequirement(document => 
    {
        var requirement = new OpenApiSecurityRequirement();
        requirement.Add(new OpenApiSecuritySchemeReference("Bearer"), new List<string>());
        return requirement;
    });

});

var app = builder.Build();
app.UseCors("Mobile");
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
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