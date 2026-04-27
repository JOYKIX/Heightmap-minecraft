using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows.Input;
using Avalonia.Media.Imaging;
using HeightmapMinecraft.Core;
using HeightmapMinecraft.Models;
using HeightmapMinecraft.Services;

namespace HeightmapMinecraft.ViewModels;

public sealed class MainWindowViewModel : INotifyPropertyChanged
{
    private readonly TerrainGenerator _generator = new();
    private readonly ImageExportService _exportService = new();
    private CancellationTokenSource? _cts;
    private CancellationTokenSource? _previewCts;
    private GenerationResult? _lastResult;

    private bool _isGenerating;
    private bool _isExpertMode;
    private bool _previewBusy;
    private string _status = "Prêt à générer votre map Minecraft.";
    private double _progressValue;
    private Bitmap? _previewImage;
    private string _selectedWorldType = "Monde survie vanilla";
    private string _worldSizePreset = "Moyen (2048)";
    private int _seed = 42;
    private int _seaLevel = TerrainGenerator.SeaLevelY;
    private int _minY = TerrainGenerator.MinTerrainY;
    private int _maxY = TerrainGenerator.MaxTerrainY;
    private int _reliefLevel = 2;
    private int _mountainIntensity = 1;
    private int _oceanAmount = 1;
    private bool _riversEnabled = true;
    private int _erosionLevel = 1;
    private int _size = 2048;

    // Expert parameters
    private int _octaves = 7;
    private int _erosionDroplets = 220_000;
    private int _erosionSteps = 45;
    private int _thermalIterations = 14;
    private float _windAngle = 35f;

    public event PropertyChangedEventHandler? PropertyChanged;

    public MainWindowViewModel()
    {
        GenerateCommand = new AsyncRelayCommand(GenerateAsync, () => !IsGenerating);
        ExportCommand = new AsyncRelayCommand(ExportAsync, () => _lastResult is not null && !IsGenerating);
        CancelCommand = new RelayCommand(Cancel, () => IsGenerating);
        RandomSeedCommand = new RelayCommand(RandomSeed);
        ToggleExpertModeCommand = new RelayCommand(() => IsExpertMode = !IsExpertMode);

        OutputDirectory = Environment.CurrentDirectory;
        FilePrefix = "minecraft_world";
        ApplyWorldTypePreset(SelectedWorldType);
        RequestLivePreview();
    }

    public ICommand GenerateCommand { get; }
    public ICommand ExportCommand { get; }
    public ICommand CancelCommand { get; }
    public ICommand RandomSeedCommand { get; }
    public ICommand ToggleExpertModeCommand { get; }

    public IReadOnlyList<string> WorldTypes { get; } =
    [
        "Île", "Archipel", "Continent", "Monde Fantasy", "Montagnes", "Vallées", "Monde RP", "Japon / relief montagneux",
        "Plateau médiéval", "Monde survie vanilla", "Monde réaliste", "Monde ultra montagneux"
    ];

    public IReadOnlyList<string> SizePresets { get; } = ["Petit (1024)", "Moyen (2048)", "Grand (4096)", "Géant (8192)"];

    public string SelectedWorldType
    {
        get => _selectedWorldType;
        set
        {
            if (!SetField(ref _selectedWorldType, value)) return;
            ApplyWorldTypePreset(value);
            RequestLivePreview();
        }
    }

    public string WorldSizePreset
    {
        get => _worldSizePreset;
        set
        {
            if (!SetField(ref _worldSizePreset, value)) return;
            Size = value switch
            {
                "Petit (1024)" => 1024,
                "Grand (4096)" => 4096,
                "Géant (8192)" => 8192,
                _ => 2048
            };
        }
    }

    public int Size
    {
        get => _size;
        set
        {
            if (!SetField(ref _size, value)) return;
            OnPropertyChanged(nameof(SizeHint));
            RequestLivePreview();
        }
    }

    public string SizeHint => $"{Size} = {Size} blocs × {Size} blocs (1 pixel = 1 bloc Minecraft)";

    public int Seed
    {
        get => _seed;
        set
        {
            if (!SetField(ref _seed, value)) return;
            RequestLivePreview();
        }
    }

