namespace QuickServeQR.API.Services;

public class LocalImageStorageService : IImageStorageService
{
    private readonly IWebHostEnvironment _env;
    public LocalImageStorageService(IWebHostEnvironment env) => _env = env;

    public async Task<string> SaveAsync(IFormFile file, string? existingUrl)
    {
        await DeleteAsync(existingUrl);

        var imagesDir = Path.Combine(_env.ContentRootPath, "wwwroot", "images", "menu");
        Directory.CreateDirectory(imagesDir);

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var fileName = $"{Guid.NewGuid()}{ext}";
        var filePath = Path.Combine(imagesDir, fileName);

        await using var stream = new FileStream(filePath, FileMode.Create);
        await file.CopyToAsync(stream);

        return $"/images/menu/{fileName}";
    }

    public Task DeleteAsync(string? url)
    {
        if (string.IsNullOrEmpty(url)) return Task.CompletedTask;
        if (!url.StartsWith("/images/menu/", StringComparison.OrdinalIgnoreCase))
            return Task.CompletedTask;

        var filePath = Path.Combine(_env.ContentRootPath, "wwwroot", url.TrimStart('/'));
        if (File.Exists(filePath)) File.Delete(filePath);
        return Task.CompletedTask;
    }
}
