using Avalonia.Controls;
using Avalonia.Interactivity;
using HeightmapMinecraft.ViewModels;

namespace HeightmapMinecraft.Views;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }

    private void PresetCombo_OnSelectionChanged(object? sender, SelectionChangedEventArgs e)
    {
        if (DataContext is not MainWindowViewModel vm || sender is not ComboBox combo) return;
        var label = (combo.SelectedItem as ComboBoxItem)?.Content?.ToString() ?? "Balanced";
        vm.ApplyPreset(label);
    }
}
