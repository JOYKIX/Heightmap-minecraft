# Heightmap Minecraft / WorldPainter Studio

Générateur avancé de topographie Minecraft orienté **import WorldPainter**.

## Ce que fait ce projet

Le moteur génère une vraie carte d'altitude pensée en couches Minecraft (Y), puis la convertit pour export PNG :

1. float map de base
2. continents / îles procédurales
3. relief multi-couches
4. montagnes ridged multifractal
5. vallées
6. rivières (downhill tracing)
7. côtes / plages / falaises
8. érosion simplifiée
9. conversion Y Minecraft
10. cleanup anti-artefacts
11. quantification par couches
12. conversion grayscale
13. export WorldPainter

## Logique Minecraft par défaut

- sea level: **Y64**
- plage: **Y62-68**
- plaines: **Y68-85**
- collines: **Y85-120**
- montagnes: **Y120-200**
- pics: **Y200-255**

## Fonctionnalités principales

- UI pro dark mode à 3 panneaux (contrôles / preview / statistiques).
- Presets avancés (Realistic Island, Alpine Region, WorldPainter Optimized, etc.).
- Preview multi-modes: grayscale, terrain color, hillshade, contours, eau, biome.
- Mode **WorldPainter Safe**: suppression micro-îles et trous, stabilisation autour du sea level, réduction d'artefacts.
- Export:
  - PNG grayscale WorldPainter
  - JSON preset
  - RAW16 JSON (pour workflows 16-bit externes)

## Lancer

Projet statique:

```bash
python3 -m http.server 8000
```

Puis ouvrir `http://localhost:8000`.
