using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuickServeQR.API.Data;
using QuickServeQR.API.DTOs;
using QuickServeQR.API.Models;

namespace QuickServeQR.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TablesController : ControllerBase
{
    private readonly AppDbContext _db;
    public TablesController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<List<RestaurantTable>>> GetTables() =>
        Ok(await _db.Tables.OrderBy(t => t.TableNumber).ToListAsync());

    [HttpPost]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
    public async Task<ActionResult<RestaurantTable>> CreateTable([FromBody] CreateRestaurantTableDto dto)
    {
        if (dto.TableNumber.HasValue)
        {
            if (dto.TableNumber.Value <= 0)
                return BadRequest("Table number must be at least 1");

            var exists = await _db.Tables.AnyAsync(t => t.TableNumber == dto.TableNumber.Value);
            if (exists) return Conflict("A table with this number already exists");
        }

        var tableNumber = dto.TableNumber.HasValue
            ? dto.TableNumber.Value
            : await _db.Tables.AnyAsync()
                ? await _db.Tables.MaxAsync(t => t.TableNumber) + 1
                : 1;

        var seats = dto.Seats.GetValueOrDefault(4);
        if (seats <= 0) return BadRequest("Seats must be at least 1");

        var table = new RestaurantTable
        {
            TableNumber = tableNumber,
            QrCode = $"QS-TABLE-{tableNumber:D3}",
            Seats = seats
        };

        _db.Tables.Add(table);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetTable), new { id = table.Id }, table);
    }

    [HttpDelete("{id}")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteTable(Guid id)
    {
        var table = await _db.Tables.FindAsync(id);
        if (table == null) return NotFound();

        var hasOrders = await _db.Orders.AnyAsync(o => o.TableId == id);
        if (hasOrders)
            return Conflict("This table cannot be deleted because it has order history.");

        _db.Tables.Remove(table);
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<RestaurantTable>> GetTable(Guid id)
    {
        var table = await _db.Tables.FindAsync(id);
        return table == null ? NotFound() : Ok(table);
    }

    [HttpGet("qr/{qrCode}")]
    public async Task<ActionResult<RestaurantTable>> GetTableByQr(string qrCode)
    {
        var table = await _db.Tables.FirstOrDefaultAsync(t => t.QrCode == qrCode);
        return table == null ? NotFound() : Ok(table);
    }
}
