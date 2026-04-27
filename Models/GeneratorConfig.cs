namespace HeightmapMinecraft.Models;

public sealed class GeneratorConfig
{
    public int Size { get; set; } = 1024;
    public int Seed { get; set; } = 42;
    public int SeaLevel { get; set; } = Core.TerrainGenerator.SeaLevelY;
    public int MinY { get; set; } = Core.TerrainGenerator.MinTerrainY;
    public int MaxY { get; set; } = Core.TerrainGenerator.MaxTerrainY;
    public int Octaves { get; set; } = 7;
    public int ErosionDroplets { get; set; } = 220_000;
    public int ErosionSteps { get; set; } = 45;
    public int ThermalIterations { get; set; } = 14;
    public float MoistureWindAngleDeg { get; set; } = 35f;
    public string OutputDirectory { get; set; } = Environment.CurrentDirectory;
    public string FilePrefix { get; set; } = "island";

    public GeneratorConfig Clone() => (GeneratorConfig)MemberwiseClone();
}
