namespace HeightmapMinecraft.Core;

public static class BiomeGenerator
{
    public static float[] MoistureMap(float[] height, int size, float seaLevel, float windAngleDeg, int seed)
    {
        var moist = new float[height.Length];
        var baseMap = Noise.Fbm(size, 0.009f, 4, 2.1f, 0.6f, seed);
        var windX = MathF.Cos(windAngleDeg * MathF.PI / 180f);
        var windY = MathF.Sin(windAngleDeg * MathF.PI / 180f);

        for (var i = 0; i < moist.Length; i++)
            moist[i] = 0f;

        for (var pass = 0; pass < 50; pass++)
        {
            var next = new float[moist.Length];
            for (var y = 0; y < size; y++)
            {
                for (var x = 0; x < size; x++)
                {
                    var sx = Math.Clamp((int)(x - windX), 0, size - 1);
                    var sy = Math.Clamp((int)(y - windY), 0, size - 1);
                    var idx = y * size + x;
                    var src = sy * size + sx;
                    var coast = height[idx] <= seaLevel + 0.02f ? 1f : 0f;
                    var m = 0.92f * moist[src] + 0.08f * coast;
                    var lift = MathF.Max(height[idx] - m, 0f);
                    next[idx] = m * MathF.Exp(-2.8f * lift);
                }
            }

            moist = next;
        }

        for (var i = 0; i < moist.Length; i++)
            moist[i] = Math.Clamp(0.65f * moist[i] + 0.35f * baseMap[i], 0f, 1f);

        return moist;
    }

    public static byte[] BuildBiomePreview(float[] height, float[] moisture, int size, float seaLevel)
    {
        var rgb = new byte[size * size * 3];
        for (var i = 0; i < height.Length; i++)
        {
            var h = height[i];
            var m = moisture[i];
            byte r, g, b;

            if (h < seaLevel) (r, g, b) = (20, 70, 160);
            else if (h < seaLevel + 0.02f) (r, g, b) = (230, 214, 160);
            else if (h > 0.78f) (r, g, b) = (238, 238, 238);
            else if (h > 0.66f) (r, g, b) = (110, 110, 110);
            else if (m < 0.28f) (r, g, b) = (222, 196, 110);
            else if (m < 0.55f) (r, g, b) = (98, 160, 82);
            else (r, g, b) = (45, 120, 62);

            var p = i * 3;
            rgb[p] = r;
            rgb[p + 1] = g;
            rgb[p + 2] = b;
        }

        return rgb;
    }
}
