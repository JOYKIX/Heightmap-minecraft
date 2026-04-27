using System.Numerics;

namespace HeightmapMinecraft.Core;

public static class Noise
{
    private static float Fade(float t) => t * t * (3f - 2f * t);

    public static float[] ValueNoise2D(int size, float frequency, int seed)
    {
        var grid = (int)MathF.Ceiling(size * frequency) + 3;
        var random = new Random(seed);
        var lattice = new float[grid * grid];
        for (var i = 0; i < lattice.Length; i++)
            lattice[i] = (float)random.NextDouble();

        var output = new float[size * size];
        for (var y = 0; y < size; y++)
        {
            var fy = y * frequency;
            var y0 = (int)MathF.Floor(fy);
            var y1 = y0 + 1;
            var ty = Fade(fy - y0);

            for (var x = 0; x < size; x++)
            {
                var fx = x * frequency;
                var x0 = (int)MathF.Floor(fx);
                var x1 = x0 + 1;
                var tx = Fade(fx - x0);

                var v00 = lattice[y0 * grid + x0];
                var v10 = lattice[y0 * grid + x1];
                var v01 = lattice[y1 * grid + x0];
                var v11 = lattice[y1 * grid + x1];

                var a = v00 * (1f - tx) + v10 * tx;
                var b = v01 * (1f - tx) + v11 * tx;
                output[y * size + x] = a * (1f - ty) + b * ty;
            }
        }

        return output;
    }

    public static float[] Fbm(int size, float baseFreq, int octaves, float lacunarity, float gain, int seed)
    {
        var outArr = new float[size * size];
        var amp = 1f;
        var freq = baseFreq;
        var ampSum = 0f;

        for (var i = 0; i < octaves; i++)
        {
            var n = ValueNoise2D(size, freq, seed + i * 101);
            for (var p = 0; p < outArr.Length; p++)
                outArr[p] += amp * (n[p] * 2f - 1f);

            ampSum += amp;
            amp *= gain;
            freq *= lacunarity;
        }

        for (var p = 0; p < outArr.Length; p++)
            outArr[p] = (outArr[p] / ampSum + 1f) * 0.5f;

        return outArr;
    }

    public static float[] RidgedNoise(int size, float baseFreq, int octaves, int seed)
    {
        var n = Fbm(size, baseFreq, octaves, 2f, 0.56f, seed);
        for (var i = 0; i < n.Length; i++)
        {
            var r = 1f - MathF.Abs(2f * n[i] - 1f);
            n[i] = Math.Clamp(r, 0f, 1f);
        }

        return n;
    }
}
