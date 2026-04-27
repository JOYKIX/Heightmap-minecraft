# Heightmap Minecraft (Avalonia / .NET 8)

Application desktop C# pour générer, prévisualiser et exporter des îles procédurales pour Minecraft.

## Stack technique

- .NET 8
- Avalonia UI (desktop)
- Architecture par couches (`Models`, `Core`, `Services`, `ViewModels`, `Views`)
- Export PNG 16-bit et previews via ImageSharp

## Fonctionnalités

- Génération d'île procédurale (seed déterministe)
- fBm multi-octaves + ridged noise + domain warping
- Masque d'île irrégulier
- Érosion hydraulique + thermique
- Carte d'humidité + biomes
- Prévisualisation instantanée dans l'application
- Export:
  - heightmap 16-bit PNG
  - preview grayscale PNG
  - preview biomes PNG
  - hauteurs en blocs Minecraft (CSV)
- Presets `Fast`, `Balanced`, `High Quality`
- Génération asynchrone avec progression et annulation

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

---

## Tutoriel rapide : lancer l'application en test

### 1) Prérequis

- Windows 10/11 (x64)
- [.NET SDK 8](https://dotnet.microsoft.com/download)

Vérifier l'installation:

```bash
dotnet --version
```

### 2) Restaurer les dépendances

```bash
dotnet restore
```

### 3) Compiler en debug

```bash
dotnet build -c Debug
```

### 4) Lancer l'application (mode test local)

```bash
dotnet run -c Debug
```

### 5) Tester un flux complet

1. Choisir un preset (par ex. `Balanced`).
2. Cliquer sur **Générer**.
3. Vérifier l'aperçu.
4. Cliquer sur **Sauvegarder / Exporter**.
5. Contrôler les fichiers exportés dans le dossier de sortie.

---

## Tutoriel build EXE Windows

### Option A — EXE autonome (recommandé pour distribuer)

```bash
dotnet publish -c Release -r win-x64 --self-contained true
```

Sortie:

`bin/Release/net8.0/win-x64/publish/`

Le fichier principal est:

`HeightmapMinecraft.exe`

### Option B — EXE framework-dependent (plus léger, nécessite .NET installé)

```bash
dotnet publish -c Release -r win-x64 --self-contained false
```

---

## Commandes de vérification utiles

```bash
dotnet clean
dotnet restore
dotnet build -c Release
dotnet run -c Debug
```

---

## Exports générés

Pour un préfixe `island_s1024_seed42`:

- `island_s1024_seed42_heightmap_16bit.png`
- `island_s1024_seed42_height_preview.png`
- `island_s1024_seed42_biomes_preview.png`
- `island_s1024_seed42_blocks.csv`

## Notes

- Le seed rend la génération reproductible.
- Les opérations lourdes tournent en arrière-plan (`Task.Run`) pour préserver la fluidité UI.
- La progression est détaillée étape par étape (bruit, warp, masque, érosion, biomes, export).