    public int SeaLevel
    {
        get => _seaLevel;
        set
        {
            if (!SetField(ref _seaLevel, value)) return;
            RequestLivePreview();
        }
    }

    public int MinY
    {
        get => _minY;
        set
        {
            if (!SetField(ref _minY, value)) return;
            RequestLivePreview();
        }
    }

    public int MaxY
    {
        get => _maxY;
        set
        {
            if (!SetField(ref _maxY, value)) return;
            RequestLivePreview();
        }
    }

    public int ReliefLevel
    {
        get => _reliefLevel;
        set
        {
            if (!SetField(ref _reliefLevel, Math.Clamp(value, 0, 5))) return;
            OnPropertyChanged(nameof(ReliefLabel));
            RequestLivePreview();
        }
    }

    public int MountainIntensity
    {
        get => _mountainIntensity;
        set
        {
            if (!SetField(ref _mountainIntensity, Math.Clamp(value, 0, 3))) return;
            OnPropertyChanged(nameof(MountainLabel));
            RequestLivePreview();
        }
    }

    public int OceanAmount
    {
        get => _oceanAmount;
        set
        {
            if (!SetField(ref _oceanAmount, Math.Clamp(value, 0, 2))) return;
            OnPropertyChanged(nameof(OceanLabel));
            RequestLivePreview();
        }
    }

    public bool RiversEnabled
    {
        get => _riversEnabled;
        set
        {
            if (!SetField(ref _riversEnabled, value)) return;
            RequestLivePreview();
        }
    }

    public int ErosionLevel
    {
        get => _erosionLevel;
        set
        {
            if (!SetField(ref _erosionLevel, Math.Clamp(value, 0, 3))) return;
            OnPropertyChanged(nameof(ErosionLabel));
            RequestLivePreview();
        }
    }

    public string ReliefLabel => new[] { "Très plat", "Doux", "Vanilla", "Vallonné", "Montagneux", "Extrême" }[ReliefLevel];
    public string MountainLabel => new[] { "Faible", "Moyenne", "Haute", "Épique" }[MountainIntensity];
    public string OceanLabel => new[] { "Peu", "Normal", "Beaucoup" }[OceanAmount];
    public string ErosionLabel => new[] { "Faible", "Minecraft", "Réaliste", "Très érodé" }[ErosionLevel];

    public int Octaves { get => _octaves; set { if (SetField(ref _octaves, value)) RequestLivePreview(); } }
    public int ErosionDroplets { get => _erosionDroplets; set { if (SetField(ref _erosionDroplets, value)) RequestLivePreview(); } }
    public int ErosionSteps { get => _erosionSteps; set { if (SetField(ref _erosionSteps, value)) RequestLivePreview(); } }
    public int ThermalIterations { get => _thermalIterations; set { if (SetField(ref _thermalIterations, value)) RequestLivePreview(); } }
    public float WindAngle { get => _windAngle; set { if (SetField(ref _windAngle, value)) RequestLivePreview(); } }

    public string OutputDirectory { get; set; } = string.Empty;
    public string FilePrefix { get; set; } = string.Empty;

    public bool IsExpertMode
    {
        get => _isExpertMode;
        set => SetField(ref _isExpertMode, value);
    }

    public string Status { get => _status; private set => SetField(ref _status, value); }
    public double ProgressValue { get => _progressValue; private set => SetField(ref _progressValue, value); }
    public Bitmap? PreviewImage { get => _previewImage; private set => SetField(ref _previewImage, value); }

    public bool IsGenerating
    {
        get => _isGenerating;
        private set
        {
            if (SetField(ref _isGenerating, value))
                RaiseCommandCanExecuteChanged();
        }
    }

