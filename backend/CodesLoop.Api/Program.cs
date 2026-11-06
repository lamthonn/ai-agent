using System.Text;
using CodesLoop.Api.Data;
using CodesLoop.Api.Endpoints;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var cfg = builder.Configuration;

// Database: SQLite for development and tests, PostgreSQL for the deployment (Db:Provider = postgres).
builder.Services.AddDbContext<AppDb>(o =>
{
    var cs = cfg.GetConnectionString("Default") ?? "Data Source=codesloop.db";
    if (cfg["Db:Provider"] == "postgres") o.UseNpgsql(cs); else o.UseSqlite(cs);
});

var jwtKey = cfg["Jwt:Key"];
if (string.IsNullOrEmpty(jwtKey) || jwtKey.Length < 32) throw new InvalidOperationException("Set Jwt:Key to a secret of at least 32 characters.");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
    o.TokenValidationParameters = new TokenValidationParameters
    {
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        ValidateIssuer = false, ValidateAudience = false, ValidateLifetime = true, ClockSkew = TimeSpan.FromMinutes(1),
    });
builder.Services.AddAuthorization();
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(cfg.GetSection("Cors:Origins").Get<string[]>() ?? []).AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();
using (var scope = app.Services.CreateScope())
    await Seed.RunAsync(scope.ServiceProvider.GetRequiredService<AppDb>(), cfg, AppContext.BaseDirectory);

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapGet("/health", () => Results.Ok(new { ok = true }));
UserApi.Map(app);
SourcesApi.Map(app);
WorkerApi.Map(app);
app.Run();

public partial class Program;
