# Heightmap Minecraft (Avalonia / .NET 8)

Application desktop C# moderne pour générer, prévisualiser et exporter des îles procédurales pour Minecraft.

## Stack technique

- .NET 8
- Avalonia UI (desktop)
- Architecture séparée par couche (`Models`, `Core`, `Services`, `ViewModels`, `Views`)
- Export PNG 16-bit via ImageSharp

## Fonctionnalités

- Génération d'île procédurale
- Bruit fBm multi-octaves
- Ridged noise
- Domain warping
- Masque radial irrégulier
- Érosion hydraulique simplifiée
- Érosion thermique
- Carte d'humidité
- Carte de biomes
- Export heightmap 16-bit PNG
- Export preview grayscale PNG
- Export preview biomes PNG
- Export tableau des hauteurs en blocs Minecraft (CSV)
- Presets `Fast`, `Balanced`, `High Quality`
- Génération asynchrone avec progression détaillée et annulation

## Structure

- `Models/GeneratorConfig.cs`
- `Core/Noise.cs`
- `Core/TerrainGenerator.cs`
- `Core/Erosion.cs`
- `Core/BiomeGenerator.cs`
- `Services/ImageExportService.cs`
- `ViewModels/MainWindowViewModel.cs`
- `Views/MainWindow.axaml`
- `Program.cs`
- `App.axaml`

## Installation et exécution

```bash
dotnet restore
dotnet run
```

### Build release (EXE Windows self-contained)

```bash
dotnet publish -c Release -r win-x64 --self-contained true
```

Le binaire sera généré dans:

`bin/Release/net8.0/win-x64/publish/`

## Utilisation

1. Lancer l'application.
2. Choisir un preset (ou ajuster tous les paramètres).
3. Cliquer sur **Générer**.
4. Vérifier l'aperçu rapide.
5. Cliquer sur **Sauvegarder / Exporter**.

## Exports générés

Pour un préfixe `island_s1024_seed42`:

- `island_s1024_seed42_heightmap_16bit.png`
- `island_s1024_seed42_height_preview.png`
- `island_s1024_seed42_biomes_preview.png`
- `island_s1024_seed42_blocks.csv`

## Notes

- La génération est déterministe grâce au `seed`.
- Les opérations lourdes tournent en arrière-plan (`Task.Run`) pour garder l'UI fluide.
- La progression est reportée étape par étape: bruit de base, domain warp, masque île, érosion hydraulique, érosion thermique, humidité, biomes, export.