    private async Task GenerateAsync()
    {
        var validation = Validate();
        if (validation is not null)
        {
            Status = validation;
            return;
        }

        IsGenerating = true;
        _cts = new CancellationTokenSource();

        try
        {
            var config = BuildConfig();
            var progress = new Progress<GenerationProgress>(p =>
            {
                ProgressValue = p.Percent * 100.0;
                Status = p.Message;
            });

            _lastResult = await Task.Run(() => _generator.Generate(config, progress, _cts.Token), _cts.Token);
            RaiseCommandCanExecuteChanged();

            PreviewImage?.Dispose();
            PreviewImage = _exportService.BuildPreviewBitmap(_lastResult.Height, _lastResult.Biomes, _lastResult.Size);
            Status = "Terminé. Exportez la map pour WorldPainter ou PNG.";
        }
        catch (OperationCanceledException)
        {
            Status = "Génération annulée.";
        }
        catch (Exception ex)
        {
            Status = $"Erreur: {ex.Message}";
        }
        finally
        {
            IsGenerating = false;
            ProgressValue = 0;
            _cts?.Dispose();
            _cts = null;
        }
    }

    private async Task ExportAsync()
    {
        if (_lastResult is null)
        {
            Status = "Aucune génération disponible. Cliquez d'abord sur Générer.";
            return;
        }

        var config = BuildConfig();
        try
        {
            var progress = new Progress<GenerationProgress>(p => Status = p.Message);
            await _exportService.ExportAsync(_lastResult, config, progress, CancellationToken.None);
            Status = $"Exports créés dans: {config.OutputDirectory}";
        }
        catch (Exception ex)
        {
            Status = $"Erreur export: {ex.Message}";
        }
    }

    private void Cancel() => _cts?.Cancel();

    private void RandomSeed()
    {
        Seed = Random.Shared.Next(1, int.MaxValue);
    }

    private GeneratorConfig BuildConfig(int? forcedSize = null) => new()
    {
        Size = forcedSize ?? Size,
        Seed = Seed,
        SeaLevel = SeaLevel,
        MinY = MinY,
        MaxY = MaxY,
        Octaves = Octaves,
        ErosionDroplets = ErosionDroplets,
        ErosionSteps = ErosionSteps,
        ThermalIterations = ThermalIterations,
        MoistureWindAngleDeg = WindAngle,
        TerrainScale = 0.72f + ReliefLevel * 0.16f,
        MountainScale = 0.75f + MountainIntensity * 0.28f,
        OceanCoverageBias = (OceanAmount - 1) * 0.06f,
        EnableRivers = RiversEnabled,
        ErosionScale = 0.7f + ErosionLevel * 0.2f,
        OutputDirectory = OutputDirectory,
        FilePrefix = string.IsNullOrWhiteSpace(FilePrefix) ? $"mc_{SelectedWorldType.Replace(' ', '_').ToLowerInvariant()}_s{Size}_seed{Seed}" : FilePrefix.Trim()
    };

    private string? Validate()
    {
        if (Size < 256 || Size > 8192) return "La taille doit être entre 256 et 8192.";
        if ((Size & (Size - 1)) != 0) return "La taille doit être une puissance de 2 (1024, 2048, 4096...).";
        if (SeaLevel < MinY || SeaLevel > MaxY) return "Le niveau de la mer doit rester entre altitude min et max.";
        if (Octaves < 1 || Octaves > 12) return "Les octaves doivent être entre 1 et 12.";
        if (ErosionDroplets < 0) return "Le nombre de gouttelettes doit être positif.";
        if (ErosionSteps < 1 || ThermalIterations < 0) return "Étapes/itérations invalides.";
        if (string.IsNullOrWhiteSpace(OutputDirectory)) return "Choisissez un dossier de sortie.";
        if (Path.GetInvalidPathChars().Any(OutputDirectory.Contains)) return "Le dossier de sortie contient des caractères invalides.";
        return null;
    }

