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
    private GenerationResult? _lastResult;
    private bool _isGenerating;
    private string _status = "Prêt";
    private double _progressValue;
    private Bitmap? _previewImage;

    public event PropertyChangedEventHandler? PropertyChanged;

    public MainWindowViewModel()
    {
        GenerateCommand = new AsyncRelayCommand(GenerateAsync, () => !IsGenerating);
        ExportCommand = new AsyncRelayCommand(ExportAsync, () => _lastResult is not null && !IsGenerating);
        CancelCommand = new RelayCommand(Cancel, () => IsGenerating);
        ApplyPreset("Balanced");
        OutputDirectory = Environment.CurrentDirectory;
        FilePrefix = "island";
    }

    public ICommand GenerateCommand { get; }
    public ICommand ExportCommand { get; }
    public ICommand CancelCommand { get; }

    public int Size { get; set; }
    public int Seed { get; set; }
    public float SeaLevel { get; set; }
    public int MaxHeightBlocks { get; set; }
    public int Octaves { get; set; }
    public int ErosionDroplets { get; set; }
    public int ErosionSteps { get; set; }
    public int ThermalIterations { get; set; }
    public float WindAngle { get; set; }
    public string OutputDirectory { get; set; } = string.Empty;
    public string FilePrefix { get; set; } = string.Empty;

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

    public void ApplyPreset(string preset)
    {
        switch (preset)
        {
            case "Fast":
                Size = 512; Octaves = 5; ErosionDroplets = 40_000; ErosionSteps = 30; ThermalIterations = 8; break;
            case "High Quality":
                Size = 1536; Octaves = 8; ErosionDroplets = 320_000; ErosionSteps = 55; ThermalIterations = 20; break;
            default:
                Size = 1024; Octaves = 7; ErosionDroplets = 220_000; ErosionSteps = 45; ThermalIterations = 14; break;
        }

        Seed = 42;
        SeaLevel = 0.45f;
        MaxHeightBlocks = 320;
        WindAngle = 35f;
        NotifyAllInputs();
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
            Status = "Terminé. Cliquez sur Exporter pour sauvegarder les fichiers.";
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

    private GeneratorConfig BuildConfig() => new()
    {
        Size = Size,
        Seed = Seed,
        SeaLevel = SeaLevel,
        MaxHeightBlocks = MaxHeightBlocks,
        Octaves = Octaves,
        ErosionDroplets = ErosionDroplets,
        ErosionSteps = ErosionSteps,
        ThermalIterations = ThermalIterations,
        MoistureWindAngleDeg = WindAngle,
        OutputDirectory = OutputDirectory,
        FilePrefix = string.IsNullOrWhiteSpace(FilePrefix) ? $"island_s{Size}_seed{Seed}" : FilePrefix.Trim()
    };

    private string? Validate()
    {
        if (Size < 128 || Size > 4096) return "La taille doit être entre 128 et 4096.";
        if ((Size & (Size - 1)) != 0) return "La taille doit être une puissance de 2 (512, 1024, 2048...).";
        if (SeaLevel is < 0 or > 1) return "Le niveau de la mer doit être entre 0 et 1.";
        if (Octaves < 1 || Octaves > 12) return "Les octaves doivent être entre 1 et 12.";
        if (ErosionDroplets < 0) return "Le nombre de gouttelettes doit être positif.";
        if (ErosionSteps < 1 || ThermalIterations < 0) return "Étapes/itérations invalides.";
        if (string.IsNullOrWhiteSpace(OutputDirectory)) return "Choisissez un dossier de sortie.";
        if (Path.GetInvalidPathChars().Any(OutputDirectory.Contains)) return "Le dossier de sortie contient des caractères invalides.";
        return null;
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
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        return true;
    }

    private void NotifyAllInputs()
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(string.Empty));
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
