export const BIOME_PROFILES = {
  ocean: { id: 'ocean', name: 'Ocean', minAltitude: 20, maxAltitude: 63, preferredAltitude: 45, roughness: 0.1, flatness: 0.9, mountainInfluence: 0, riverAffinity: 0, coastAffinity: 1, erosionStrength: 0.1 },
  coast: { id: 'coast', name: 'Coast', minAltitude: 62, maxAltitude: 69, preferredAltitude: 66, roughness: 0.2, flatness: 0.7, mountainInfluence: 0.1, riverAffinity: 0.5, coastAffinity: 1, erosionStrength: 0.25 },
  plains: { id: 'plains', name: 'Plains', minAltitude: 70, maxAltitude: 95, preferredAltitude: 82, roughness: 0.2, flatness: 0.85, mountainInfluence: 0.15, riverAffinity: 0.45, coastAffinity: 0.3, erosionStrength: 0.35 },
  hills: { id: 'hills', name: 'Hills', minAltitude: 85, maxAltitude: 120, preferredAltitude: 100, roughness: 0.45, flatness: 0.35, mountainInfluence: 0.35, riverAffinity: 0.5, coastAffinity: 0.2, erosionStrength: 0.45 },
  mountains: { id: 'mountains', name: 'Mountains', minAltitude: 130, maxAltitude: 240, preferredAltitude: 175, roughness: 0.75, flatness: 0.1, mountainInfluence: 1, riverAffinity: 0.35, coastAffinity: 0.05, erosionStrength: 0.5 },
  plateau: { id: 'plateau', name: 'Plateau', minAltitude: 110, maxAltitude: 160, preferredAltitude: 135, roughness: 0.35, flatness: 0.65, mountainInfluence: 0.45, riverAffinity: 0.25, coastAffinity: 0.1, erosionStrength: 0.4 },
  canyon: { id: 'canyon', name: 'Canyon', minAltitude: 70, maxAltitude: 150, preferredAltitude: 100, roughness: 0.65, flatness: 0.25, mountainInfluence: 0.5, riverAffinity: 0.35, coastAffinity: 0.1, erosionStrength: 0.3 },
  swamp: { id: 'swamp', name: 'Swamp', minAltitude: 62, maxAltitude: 72, preferredAltitude: 67, roughness: 0.1, flatness: 0.95, mountainInfluence: 0, riverAffinity: 0.95, coastAffinity: 0.5, erosionStrength: 0.2 },
  forest: { id: 'forest', name: 'Forest', minAltitude: 70, maxAltitude: 110, preferredAltitude: 90, roughness: 0.3, flatness: 0.65, mountainInfluence: 0.2, riverAffinity: 0.55, coastAffinity: 0.2, erosionStrength: 0.4 },
  jungle: { id: 'jungle', name: 'Jungle', minAltitude: 70, maxAltitude: 120, preferredAltitude: 92, roughness: 0.35, flatness: 0.55, mountainInfluence: 0.2, riverAffinity: 0.85, coastAffinity: 0.35, erosionStrength: 0.45 },
  desert: { id: 'desert', name: 'Desert', minAltitude: 65, maxAltitude: 105, preferredAltitude: 82, roughness: 0.25, flatness: 0.7, mountainInfluence: 0.12, riverAffinity: 0.08, coastAffinity: 0.15, erosionStrength: 0.15 },
  tundra: { id: 'tundra', name: 'Tundra', minAltitude: 90, maxAltitude: 170, preferredAltitude: 128, roughness: 0.4, flatness: 0.5, mountainInfluence: 0.4, riverAffinity: 0.3, coastAffinity: 0.08, erosionStrength: 0.35 }
};
