using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuickServeQR.API.Data;
using QuickServeQR.API.DTOs;

namespace QuickServeQR.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class AnalyticsController : ControllerBase
{
    private readonly AppDbContext _db;
    public AnalyticsController(AppDbContext db) => _db = db;

    [HttpGet("dashboard")]
    public async Task<ActionResult<DashboardAnalyticsDto>> GetDashboard()
    {
        var today = DateTime.UtcNow.Date;

        var ordersQuery = _db.Orders
            .AsNoTracking()
            .Where(o => o.CreatedAt >= today);

        var totalOrders = await ordersQuery.CountAsync();

        var totalRevenue = await ordersQuery
            .Where(o => o.PaymentStatus == "Paid")
            .SumAsync(o => (decimal?)o.Total) ?? 0;

        var activeOrders = await ordersQuery
            .CountAsync(o => o.Status != "Completed" && o.Status != "Cancelled");

        var avgValue = totalOrders > 0
            ? await ordersQuery
                .AverageAsync(o => (decimal?)o.Total) ?? 0
            : 0;

        var tables = await _db.Tables
            .AsNoTracking()
            .Select(t => t.IsOccupied)
            .ToListAsync();

        var todaysOrders = await _db.Orders
            .AsNoTracking()
            .Where(o => o.CreatedAt >= today)
            .Include(o => o.Items)
                .ThenInclude(i => i.MenuItem)
            .ToListAsync();

        var topItems = todaysOrders
            .SelectMany(o => o.Items)
            .GroupBy(i => i.MenuItem?.Name ?? "Unknown")
            .Select(g => new TopSellingItemDto(
                g.Key,
                g.Sum(i => i.Quantity),
                g.Sum(i => i.UnitPrice * i.Quantity)))
            .OrderByDescending(x => x.Quantity)
            .Take(5)
            .ToList();

        var byHour = todaysOrders
            .GroupBy(o => o.CreatedAt.Hour)
            .Select(g => new RevenueByHourDto(g.Key, g.Sum(o => o.Total), g.Count()))
            .OrderBy(x => x.Hour)
            .ToList();

        return Ok(new DashboardAnalyticsDto(
            totalOrders, totalRevenue, activeOrders,
            tables.Count(t => t), tables.Count,
            Math.Round(avgValue, 2), topItems, byHour
        ));
    }
}
