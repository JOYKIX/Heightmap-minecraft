# Heightmap-minecraft

Générateur procédural d'île **ultra réaliste** pour Minecraft (heightmap 16-bit + aperçu biomes).

## Fonctionnalités

- Relief naturel avec bruit fractal (fBm), ridges et domain warping.
- Côtes irrégulières (masque radial bruité) pour éviter l'effet "île ronde".
- Érosion hydraulique (simulation de gouttelettes) + érosion thermique (talus).
- Carte d'humidité basée sur un vent dominant + aperçu des biomes.
- Export prêt à intégrer dans des pipelines de création de terrain.
- Interface graphique interactive (Tkinter) pour piloter tous les paramètres et voir un aperçu.

## Installation

```bash
python -m venv .venv
source .venv/bin/activate
pip install numpy pillow
```

## Utilisation

```bash
python island_generator.py --size 1024 --seed 1337 --sea-level 0.45 --max-height-blocks 320
```

### Mode interface graphique

```bash
python island_generator.py --gui
```

Depuis l'UI, vous pouvez:
- Modifier tous les paramètres de génération.
- Lancer la génération sans ligne de commande.
- Sauvegarder automatiquement les sorties avec un préfixe personnalisé.
- Visualiser un aperçu du relief/biomes directement dans la fenêtre.

Paramètres clés :

- `--size` : résolution carrée de la heightmap.
- `--seed` : seed procédural.
- `--sea-level` : niveau marin normalisé `[0..1]`.
- `--erosion-droplets` : qualité/temps de l'érosion hydraulique (plus = plus réaliste, plus lent).
- `--wind-angle` : direction dominante du vent pour l'humidité.
- `--gui` : ouvre l'interface graphique.
- `--output-prefix` : impose un préfixe de sortie (mode CLI).

## Fichiers générés

Pour un exemple `--size 1024 --seed 1337`:

- `island_s1024_seed1337_heightmap_16bit.png` (si Pillow est installé)
- `island_s1024_seed1337_height_preview.png` (si Pillow est installé)
- `island_s1024_seed1337_biomes_preview.png` (si Pillow est installé)
- `island_s1024_seed1337_heightmap.npy`
- `island_s1024_seed1337_blocks.npy`

## Notes perf

- Le mode par défaut privilégie la qualité visuelle.
- Pour des tests rapides, baissez `--erosion-droplets` (ex: `40000`) et `--size` (ex: `512`).
