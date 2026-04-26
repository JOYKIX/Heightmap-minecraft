# Heightmap Minecraft / WorldPainter Generator

Générateur de **heightmaps Minecraft Y** avec export **PNG grayscale 16-bit** compatible WorldPainter.

## Démarrage local

```bash
python3 -m http.server 8000
```

Puis ouvrir `http://localhost:8000/#/procedural`.

## Procedural Generator (UI simplifiée)

Paramètres exposés :
- Map Size: 512 / 1024 / 2048
- Island Size: petite / moyenne / grande / immense
- Relief: doux / normal / montagneux / extrême
- Style: équilibré / archipel / montagneux / côtier dramatique
- Seed

## Pipeline terrain

1. Squelette d’île
2. Application island size
3. Forme organique (domain warp + fbm)
4. Génération des côtes
5. Distance to coast
6. Océan + fonds marins
7. Altitude de base
8. Macro relief
9. Chaînes montagneuses
10. Collines/plateaux
11. Vallées
12. Rivières
13. Érosion
14. Nettoyage artefacts
15. Quantification en Y Minecraft
16. Conversion gray16

## Conversion WorldPainter

- `minY = -64`
- `seaLevel = 64`
- `maxY = 319`
- `gray16 = round(((Y - minY) / (maxY - minY)) * 65535)`
- Export unique : PNG 16-bit grayscale (1 pixel = 1 bloc)
