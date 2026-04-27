namespace HeightmapMinecraft.Core;

public static class Erosion
{
    public static float[] GaussianBlur5(float[] src, int size, int iterations = 1)
    {
        var outArr = src.ToArray();
        var tmp = new float[src.Length];
        for (var it = 0; it < iterations; it++)
        {
            for (var y = 0; y < size; y++)
            {
                for (var x = 0; x < size; x++)
                {
                    float sample(int xx)
                    {
                        xx = Math.Clamp(xx, 0, size - 1);
                        return outArr[y * size + xx];
                    }

                    tmp[y * size + x] =
                        (sample(x - 2) + 4f * sample(x - 1) + 6f * sample(x) + 4f * sample(x + 1) + sample(x + 2)) / 16f;
                }
            }

            for (var y = 0; y < size; y++)
            {
                for (var x = 0; x < size; x++)
                {
                    float sample(int yy)
                    {
                        yy = Math.Clamp(yy, 0, size - 1);
                        return tmp[yy * size + x];
                    }

                    outArr[y * size + x] =
                        (sample(y - 2) + 4f * sample(y - 1) + 6f * sample(y) + 4f * sample(y + 1) + sample(y + 2)) / 16f;
                }
            }
        }

        return outArr;
    }

    public static float[] HydraulicErosion(float[] height, int size, int droplets, int maxSteps, int seed, CancellationToken token)
    {
        var rng = new Random(seed);
        var h = height.ToArray();

        const float inertia = 0.12f;
        const float capacityFactor = 4f;
        const float deposition = 0.28f;
        const float erosion = 0.34f;
        const float evaporation = 0.018f;
        const float gravity = 3.8f;

        for (var d = 0; d < droplets; d++)
        {
            if ((d & 2047) == 0) token.ThrowIfCancellationRequested();

            var x = 1f + (float)rng.NextDouble() * (size - 3);
            var y = 1f + (float)rng.NextDouble() * (size - 3);
            var dx = 0f;
            var dy = 0f;
            var speed = 1f;
            var water = 1f;
            var sediment = 0f;

            for (var step = 0; step < maxSteps; step++)
            {
                var ix = (int)x;
                var iy = (int)y;
                if (ix <= 1 || iy <= 1 || ix >= size - 2 || iy >= size - 2) break;

                var gx = (h[iy * size + (ix + 1)] - h[iy * size + (ix - 1)]) * 0.5f;
                var gy = (h[(iy + 1) * size + ix] - h[(iy - 1) * size + ix]) * 0.5f;

                dx = dx * inertia - gx * (1f - inertia);
                dy = dy * inertia - gy * (1f - inertia);
                var norm = MathF.Sqrt(dx * dx + dy * dy);
                if (norm < 1e-8f)
                {
                    dx = (float)rng.NextDouble() * 2f - 1f;
                    dy = (float)rng.NextDouble() * 2f - 1f;
                    norm = MathF.Sqrt(dx * dx + dy * dy);
                }

                dx /= norm;
                dy /= norm;

                var nx = x + dx;
                var ny = y + dy;
                var nix = (int)nx;
                var niy = (int)ny;
                if (nix <= 1 || niy <= 1 || nix >= size - 2 || niy >= size - 2) break;

                var idx = iy * size + ix;
                var nidx = niy * size + nix;
                var dh = h[nidx] - h[idx];
                var capacity = MathF.Max(-dh * speed * water * capacityFactor, 0.001f);

                if (sediment > capacity || dh > 0f)
                {
                    var deposit = dh <= 0f ? (sediment - capacity) * deposition : MathF.Min(sediment, dh);
                    sediment -= deposit;
                    h[idx] += deposit;
                }
                else
                {
                    var erodeAmount = MathF.Min((capacity - sediment) * erosion, h[idx]);
                    sediment += erodeAmount;
                    h[idx] -= erodeAmount;
                }

                speed = MathF.Sqrt(MathF.Max(0f, speed * speed + dh * gravity));
                water *= 1f - evaporation;
                x = nx;
                y = ny;
                if (water < 0.02f) break;
            }
        }

        h = GaussianBlur5(h, size);
        for (var i = 0; i < h.Length; i++) h[i] = Math.Clamp(h[i], 0f, 1f);
        return h;
    }

    public static float[] ThermalErosion(float[] height, int size, int iterations, float talus = 0.025f)
    {
        var h = height.ToArray();
        for (var it = 0; it < iterations; it++)
        {
            var next = h.ToArray();
            for (var y = 0; y < size; y++)
            {
                var yn = Math.Max(0, y - 1);
                var ys = Math.Min(size - 1, y + 1);
                for (var x = 0; x < size; x++)
                {
                    var xl = Math.Max(0, x - 1);
                    var xr = Math.Min(size - 1, x + 1);
                    var idx = y * size + x;
                    var hc = h[idx];

                    var dn = hc - h[yn * size + x];
                    var ds = hc - h[ys * size + x];
                    var de = hc - h[y * size + xr];
                    var dw = hc - h[y * size + xl];

                    var moveN = dn > talus ? (dn - talus) * 0.15f : 0f;
                    var moveS = ds > talus ? (ds - talus) * 0.15f : 0f;
                    var moveE = de > talus ? (de - talus) * 0.15f : 0f;
                    var moveW = dw > talus ? (dw - talus) * 0.15f : 0f;
                    var total = moveN + moveS + moveE + moveW;

                    next[idx] -= total;
                    next[yn * size + x] += moveN;
                    next[ys * size + x] += moveS;
                    next[y * size + xr] += moveE;
                    next[y * size + xl] += moveW;
                }
            }

            for (var i = 0; i < h.Length; i++) h[i] = Math.Clamp(next[i], 0f, 1f);
        }

        return h;
    }
}
