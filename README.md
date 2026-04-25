# Heightmap Minecraft / WorldPainter Generator

Générateur de **vraies heightmaps Minecraft** (altitudes Y) avec export PNG grayscale fiable pour WorldPainter.

## Structure

```text
/index.html
/style.css
/script.js

/data/
  presets.js
  biome-profiles.js

/core/
  random.js
  noise.js
  terrain-engine.js
  landmass.js
  biomes.js
  coast.js
  rivers.js
  erosion.js
  cleanup.js
  worldpainter.js

/render/
  preview.js
  colors.js

/export/
  png-export.js
  json-export.js

/ui/
  ui.js
  controls.js
  stats.js

/workers/
  terrain-worker.js
```

## Principes absolus

- `height[x, y]` = altitude Minecraft Y (entier final).
- Conversion altitude → gray via:
  - `gray = round(((y - minY) / (maxY - minY)) * 255)`
- Export PNG toujours:
  - grayscale
  - R=G=B
  - A=255
  - 1 pixel = 1 bloc

## Pipeline

1. Lire config
2. Initialiser seed
3. Créer landPotential
4. Appliquer ocean border
5. Créer landMask
6. Nettoyer landMask
7. Calculer distanceToCoast / distanceToLand
8. Générer biomeMap
9. Générer baseHeight float
10. Appliquer relief par biome
11. Générer montagnes
12. Générer rivières
13. Appliquer érosion légère
14. Nettoyer heightmap
15. Quantifier en Y entier
16. Convertir en grayscale
17. Render preview
18. Export PNG

## Démarrage local

```bash
python3 -m http.server 8000
```

Puis ouvrir `http://localhost:8000`.

## WorldPainter settings recommandés

- Lowest Value = 0
- Water Level = 64
- Highest Value = 255
- Build limits = -64 / 320
