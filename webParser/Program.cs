using System.Reflection;
using Microsoft.OpenApi;
using Microsoft.EntityFrameworkCore;
using webParser.Data;
using webParser.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Add services to the container.
builder.Services.AddControllersWithViews();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Version = "v1",
        Title = "example API",
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

    // using System.Reflection;
    var xmlFilename = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    options.IncludeXmlComments(Path.Combine(AppContext.BaseDirectory, xmlFilename));
});



var app = builder.Build();
try
{
    await DatabaseService.MigrateDatabaseAsync(app.Services);
    Console.WriteLine("Database migrations applied successfully");
}
catch (Exception ex)
{
    Console.WriteLine($"Database migration failed: {ex.Message}");
    // Не падаем, продолжаем работу
}
// Автоматическое применение миграций
// using (var scope = app.Services.CreateScope())
// {
//     var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
//     db.Database.Migrate();
// }
var configuration = builder.Configuration;



if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    
    //app.UseSwaggerUI();
    app.UseSwaggerUI(options => // UseSwaggerUI is called only in Development.
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "v1");
        options.RoutePrefix = String.Empty;
    });
}
else
{
    // Configure the HTTP request pipeline.
    app.UseExceptionHandler("/Home/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}
//builder.Services.AddRouting(options => options.LowercaseUrls = true);

// builder.Services.AddApiControllers(builder.Environment);

// builder.Services.AddEndpointsApiExplorer();
// builder.Services.AddSwaggerWithAuth();

// builder.Services.AddMinio(configuration);
// builder.Services.AddDapper();
// builder.Services.MigrateDatabase(configuration);
// builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssemblies(typeof(Program).Assembly));
// builder.Services.AddFluentValidation();

app.UseHttpsRedirection();
app.UseRouting();

app.UseAuthorization();

app.MapStaticAssets();

app.MapControllerRoute(
        name: "default",
        pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();


app.Run();