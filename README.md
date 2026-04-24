# Heightmap-minecraft

Petit site statique pour générer des **heightmaps Minecraft** avec la règle:

- **1 pixel = 1 bloc IG**.

## Fonctionnalités

- Génération d'îles via combinaison de bruit procédural + masque radial (continent au centre, océan en bord).
- Paramètres configurables:
  - `% de terres (plein)`
  - `% d'océan`
  - `% de rivière (intensité)`
  - largeur/hauteur en blocs
  - seed
- Export en PNG utilisable comme heightmap.

## Lancer le site

Comme c'est un site statique, il suffit d'ouvrir `index.html` dans le navigateur.

Optionnellement, avec un serveur local:

```bash
python3 -m http.server 8000
```

Puis ouvrir `http://localhost:8000`.
