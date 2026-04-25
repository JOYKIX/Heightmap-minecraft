# Heightmap Minecraft / WorldPainter Studio

Générateur avancé de topographie Minecraft 1.21 orienté **import WorldPainter**.

## Ce que fait ce projet

Le moteur génère une vraie carte d'altitude surface-only, organisée par **couches altitudinales Minecraft** puis convertie en grayscale exportable.

Pipeline appliqué (obligatoire) :

1. génération de masse terrestre (asymétrique + fracturation côtière)
2. altitudes principales (macro/meso/micro relief)
3. couches altitudinales Minecraft
4. chaînes montagneuses (ridged + logique tectonique)
5. vallées cohérentes (convergence + drainage)
6. rivières downhill jusqu'à la mer
7. érosion (hydraulique + thermique + pente)
8. détails locaux contextuels
9. nettoyage anti-artefacts + WorldPainter safe
10. quantification entière Minecraft
11. conversion grayscale exportable

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
