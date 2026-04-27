using HeightmapMinecraft.Models;

namespace HeightmapMinecraft.Core;

public enum GenerationStage
{
    BaseNoise,
    DomainWarp,
    IslandMask,
    HydraulicErosion,
    ThermalErosion,
    Moisture,
    Biomes,
    Export
}

public sealed record GenerationProgress(GenerationStage Stage, double Percent, string Message);
public sealed record GenerationResult(float[] Height, float[] Moisture, byte[] Biomes, int Size);

public sealed class TerrainGenerator
{
    public GenerationResult Generate(GeneratorConfig cfg, IProgress<GenerationProgress>? progress, CancellationToken token)
    {
        var size = cfg.Size;

        progress?.Report(new(GenerationStage.BaseNoise, 0.05, "Bruit de base (fBm/ridged)..."));
        var baseMap = Noise.Fbm(size, 0.0024f, cfg.Octaves, 2.1f, 0.55f, cfg.Seed);
        var ridges = Noise.RidgedNoise(size, 0.0034f, Math.Max(cfg.Octaves - 1, 1), cfg.Seed + 177);
        var detail = Noise.Fbm(size, 0.008f, 4, 2.15f, 0.55f, cfg.Seed + 333);
        var terrain = new float[size * size];
        for (var i = 0; i < terrain.Length; i++) terrain[i] = 0.54f * baseMap[i] + 0.31f * ridges[i] + 0.15f * detail[i];
        token.ThrowIfCancellationRequested();

        progress?.Report(new(GenerationStage.DomainWarp, 0.2, "Domain warp..."));
        terrain = DomainWarp(terrain, size, size * 0.032f, cfg.Seed + 999);

        progress?.Report(new(GenerationStage.IslandMask, 0.32, "Masque radial insulaire..."));
        var mask = IslandMask(size, cfg.Seed + 444);
        for (var i = 0; i < terrain.Length; i++) terrain[i] *= mask[i];
        var shelves = Noise.Fbm(size, 0.01f, 3, 2.1f, 0.6f, cfg.Seed + 555);
        for (var i = 0; i < terrain.Length; i++) if (mask[i] < 0.2f) terrain[i] *= 0.8f + 0.2f * shelves[i];
        terrain = Erosion.GaussianBlur5(terrain, size);

        progress?.Report(new(GenerationStage.HydraulicErosion, 0.45, "Érosion hydraulique..."));
        terrain = Erosion.HydraulicErosion(terrain, size, cfg.ErosionDroplets, cfg.ErosionSteps, cfg.Seed + 666, token);

        progress?.Report(new(GenerationStage.ThermalErosion, 0.7, "Érosion thermique..."));
        terrain = Erosion.ThermalErosion(terrain, size, cfg.ThermalIterations);

        NormalizeAndGamma(terrain, 1.14f);

        progress?.Report(new(GenerationStage.Moisture, 0.82, "Calcul humidité..."));
        var moisture = BiomeGenerator.MoistureMap(terrain, size, cfg.SeaLevel, cfg.MoistureWindAngleDeg, cfg.Seed + 777);

        progress?.Report(new(GenerationStage.Biomes, 0.92, "Calcul biomes..."));
        var biomes = BiomeGenerator.BuildBiomePreview(terrain, moisture, size, cfg.SeaLevel);

        progress?.Report(new(GenerationStage.Biomes, 1.0, "Génération terminée."));
        return new GenerationResult(terrain, moisture, biomes, size);
    }

    private static void NormalizeAndGamma(float[] terrain, float gamma)
    {
        var min = terrain.Min();
        var max = terrain.Max();
        var span = max - min + 1e-8f;
        for (var i = 0; i < terrain.Length; i++)
        {
            var n = (terrain[i] - min) / span;
            terrain[i] = MathF.Pow(Math.Clamp(n, 0f, 1f), gamma);
        }
    }

    private static float[] DomainWarp(float[] src, int size, float warpStrength, int seed)
    {
        var dx = Noise.Fbm(size, 0.004f, 4, 2.15f, 0.58f, seed);
        var dy = Noise.Fbm(size, 0.004f, 4, 2.15f, 0.58f, seed + 991);
        var dst = new float[src.Length];

        for (var y = 0; y < size; y++)
        {
            for (var x = 0; x < size; x++)
            {
                var idx = y * size + x;
                var sx = Math.Clamp((int)(x + (dx[idx] * 2f - 1f) * warpStrength), 0, size - 1);
                var sy = Math.Clamp((int)(y + (dy[idx] * 2f - 1f) * warpStrength), 0, size - 1);
                dst[idx] = src[sy * size + sx];
            }
        }

        return dst;
    }

    private static float[] IslandMask(int size, int seed)
    {
        _ = seed;
        var mask = new float[size * size];
        var cx = (size - 1) * 0.5f;
        var cy = (size - 1) * 0.5f;
        var coastNoise = Noise.Fbm(size, 0.015f, 4, 2.25f, 0.55f, seed);

        for (var y = 0; y < size; y++)
        {
            for (var x = 0; x < size; x++)
            {
                var nx = (x - cx) / (size * 0.5f);
                var ny = (y - cy) / (size * 0.5f);
                var r = MathF.Sqrt(nx * nx + ny * ny);
                var angle = MathF.Atan2(ny, nx);
                var angularVariation = 0.08f * MathF.Sin(3f * angle + 0.5f)
                                       + 0.06f * MathF.Sin(5f * angle + 1.7f)
                                       + 0.04f * MathF.Sin(9f * angle + 2.2f);
                var idx = y * size + x;
                var effectiveR = r + angularVariation + coastNoise[idx] * 0.17f;
                var core = Math.Clamp(1f - effectiveR, 0f, 1f);
                mask[idx] = MathF.Pow(core, 1.25f);
            }
        }

        return mask;
    }
}
