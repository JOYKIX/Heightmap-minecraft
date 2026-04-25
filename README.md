# Heightmap Minecraft / WorldPainter Studio

Générateur avancé de topographie Minecraft 1.21 orienté **import WorldPainter**.

## Ce que fait ce projet

Le moteur génère une vraie carte d'altitude surface-only, organisée par **couches altitudinales Minecraft** puis convertie en grayscale exportable.

Pipeline appliqué (obligatoire) :

1. génération float
2. construction masse terrestre
3. attribution altitudinale
4. génération côtière
5. relief local
6. montagnes
7. vallées
8. rivières
9. érosion
10. quantification Minecraft
11. nettoyage
12. conversion grayscale
13. export

## Plage d'altitudes

- monde Minecraft 1.21 : **Y-64 → Y320**
- surface utile pour heightmap : **Y20 → Y260**
- sea level pivot : **Y63/Y64**

## Fonctionnalités principales

- UI moderne avec sections: Terrain, Sea Level, Surface Layers, Mountains, Rivers, Coast, Export.
- Couches altitudinales dédiées (abysses, océan, shelf, plages, plaines, collines, montagnes, pics).
- Génération de côtes crédibles (baies, caps, péninsules, falaises/plages).
- Montagnes ridged + massifs + vallées + rivières downhill.
- Nettoyage WorldPainter (anti micro-îles, anti-trous, anti-spikes incohérents).
- Visualisations: grayscale, hillshade, contour lines, slope view, altitude heatmap.
- Exports PNG 8-bit, PGM 16-bit, JSON preset.

## Lancer

Projet statique:

```bash
python3 -m http.server 8000
```

Puis ouvrir `http://localhost:8000`.
