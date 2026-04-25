# Heightmap Minecraft Studio

Refonte complète vers une architecture modulaire maintenable.

## Architecture

```text
/src
  /core      -> moteurs de génération (pipeline, biomes, rivières, érosion...)
  /workers   -> worker léger qui orchestre la génération
  /ui        -> contrôles et panneaux UI
  /utils     -> primitives techniques (math, noise, arrays, profiler)
  /config    -> presets + constantes + settings centralisés
  /render    -> renderers preview spécialisés
  /styles    -> CSS découpé (variables/layout/components)
main.js      -> bootstrap et coordination app/worker
index.html   -> shell UI
```

## Pipeline

`generateTerrain(config)` exécute explicitement:

1. landMask
2. baseHeight
3. biome attribution
4. mountain shaping
5. river carving
6. erosion
7. quantization
8. export preview

## Démarrage

```bash
python3 -m http.server 8000
```

Puis ouvrir `http://localhost:8000`.
