using System.Text.Json;
using CodesLoop.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace CodesLoop.Api.Data;

public static class SettingsStore
{
    public static async Task<T> GetAsync<T>(this AppDb db, string key, T fallback)
    {
        var s = await db.Settings.FindAsync(key);
        return s is null ? fallback : JsonSerializer.Deserialize<T>(s.Json) ?? fallback;
    }

    public static async Task SetAsync<T>(this AppDb db, string key, T value)
    {
        var json = JsonSerializer.Serialize(value);
        var s = await db.Settings.FindAsync(key);
        if (s is null) db.Settings.Add(new Setting { Key = key, Json = json }); else s.Json = json;
        await db.SaveChangesAsync();
    }

    /// <summary>Start of "today" in Vietnam time (UTC+7), as UTC: the day the daily limit counts.</summary>
    public static DateTime TodayStartUtc() => DateTime.UtcNow.AddHours(7).Date.AddHours(-7);

    public static Task<long> TokensTodayAsync(this AppDb db, string? projectId = null) =>
        db.JobSteps.Where(s => s.At >= TodayStartUtc() && (projectId == null || db.Jobs.Any(j => j.Id == s.JobId && j.ProjectId == projectId)))
            .SumAsync(s => (long?)s.Tokens).ContinueWith(t => t.Result ?? 0);
}
