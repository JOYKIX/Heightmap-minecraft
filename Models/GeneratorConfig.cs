namespace HeightmapMinecraft.Models;

public sealed class GeneratorConfig
{
    public int Size { get; set; } = 1024;
    public int Seed { get; set; } = 42;
    public float SeaLevel { get; set; } = 0.45f;
    public int MaxHeightBlocks { get; set; } = 320;
    public int Octaves { get; set; } = 7;
    public int ErosionDroplets { get; set; } = 220_000;
    public int ErosionSteps { get; set; } = 45;
    public int ThermalIterations { get; set; } = 14;
    public float MoistureWindAngleDeg { get; set; } = 35f;
    public string OutputDirectory { get; set; } = Environment.CurrentDirectory;
    public string FilePrefix { get; set; } = "island";

    public GeneratorConfig Clone() => (GeneratorConfig)MemberwiseClone();
}
