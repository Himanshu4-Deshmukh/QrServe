using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuickServeQR.API.Data;
using QuickServeQR.API.DTOs;
using QuickServeQR.API.Models;
using QuickServeQR.API.Services;

namespace QuickServeQR.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MenuController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IImageStorageService _images;
    private readonly ILogger<MenuController> _logger;

    public MenuController(AppDbContext db, IImageStorageService images, ILogger<MenuController> logger)
    {
        _db     = db;
        _images = images;
        _logger = logger;
    }

    private static string[]? ParseTags(string? tags) =>
        string.IsNullOrEmpty(tags) ? null
            : tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    [HttpGet("categories")]
    public async Task<ActionResult<List<CategoryResponseDto>>> GetCategories()
    {
        var cats = await _db.Categories
            .Where(c => c.IsActive)
            .OrderBy(c => c.SortOrder)
            .Include(c => c.MenuItems)
            .ToListAsync();

        return Ok(cats.Select(c => new CategoryResponseDto(
            c.Id, c.Name, c.Description, c.SortOrder, c.IsActive,
            c.MenuItems.OrderBy(m => m.SortOrder).Select(m => new MenuItemResponseDto(
                m.Id, m.CategoryId, c.Name, m.Name, m.Description,
                m.Price, m.ImageUrl, m.IsAvailable, m.PreparationTime,
                m.Calories, ParseTags(m.Tags)
            )).ToList()
        )));
    }

    [HttpGet("items")]
    public async Task<ActionResult<List<MenuItemResponseDto>>> GetAllItems()
    {
        var items = await _db.MenuItems.Include(m => m.Category)
            .Where(m => m.IsAvailable)
            .OrderBy(m => m.Category!.SortOrder).ThenBy(m => m.SortOrder)
            .ToListAsync();

        return Ok(items.Select(m => new MenuItemResponseDto(
            m.Id, m.CategoryId, m.Category?.Name ?? "", m.Name,
            m.Description, m.Price, m.ImageUrl, m.IsAvailable,
            m.PreparationTime, m.Calories, ParseTags(m.Tags)
        )));
    }

    [HttpGet("items/{id}")]
    public async Task<ActionResult<MenuItemResponseDto>> GetItem(Guid id)
    {
        var m = await _db.MenuItems.Include(x => x.Category).FirstOrDefaultAsync(x => x.Id == id);
        if (m == null) return NotFound();
        return Ok(new MenuItemResponseDto(
            m.Id, m.CategoryId, m.Category?.Name ?? "", m.Name,
            m.Description, m.Price, m.ImageUrl, m.IsAvailable,
            m.PreparationTime, m.Calories, ParseTags(m.Tags)
        ));
    }

    [HttpPost("categories")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<Category>> CreateCategory(CreateCategoryDto dto)
    {
        var cat = new Category { Name = dto.Name, Description = dto.Description, SortOrder = dto.SortOrder };
        _db.Categories.Add(cat);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetCategories), new { id = cat.Id }, cat);
    }

    [HttpPost("items")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<MenuItem>> CreateItem(CreateMenuItemDto dto)
    {
        var item = new MenuItem
        {
            CategoryId = dto.CategoryId, Name = dto.Name, Description = dto.Description,
            Price = dto.Price, ImageUrl = dto.ImageUrl, PreparationTime = dto.PreparationTime,
            Calories = dto.Calories, Tags = dto.Tags != null ? string.Join(",", dto.Tags) : null
        };
        _db.MenuItems.Add(item);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetItem), new { id = item.Id }, item);
    }

    [HttpPut("items/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateItem(Guid id, UpdateMenuItemDto dto)
    {
        var item = await _db.MenuItems.FindAsync(id);
        if (item == null) return NotFound();
        if (dto.Name != null) item.Name = dto.Name;
        if (dto.Description != null) item.Description = dto.Description;
        if (dto.Price.HasValue) item.Price = dto.Price.Value;
        if (dto.ImageUrl != null) item.ImageUrl = dto.ImageUrl;
        if (dto.IsAvailable.HasValue) item.IsAvailable = dto.IsAvailable.Value;
        if (dto.PreparationTime.HasValue) item.PreparationTime = dto.PreparationTime.Value;
        if (dto.Calories.HasValue) item.Calories = dto.Calories.Value;
        if (dto.Tags != null) item.Tags = string.Join(",", dto.Tags);
        item.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("items/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteItem(Guid id)
    {
        var item = await _db.MenuItems.FindAsync(id);
        if (item == null) return NotFound();
        await _images.DeleteAsync(item.ImageUrl);
        _db.MenuItems.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("items/{id}/image")]
    [Authorize(Roles = "Admin")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<IActionResult> UploadImage(Guid id, [FromForm] IFormFile file)
    {
        try
        {
            var item = await _db.MenuItems.FindAsync(id);
            if (item == null) return NotFound();

            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded");

            var allowed = new[] { ".jpg", ".jpeg", ".png", ".webp", ".gif" };
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowed.Contains(ext))
                return BadRequest("Only image files (jpg, png, webp, gif) are allowed");

            item.ImageUrl = await _images.SaveAsync(file, item.ImageUrl);
            item.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return Ok(new { imageUrl = item.ImageUrl });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upload menu image for item {ItemId}", id);
            return Problem("Image upload failed. Check server logs for the exception.");
        }
    }

    [HttpDelete("items/{id}/image")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteImage(Guid id)
    {
        var item = await _db.MenuItems.FindAsync(id);
        if (item == null) return NotFound();

        await _images.DeleteAsync(item.ImageUrl);
        item.ImageUrl = null;
        item.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return NoContent();
    }
}
