using HeightmapMinecraft.Core;
using HeightmapMinecraft.Models;
using Avalonia.Media.Imaging;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace HeightmapMinecraft.Services;

public sealed class ImageExportService
{
    public async Task ExportAsync(GenerationResult result, GeneratorConfig cfg, IProgress<GenerationProgress>? progress, CancellationToken token)
    {
        Directory.CreateDirectory(cfg.OutputDirectory);
        var baseName = Path.Combine(cfg.OutputDirectory, cfg.FilePrefix);

        progress?.Report(new(GenerationStage.Export, 0.96, "Export des images..."));

        await SaveHeight16Async(result.Height, result.Size, $"{baseName}_heightmap_16bit.png", token);
        await SaveHeightPreviewAsync(result.Height, result.Size, $"{baseName}_height_preview.png", token);
        await SaveBiomePreviewAsync(result.Biomes, result.Size, $"{baseName}_biomes_preview.png", token);
        await SaveMinecraftBlocksCsvAsync(result.Height, result.Size, $"{baseName}_blocks.csv", token);
    }

    public Bitmap BuildPreviewBitmap(float[] height, byte[] biomes, int size, int maxPreviewSize = 768)
    {
        using var img = new Image<Rgba32>(size, size);
        for (var y = 0; y < size; y++)
        {
            for (var x = 0; x < size; x++)
            {
                var idx = y * size + x;
                var g = (byte)Math.Clamp((int)(height[idx] * 255f), 0, 255);
                var b = idx * 3;
                var r = (byte)(0.65f * biomes[b] + 0.35f * g);
                var gg = (byte)(0.65f * biomes[b + 1] + 0.35f * g);
                var bb = (byte)(0.65f * biomes[b + 2] + 0.35f * g);
                img[x, y] = new Rgba32(r, gg, bb, 255);
            }
        }

        if (size > maxPreviewSize)
            img.Mutate(c => c.Resize(new ResizeOptions { Size = new Size(maxPreviewSize, maxPreviewSize), Mode = ResizeMode.Max }));

        using var ms = new MemoryStream();
        img.SaveAsPng(ms);
        ms.Position = 0;
        return new Bitmap(ms);
    }

    private static async Task SaveHeight16Async(float[] height, int size, string filePath, CancellationToken token)
    {
        using var img = new Image<L16>(size, size);
        for (var y = 0; y < size; y++)
            for (var x = 0; x < size; x++)
                img[x, y] = new L16((ushort)Math.Clamp((int)(height[y * size + x] * 65535f), 0, 65535));

        await img.SaveAsPngAsync(filePath, token);
    }

    private static async Task SaveHeightPreviewAsync(float[] height, int size, string filePath, CancellationToken token)
    {
        using var img = new Image<L8>(size, size);
        for (var y = 0; y < size; y++)
            for (var x = 0; x < size; x++)
                img[x, y] = new L8((byte)Math.Clamp((int)(height[y * size + x] * 255f), 0, 255));

        await img.SaveAsPngAsync(filePath, token);
    }

    private static async Task SaveBiomePreviewAsync(byte[] biomes, int size, string filePath, CancellationToken token)
    {
        using var img = new Image<Rgb24>(size, size);
        for (var y = 0; y < size; y++)
            for (var x = 0; x < size; x++)
            {
                var i = (y * size + x) * 3;
                img[x, y] = new Rgb24(biomes[i], biomes[i + 1], biomes[i + 2]);
            }

        await img.SaveAsPngAsync(filePath, token);
    }

    private static async Task SaveMinecraftBlocksCsvAsync(float[] height, int size, string filePath, CancellationToken token)
    {
        await using var fs = File.Create(filePath);
        await using var writer = new StreamWriter(fs);

        for (var y = 0; y < size; y++)
        {
            token.ThrowIfCancellationRequested();
            for (var x = 0; x < size; x++)
            {
                if (x > 0) await writer.WriteAsync(',');
                var blocks = TerrainGenerator.ToWorldY(height[y * size + x]);
                await writer.WriteAsync(blocks.ToString());
            }

            await writer.WriteLineAsync();
        }
    }
}
