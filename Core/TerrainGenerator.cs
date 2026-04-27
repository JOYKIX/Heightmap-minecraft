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
        var cellCount = size * size;

        progress?.Report(new(GenerationStage.BaseNoise, 0.04, "Macro-relief géologique..."));
        var continental = Noise.Fbm(size, 0.00078f, 5, 2.02f, 0.57f, cfg.Seed + 11);
        var macroWarpA = Noise.Fbm(size, 0.0014f, 4, 2.11f, 0.57f, cfg.Seed + 73);
        var macroWarpB = Noise.Fbm(size, 0.0014f, 4, 2.11f, 0.57f, cfg.Seed + 181);
        var basins = Noise.Fbm(size, 0.0021f, 4, 2.08f, 0.56f, cfg.Seed + 223);
        var regional = Noise.Fbm(size, 0.0038f, 5, 2.1f, 0.56f, cfg.Seed + 307);
        var landDetail = Noise.Fbm(size, 0.0065f, cfg.Octaves, 2.14f, 0.55f, cfg.Seed + 409);
        var shelves = Noise.Fbm(size, 0.0042f, 4, 2.12f, 0.56f, cfg.Seed + 499);
        var chainField = Noise.RidgedNoise(size, 0.0022f, 5, cfg.Seed + 571);
        var peakField = Noise.RidgedNoise(size, 0.0054f, 4, cfg.Seed + 653);
        var valleyField = Noise.RidgedNoise(size, 0.0031f, 4, cfg.Seed + 739);
        var micro = Noise.Fbm(size, 0.014f, 3, 2.18f, 0.54f, cfg.Seed + 811);

        token.ThrowIfCancellationRequested();

        progress?.Report(new(GenerationStage.DomainWarp, 0.16, "Structuration régionale..."));
        var falloff = CreateIslandFalloff(size, cfg.Seed + 907, cfg.OceanCoverageBias, macroWarpA, macroWarpB);

        var terrainY = new float[cellCount];
        var ruggedness = new float[cellCount];

        for (var i = 0; i < cellCount; i++)
        {
            var continentSignal = 0.55f * continental[i] + 0.22f * regional[i] - 0.17f * basins[i] + 0.18f * (1f - falloff[i]);
            var landMask = SmoothStep(0.44f, 0.62f, continentSignal);

            var oceanFloor = Lerp(20f, 36f, shelves[i]);
            oceanFloor = Lerp(oceanFloor, 50f, SmoothStep(0.32f, 0.62f, 1f - falloff[i]));

            var plains = 66f + (regional[i] - 0.5f) * 20f + (landDetail[i] - 0.5f) * 10f * cfg.TerrainScale;

            var mountainMask = MathF.Pow(Math.Clamp(0.62f * chainField[i] + 0.38f * peakField[i] - 0.42f, 0f, 1f), 1.45f);
            var mountainAmplitude = Lerp(38f, 210f, MathF.Pow(peakField[i], 1.15f)) * cfg.MountainScale;
            var valleys = MathF.Pow(Math.Clamp(valleyField[i], 0f, 1f), 2.5f) * 22f;

            var reliefY = plains + mountainMask * mountainAmplitude - valleys + (micro[i] - 0.5f) * 5f;
            var y = Lerp(oceanFloor, reliefY, landMask);

            // Descente obligatoire vers l'océan aux bordures
            y = Lerp(y, oceanFloor - 3f, MathF.Pow(falloff[i], 1.1f));

            terrainY[i] = Math.Clamp(y, cfg.MinY, cfg.MaxY);
            ruggedness[i] = Math.Clamp(0.5f * mountainMask + 0.3f * peakField[i] + 0.2f * landDetail[i], 0f, 1f);
        }

        ForceOceanBorder(terrainY, size, cfg.SeaLevel, shelves, falloff);
        token.ThrowIfCancellationRequested();

        progress?.Report(new(GenerationStage.IslandMask, 0.3, "Adaptation altimétrique Minecraft..."));
        terrainY = EnforceMinecraftAltitudeBands(terrainY, size, cfg.SeaLevel, cfg.MinY, cfg.MaxY);

        var terrain = ToNormalizedHeight(terrainY, cfg.MinY, cfg.MaxY);

        progress?.Report(new(GenerationStage.HydraulicErosion, 0.48, "Érosion hydraulique pilotée..."));
        terrain = Erosion.HydraulicErosion(terrain, size, (int)(cfg.ErosionDroplets * cfg.ErosionScale), cfg.ErosionSteps, cfg.Seed + 1009, token);
        terrainY = ToWorldHeight(terrain, cfg.MinY, cfg.MaxY);
        ForceOceanBorder(terrainY, size, cfg.SeaLevel, shelves, falloff);

        progress?.Report(new(GenerationStage.ThermalErosion, 0.66, "Stabilisation des pentes..."));
        terrain = ToNormalizedHeight(terrainY, cfg.MinY, cfg.MaxY);
        terrain = Erosion.ThermalErosion(terrain, size, (int)MathF.Max(0, cfg.ThermalIterations * cfg.ErosionScale));
        terrainY = ToWorldHeight(terrain, cfg.MinY, cfg.MaxY);

        terrainY = VoxelSlopePass(terrainY, size, ruggedness, cfg.SeaLevel, cfg.MinY, cfg.MaxY);
        ForceOceanBorder(terrainY, size, cfg.SeaLevel, shelves, falloff);

        progress?.Report(new(GenerationStage.Moisture, 0.82, "Hydrologie et humidité..."));
        terrain = ToNormalizedHeight(terrainY, cfg.MinY, cfg.MaxY);
        if (cfg.EnableRivers)
        {
            terrain = CarveRivers(terrain, size, cfg.Seed + 1201);
            terrainY = ToWorldHeight(terrain, cfg.MinY, cfg.MaxY);
            terrainY = VoxelSlopePass(terrainY, size, ruggedness, cfg.SeaLevel, cfg.MinY, cfg.MaxY);
            ForceOceanBorder(terrainY, size, cfg.SeaLevel, shelves, falloff);
            terrain = ToNormalizedHeight(terrainY, cfg.MinY, cfg.MaxY);
        }

        progress?.Report(new(GenerationStage.Biomes, 0.92, "Calcul biomes..."));
        var moisture = BiomeGenerator.MoistureMap(terrain, size, ToNormalizedY(cfg.SeaLevel, cfg.MinY, cfg.MaxY), cfg.MoistureWindAngleDeg, cfg.Seed + 777);
        var biomes = BiomeGenerator.BuildBiomePreview(terrain, moisture, size, ToNormalizedY(cfg.SeaLevel, cfg.MinY, cfg.MaxY));

        progress?.Report(new(GenerationStage.Biomes, 1.0, "Génération terminée."));
        return new GenerationResult(terrain, moisture, biomes, size);
    }

    private static float[] CreateIslandFalloff(int size, int seed, float oceanBias, float[] warpA, float[] warpB)
    {
        var coastlineNoise = Noise.Fbm(size, 0.0032f, 4, 2.08f, 0.56f, seed + 41);
        var largeShape = Noise.Fbm(size, 0.0012f, 3, 2.04f, 0.58f, seed + 83);
        var falloff = new float[size * size];
        var center = (size - 1) * 0.5f;
        var invCenter = 1f / MathF.Max(1f, center);

        for (var y = 0; y < size; y++)
        {
            for (var x = 0; x < size; x++)
            {
                var idx = y * size + x;
                var nx = (x - center) * invCenter;
                var ny = (y - center) * invCenter;

                var ellipseX = nx * (0.92f + (warpA[idx] - 0.5f) * 0.22f);
                var ellipseY = ny * (1.04f + (warpB[idx] - 0.5f) * 0.22f);

                var radial = MathF.Sqrt(ellipseX * ellipseX + ellipseY * ellipseY);
                var organic = radial + (coastlineNoise[idx] - 0.5f) * 0.18f + (largeShape[idx] - 0.5f) * 0.08f + oceanBias * 0.4f;

                falloff[idx] = SmoothStep(0.62f, 1.02f, organic);
            }
        }

        return falloff;
    }

    private static void ForceOceanBorder(float[] terrainY, int size, int seaLevel, float[] shelves, float[] falloff)
    {
        var borderBand = Math.Max(12, size / 26);
        for (var y = 0; y < size; y++)
        {
            for (var x = 0; x < size; x++)
            {
                var idx = y * size + x;
                var edge = Math.Min(Math.Min(x, y), Math.Min(size - 1 - x, size - 1 - y));
                var edgeT = 1f - Math.Clamp(edge / (float)borderBand, 0f, 1f);
                var oceanTarget = Lerp(22f, 48f, shelves[idx]);
                var force = MathF.Max(MathF.Pow(edgeT, 1.75f), MathF.Pow(falloff[idx], 1.5f));
                var forcedY = Lerp(terrainY[idx], MathF.Min(oceanTarget, seaLevel - 1f), force);
                terrainY[idx] = MathF.Min(forcedY, seaLevel - (1f + edgeT * 8f));
            }
        }
    }

    private static float[] EnforceMinecraftAltitudeBands(float[] terrainY, int size, int seaLevel, int minY, int maxY)
    {
        var adjusted = terrainY.ToArray();
        for (var i = 0; i < adjusted.Length; i++)
        {
            var y = adjusted[i];

            // Océan cohérent
            if (y < 35f)
                y = Lerp(y, 28f, 0.15f);
            if (y is >= 35f and < seaLevel)
                y = Lerp(y, 46f + (y - 35f) * 0.35f, 0.1f);

            // Zones jouables de surface
            if (y > seaLevel && y < 64f)
                y = Lerp(y, 64f, 0.28f);

            // Compression douce des très hautes altitudes
            if (y > 240f)
                y = 240f + (y - 240f) * 0.55f;

            adjusted[i] = Math.Clamp(y, minY, maxY);
        }

        return adjusted;
    }

    private static float[] VoxelSlopePass(float[] terrainY, int size, float[] ruggedness, int seaLevel, int minY, int maxY)
    {
        var current = terrainY.Select(v => MathF.Round(v)).ToArray();
        var next = new float[current.Length];

        for (var pass = 0; pass < 5; pass++)
        {
            Array.Copy(current, next, current.Length);

            for (var y = 1; y < size - 1; y++)
            {
                for (var x = 1; x < size - 1; x++)
                {
                    var idx = y * size + x;
                    var h = current[idx];
                    var r = ruggedness[idx];

                    var cliffChance = MathF.Pow(Math.Clamp(r - 0.66f, 0f, 1f), 1.8f);
                    var localMaxDiff = 2f + r * 4f + cliffChance * 3f;

                    if (h < seaLevel + 20f)
                        localMaxDiff = MathF.Min(localMaxDiff, 2f + r * 2f);

                    Span<int> nbs = stackalloc int[4]
                    {
                        idx - 1,
                        idx + 1,
                        idx - size,
                        idx + size
                    };

                    var sum = 0f;
                    for (var i = 0; i < nbs.Length; i++)
                    {
                        var ni = nbs[i];
                        var nh = current[ni];
                        var diff = h - nh;

                        if (MathF.Abs(diff) > localMaxDiff)
                            nh = h - MathF.Sign(diff) * localMaxDiff;

                        sum += nh;
                    }

                    var target = (h * 0.55f + (sum / nbs.Length) * 0.45f);
                    next[idx] = MathF.Round(Math.Clamp(target, minY, maxY));
                }
            }

            (current, next) = (next, current);
        }

        return current;
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
        var riverNoise = Noise.RidgedNoise(size, 0.009f, 4, seed);
        var tributaries = Noise.RidgedNoise(size, 0.015f, 3, seed + 37);
        var carved = terrain.ToArray();
        for (var i = 0; i < carved.Length; i++)
        {
            var trunk = Math.Clamp(0.11f - MathF.Abs(riverNoise[i] - 0.5f), 0f, 0.11f) / 0.11f;
            var branch = Math.Clamp(0.08f - MathF.Abs(tributaries[i] - 0.5f), 0f, 0.08f) / 0.08f;
            var riverMask = MathF.Max(trunk, branch * 0.75f);
            if (riverMask > 0f)
                carved[i] = Math.Clamp(carved[i] - riverMask * 0.024f, 0f, 1f);
        }

        return carved;
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
