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
    public const int MinTerrainY = -64;
    public const int MaxTerrainY = 319;
    public const int SeaLevelY = 62;

    public GenerationResult Generate(GeneratorConfig cfg, IProgress<GenerationProgress>? progress, CancellationToken token)
    {
        var size = cfg.Size;

        progress?.Report(new(GenerationStage.BaseNoise, 0.05, "Macro-relief continental..."));
        var continental = Noise.Fbm(size, 0.00085f, 5, 2.03f, 0.56f, cfg.Seed);
        var regional = Noise.Fbm(size, 0.0019f, 4, 2.08f, 0.57f, cfg.Seed + 91);
        var basins = Noise.Fbm(size, 0.0012f, 4, 2.0f, 0.55f, cfg.Seed + 177);
        var shelves = Noise.Fbm(size, 0.0045f, 4, 2.15f, 0.56f, cfg.Seed + 333);
        var rolling = Noise.Fbm(size, 0.0068f, cfg.Octaves, 2.18f, 0.56f, cfg.Seed + 487);
        var landRelief = Noise.Fbm(size, 0.0032f, 5, 2.1f, 0.56f, cfg.Seed + 511);
        var mountainMacro = Noise.Fbm(size, 0.0016f, 4, 2.05f, 0.58f, cfg.Seed + 619);
        var chainRidges = Noise.RidgedNoise(size, 0.0028f, Math.Max(cfg.Octaves - 1, 1), cfg.Seed + 701);
        var valleyNoise = Noise.RidgedNoise(size, 0.0074f, 4, cfg.Seed + 809);
        var micro = Noise.Fbm(size, 0.011f, 3, 2.2f, 0.54f, cfg.Seed + 883);
        var terrainY = new float[size * size];

        for (var i = 0; i < terrainY.Length; i++)
        {
            var continentSignal = 0.56f * continental[i] + 0.29f * regional[i] - 0.15f * basins[i] + cfg.OceanCoverageBias;
            var landMask = SmoothStep(0.43f, 0.64f, continentSignal);
            var oceanFloor = 20f + shelves[i] * 30f;
            var coastLift = SmoothStep(0.30f, 0.56f, landMask);
            oceanFloor = Lerp(oceanFloor, 58f + shelves[i] * 4f, coastLift);

            var plains = 64f + (rolling[i] * 20f + (landRelief[i] - 0.5f) * 12f) * cfg.TerrainScale;
            var mountainMask = MathF.Pow(Math.Clamp(0.62f * chainRidges[i] + 0.38f * mountainMacro[i] - 0.46f, 0f, 1f), 1.55f);
            var mountainAmplitude = Lerp(40f, 190f, mountainMacro[i]);
            var mountainHeight = mountainMask * mountainAmplitude * cfg.MountainScale;
            var valleys = MathF.Pow(Math.Clamp(valleyNoise[i], 0f, 1f), 2.7f) * 17f;

            var landY = plains + mountainHeight - valleys + (micro[i] - 0.5f) * 4f;
            var y = Lerp(oceanFloor, landY, landMask);

            if (y > 280f)
                y = 280f + (y - 280f) * 0.35f;

            terrainY[i] = Math.Clamp(y, cfg.MinY, cfg.MaxY);
        }
        token.ThrowIfCancellationRequested();

        progress?.Report(new(GenerationStage.DomainWarp, 0.2, "Domain warp régional..."));
        terrainY = DomainWarp(terrainY, size, size * 0.018f, cfg.Seed + 999);

        progress?.Report(new(GenerationStage.IslandMask, 0.32, "Contraintes altimétriques Minecraft..."));
        terrainY = EnforceMinecraftBands(terrainY, size, cfg.MinY, cfg.MaxY, cfg.SeaLevel);
        var terrain = ToNormalizedHeight(terrainY, cfg.MinY, cfg.MaxY);
        terrain = Erosion.GaussianBlur5(terrain, size);

        progress?.Report(new(GenerationStage.HydraulicErosion, 0.45, "Érosion hydraulique..."));
        terrain = Erosion.HydraulicErosion(terrain, size, (int)(cfg.ErosionDroplets * cfg.ErosionScale), cfg.ErosionSteps, cfg.Seed + 666, token);
        terrainY = ToWorldHeight(terrain, cfg.MinY, cfg.MaxY);
        terrainY = EnforceMinecraftBands(terrainY, size, cfg.MinY, cfg.MaxY, cfg.SeaLevel);
        terrain = ToNormalizedHeight(terrainY, cfg.MinY, cfg.MaxY);

        progress?.Report(new(GenerationStage.ThermalErosion, 0.7, "Érosion thermique..."));
        terrain = Erosion.ThermalErosion(terrain, size, (int)MathF.Max(0, cfg.ThermalIterations * cfg.ErosionScale));
        terrainY = ToWorldHeight(terrain, cfg.MinY, cfg.MaxY);
        terrainY = EnforceMinecraftBands(terrainY, size, cfg.MinY, cfg.MaxY, cfg.SeaLevel);
        terrain = ToNormalizedHeight(terrainY, cfg.MinY, cfg.MaxY);

        NormalizeAndGamma(terrain, 1f);

        progress?.Report(new(GenerationStage.Moisture, 0.82, "Calcul humidité..."));
        if (cfg.EnableRivers)
            terrain = CarveRivers(terrain, size, cfg.Seed + 1201);

        var moisture = BiomeGenerator.MoistureMap(terrain, size, ToNormalizedY(cfg.SeaLevel, cfg.MinY, cfg.MaxY), cfg.MoistureWindAngleDeg, cfg.Seed + 777);

        progress?.Report(new(GenerationStage.Biomes, 0.92, "Calcul biomes..."));
        var biomes = BiomeGenerator.BuildBiomePreview(terrain, moisture, size, ToNormalizedY(cfg.SeaLevel, cfg.MinY, cfg.MaxY));

        progress?.Report(new(GenerationStage.Biomes, 1.0, "Génération terminée."));
        return new GenerationResult(terrain, moisture, biomes, size);
    }

    private static void NormalizeAndGamma(float[] terrain, float gamma)
    {
        for (var i = 0; i < terrain.Length; i++)
        {
            terrain[i] = MathF.Pow(Math.Clamp(terrain[i], 0f, 1f), gamma);
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

    private static float[] EnforceMinecraftBands(float[] terrainY, int size, int minY, int maxY, int seaLevel)
    {
        var adjusted = terrainY.ToArray();
        for (var i = 0; i < adjusted.Length; i++)
        {
            var y = adjusted[i];
            if (y < 15f) y = 15f + (y - 15f) * 0.18f;
            if (y is > 58f and < 66f) y = Lerp(y, seaLevel, 0.18f);
            if (y > 250f) y = 250f + (y - 250f) * 0.48f;
            adjusted[i] = Math.Clamp(y, minY, maxY);
        }

        return Erosion.GaussianBlur5(adjusted, size, 1);
    }

    public static float ToNormalizedY(float worldY, int minY = MinTerrainY, int maxY = MaxTerrainY) =>
        (worldY - minY) / MathF.Max(1f, maxY - minY);

    public static int ToWorldY(float normalized, int minY = MinTerrainY, int maxY = MaxTerrainY) =>
        (int)MathF.Round(minY + Math.Clamp(normalized, 0f, 1f) * MathF.Max(1f, maxY - minY));

    private static float[] ToNormalizedHeight(float[] terrainY, int minY = MinTerrainY, int maxY = MaxTerrainY)
    {
        var normalized = new float[terrainY.Length];
        for (var i = 0; i < terrainY.Length; i++)
            normalized[i] = ToNormalizedY(terrainY[i], minY, maxY);
        return normalized;
    }

    private static float[] ToWorldHeight(float[] normalized, int minY = MinTerrainY, int maxY = MaxTerrainY)
    {
        var terrainY = new float[normalized.Length];
        for (var i = 0; i < normalized.Length; i++)
            terrainY[i] = ToWorldY(normalized[i], minY, maxY);
        return terrainY;
    }


    private static float[] CarveRivers(float[] terrain, int size, int seed)
    {
        var riverNoise = Noise.RidgedNoise(size, 0.01f, 4, seed);
        var carved = terrain.ToArray();
        for (var i = 0; i < carved.Length; i++)
        {
            var riverMask = Math.Clamp(0.12f - MathF.Abs(riverNoise[i] - 0.5f), 0f, 0.12f) / 0.12f;
            if (riverMask > 0f)
                carved[i] = Math.Clamp(carved[i] - riverMask * 0.03f, 0f, 1f);
        }

        return Erosion.GaussianBlur5(carved, size, 1);
    }

    private static float SmoothStep(float edge0, float edge1, float x)
    {
        var t = Math.Clamp((x - edge0) / (edge1 - edge0 + 1e-8f), 0f, 1f);
        return t * t * (3f - 2f * t);
    }

    private static float Lerp(float a, float b, float t)
    {
        var clamped = Math.Clamp(t, 0f, 1f);
        return a + (b - a) * clamped;
    }
}