    private void ApplyWorldTypePreset(string preset)
    {
        switch (preset)
        {
            case "Île": ReliefLevel = 2; MountainIntensity = 1; OceanAmount = 2; ErosionLevel = 1; RiversEnabled = true; break;
            case "Archipel": ReliefLevel = 2; MountainIntensity = 1; OceanAmount = 2; ErosionLevel = 2; RiversEnabled = true; break;
            case "Continent": ReliefLevel = 3; MountainIntensity = 2; OceanAmount = 0; ErosionLevel = 1; RiversEnabled = true; break;
            case "Monde Fantasy": ReliefLevel = 4; MountainIntensity = 3; OceanAmount = 1; ErosionLevel = 2; RiversEnabled = true; break;
            case "Montagnes": ReliefLevel = 4; MountainIntensity = 3; OceanAmount = 0; ErosionLevel = 1; RiversEnabled = true; break;
            case "Vallées": ReliefLevel = 3; MountainIntensity = 2; OceanAmount = 1; ErosionLevel = 3; RiversEnabled = true; break;
            case "Monde RP": ReliefLevel = 2; MountainIntensity = 1; OceanAmount = 1; ErosionLevel = 1; RiversEnabled = true; break;
            case "Japon / relief montagneux": ReliefLevel = 4; MountainIntensity = 3; OceanAmount = 2; ErosionLevel = 2; RiversEnabled = true; break;
            case "Plateau médiéval": ReliefLevel = 2; MountainIntensity = 1; OceanAmount = 0; ErosionLevel = 2; RiversEnabled = false; break;
            case "Monde réaliste": ReliefLevel = 3; MountainIntensity = 2; OceanAmount = 1; ErosionLevel = 2; RiversEnabled = true; break;
            case "Monde ultra montagneux": ReliefLevel = 5; MountainIntensity = 3; OceanAmount = 0; ErosionLevel = 1; RiversEnabled = true; break;
            default: ReliefLevel = 2; MountainIntensity = 1; OceanAmount = 1; ErosionLevel = 1; RiversEnabled = true; break;
        }

        SeaLevel = TerrainGenerator.SeaLevelY;
        MinY = TerrainGenerator.MinTerrainY;
        MaxY = TerrainGenerator.MaxTerrainY;
        Octaves = 7;
        ErosionDroplets = 220_000;
        ErosionSteps = 45;
        ThermalIterations = 14;
        WindAngle = 35f;
    }

    private void RequestLivePreview()
    {
        _ = GenerateLivePreviewAsync();
    }

    private async Task GenerateLivePreviewAsync()
    {
        if (_previewBusy || IsGenerating) return;

        _previewBusy = true;
        _previewCts?.Cancel();
        _previewCts = new CancellationTokenSource();
        var token = _previewCts.Token;

        try
        {
            await Task.Delay(250, token);
            var previewSize = Math.Min(Size, 1024);
            var previewConfig = BuildConfig(previewSize);
            var preview = await Task.Run(() => _generator.Generate(previewConfig, null, token), token);

            PreviewImage?.Dispose();
            PreviewImage = _exportService.BuildPreviewBitmap(preview.Height, preview.Biomes, preview.Size, 640);
            if (!IsGenerating)
                Status = "Aperçu mis à jour automatiquement.";
        }
        catch (OperationCanceledException)
        {
            // Ignored by design for rapid UI updates
        }
        catch
        {
            if (!IsGenerating)
                Status = "Aperçu indisponible avec ces paramètres.";
        }
        finally
        {
            _previewBusy = false;
        }
    }

    private void RaiseCommandCanExecuteChanged()
    {
        (GenerateCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
        (ExportCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
        (CancelCommand as RelayCommand)?.RaiseCanExecuteChanged();
    }

    private bool SetField<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value)) return false;
        field = value;
        OnPropertyChanged(propertyName);
        return true;
    }

    private void OnPropertyChanged([CallerMemberName] string? propertyName = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }

    private sealed class RelayCommand(Action execute, Func<bool>? canExecute = null) : ICommand
    {
        public event EventHandler? CanExecuteChanged;
        public bool CanExecute(object? parameter) => canExecute?.Invoke() ?? true;
        public void Execute(object? parameter) => execute();
        public void RaiseCanExecuteChanged() => CanExecuteChanged?.Invoke(this, EventArgs.Empty);
    }

    private sealed class AsyncRelayCommand(Func<Task> execute, Func<bool>? canExecute = null) : ICommand
    {
        public event EventHandler? CanExecuteChanged;
        public bool CanExecute(object? parameter) => canExecute?.Invoke() ?? true;
        public async void Execute(object? parameter) => await execute();
        public void RaiseCanExecuteChanged() => CanExecuteChanged?.Invoke(this, EventArgs.Empty);
    }
}
