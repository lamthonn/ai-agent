using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace CodesLoop.Api.Data;

/// <summary>Lets `dotnet ef migrations add` build the model against PostgreSQL without starting the app.</summary>
public class AppDbFactory : IDesignTimeDbContextFactory<AppDb>
{
    public AppDb CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<AppDb>().UseNpgsql("Host=localhost;Database=codesloop;Username=codesloop;Password=design-time-only").Options);
}
