#!/usr/bin/env python3
"""
Générateur procédural d'île "ultra réaliste" pour heightmaps Minecraft.

Principes utilisés:
- Bruit fractal multi-octaves (fBm) + ridged noise
- Domain warping pour éviter les motifs répétitifs
- Masque insulaire radial irrégulier (côtes naturelles)
- Erosion hydraulique (gouttelettes simplifiées)
- Erosion thermique (talus)
- Carte d'humidité + biomes

Sorties:
- heightmap_16bit.png (si Pillow est installé)
- heightmap.npy
- preview_biomes.png (si Pillow est installé)
"""

from __future__ import annotations

import argparse
import math
from dataclasses import dataclass
from typing import Tuple

import numpy as np

try:
    from PIL import Image
except Exception:
    Image = None


@dataclass
class GeneratorConfig:
    size: int = 1024
    seed: int = 42
    sea_level: float = 0.45
    max_height_blocks: int = 320
    octaves: int = 7
    erosion_droplets: int = 220_000
    erosion_steps: int = 45
    thermal_iterations: int = 14
    moisture_wind_angle_deg: float = 35.0


def _fade(t: np.ndarray) -> np.ndarray:
    return t * t * (3.0 - 2.0 * t)


def value_noise_2d(size: int, frequency: float, seed: int) -> np.ndarray:
    """Bruit de valeur bilinéaire en [0,1]."""
    grid = int(math.ceil(size * frequency)) + 3
    rng = np.random.default_rng(seed)
    lattice = rng.random((grid, grid), dtype=np.float32)

    xs = np.linspace(0, size * frequency, size, endpoint=False, dtype=np.float32)
    ys = np.linspace(0, size * frequency, size, endpoint=False, dtype=np.float32)
    x0 = np.floor(xs).astype(np.int32)
    y0 = np.floor(ys).astype(np.int32)
    tx = _fade(xs - x0)
    ty = _fade(ys - y0)

    x1 = x0 + 1
    y1 = y0 + 1

    v00 = lattice[np.ix_(y0, x0)]
    v10 = lattice[np.ix_(y0, x1)]
    v01 = lattice[np.ix_(y1, x0)]
    v11 = lattice[np.ix_(y1, x1)]

    a = v00 * (1.0 - tx)[None, :] + v10 * tx[None, :]
    b = v01 * (1.0 - tx)[None, :] + v11 * tx[None, :]
    return a * (1.0 - ty)[:, None] + b * ty[:, None]


def fbm(size: int, base_freq: float, octaves: int, lacunarity: float, gain: float, seed: int) -> np.ndarray:
    out = np.zeros((size, size), dtype=np.float32)
    amp = 1.0
    freq = base_freq
    amp_sum = 0.0
    for i in range(octaves):
        out += amp * (value_noise_2d(size, freq, seed + i * 101) * 2.0 - 1.0)
        amp_sum += amp
        amp *= gain
        freq *= lacunarity
    out /= amp_sum
    return (out + 1.0) * 0.5


def ridged_noise(size: int, base_freq: float, octaves: int, seed: int) -> np.ndarray:
    n = fbm(size, base_freq, octaves, lacunarity=2.0, gain=0.56, seed=seed)
    r = 1.0 - np.abs(2.0 * n - 1.0)
    return np.clip(r, 0.0, 1.0)


def domain_warp(size: int, src: np.ndarray, warp_strength: float, seed: int) -> np.ndarray:
    """Déforme la carte via 2 champs de bruit pour casser les répétitions."""
    dx = fbm(size, 0.004, 4, 2.15, 0.58, seed=seed) * 2.0 - 1.0
    dy = fbm(size, 0.004, 4, 2.15, 0.58, seed=seed + 991) * 2.0 - 1.0

    yy, xx = np.indices(src.shape)
    sx = np.clip((xx + dx * warp_strength).astype(np.int32), 0, size - 1)
    sy = np.clip((yy + dy * warp_strength).astype(np.int32), 0, size - 1)
    return src[sy, sx]


def island_mask(size: int, seed: int) -> np.ndarray:
    """Masque radial irrégulier pour créer une silhouette d'île naturelle."""
    yy, xx = np.indices((size, size), dtype=np.float32)
    cx = (size - 1) * 0.5
    cy = (size - 1) * 0.5
    nx = (xx - cx) / (size * 0.5)
    ny = (yy - cy) / (size * 0.5)
    r = np.sqrt(nx * nx + ny * ny)

    angle = np.arctan2(ny, nx)
    angular_variation = (
        0.08 * np.sin(3.0 * angle + 0.5)
        + 0.06 * np.sin(5.0 * angle + 1.7)
        + 0.04 * np.sin(9.0 * angle + 2.2)
    )
    coast_noise = fbm(size, 0.015, 4, 2.25, 0.55, seed=seed) * 0.17

    effective_r = r + angular_variation + coast_noise
    core = 1.0 - effective_r
    return np.clip(core, 0.0, 1.0) ** 1.25


def gaussian_blur5(arr: np.ndarray, iterations: int = 1) -> np.ndarray:
    """Blur léger sans SciPy (kernel [1,4,6,4,1])."""
    out = arr.copy()
    for _ in range(iterations):
        p = np.pad(out, ((0, 0), (2, 2)), mode="edge")
        out = (
            p[:, 0:-4]
            + 4.0 * p[:, 1:-3]
            + 6.0 * p[:, 2:-2]
            + 4.0 * p[:, 3:-1]
            + p[:, 4:]
        ) / 16.0
        p = np.pad(out, ((2, 2), (0, 0)), mode="edge")
        out = (
            p[0:-4, :]
            + 4.0 * p[1:-3, :]
            + 6.0 * p[2:-2, :]
            + 4.0 * p[3:-1, :]
            + p[4:, :]
        ) / 16.0
    return out


def estimate_gradient(height: np.ndarray, x: int, y: int) -> Tuple[float, float]:
    h = height
    xm = max(x - 1, 0)
    xp = min(x + 1, h.shape[1] - 1)
    ym = max(y - 1, 0)
    yp = min(y + 1, h.shape[0] - 1)
    gx = (h[y, xp] - h[y, xm]) * 0.5
    gy = (h[yp, x] - h[ym, x]) * 0.5
    return gx, gy


def hydraulic_erosion(height: np.ndarray, droplets: int, max_steps: int, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    h = height.copy()
    size = h.shape[0]

    inertia = 0.12
    capacity_factor = 4.0
    deposition = 0.28
    erosion = 0.34
    evaporation = 0.018
    gravity = 3.8

    for _ in range(droplets):
        x = rng.uniform(1, size - 2)
        y = rng.uniform(1, size - 2)
        dx = 0.0
        dy = 0.0
        speed = 1.0
        water = 1.0
        sediment = 0.0

        for _step in range(max_steps):
            ix = int(x)
            iy = int(y)
            if ix <= 1 or iy <= 1 or ix >= size - 2 or iy >= size - 2:
                break

            gx, gy = estimate_gradient(h, ix, iy)
            dx = dx * inertia - gx * (1.0 - inertia)
            dy = dy * inertia - gy * (1.0 - inertia)
            norm = math.hypot(dx, dy)
            if norm < 1e-8:
                dx = rng.uniform(-1, 1)
                dy = rng.uniform(-1, 1)
                norm = math.hypot(dx, dy)
            dx /= norm
            dy /= norm

            nx = x + dx
            ny = y + dy
            nix = int(nx)
            niy = int(ny)
            if nix <= 1 or niy <= 1 or nix >= size - 2 or niy >= size - 2:
                break

            h_cur = h[iy, ix]
            h_nxt = h[niy, nix]
            dh = h_nxt - h_cur

            capacity = max(-dh * speed * water * capacity_factor, 0.001)
            if sediment > capacity or dh > 0.0:
                deposit = (sediment - capacity) * deposition if dh <= 0.0 else min(sediment, dh)
                sediment -= deposit
                h[iy, ix] += deposit
            else:
                erode_amount = min((capacity - sediment) * erosion, h[iy, ix])
                sediment += erode_amount
                h[iy, ix] -= erode_amount

            speed = math.sqrt(max(0.0, speed * speed + dh * gravity))
            water *= 1.0 - evaporation
            x, y = nx, ny
            if water < 0.02:
                break

    h = gaussian_blur5(h, iterations=1)
    return np.clip(h, 0.0, 1.0)


def thermal_erosion(height: np.ndarray, iterations: int, talus: float = 0.025) -> np.ndarray:
    h = height.copy()
    for _ in range(iterations):
        north = np.roll(h, -1, axis=0)
        south = np.roll(h, 1, axis=0)
        east = np.roll(h, -1, axis=1)
        west = np.roll(h, 1, axis=1)

        dn = h - north
        ds = h - south
        de = h - east
        dw = h - west

        move_n = np.where(dn > talus, (dn - talus) * 0.15, 0.0)
        move_s = np.where(ds > talus, (ds - talus) * 0.15, 0.0)
        move_e = np.where(de > talus, (de - talus) * 0.15, 0.0)
        move_w = np.where(dw > talus, (dw - talus) * 0.15, 0.0)

        h -= (move_n + move_s + move_e + move_w)
        h += np.roll(move_n, 1, axis=0)
        h += np.roll(move_s, -1, axis=0)
        h += np.roll(move_e, 1, axis=1)
        h += np.roll(move_w, -1, axis=1)

        h = np.clip(h, 0.0, 1.0)
    return h


def moisture_map(height: np.ndarray, sea_level: float, wind_angle_deg: float, seed: int) -> np.ndarray:
    size = height.shape[0]
    wind = np.array([math.cos(math.radians(wind_angle_deg)), math.sin(math.radians(wind_angle_deg))], dtype=np.float32)

    moist = np.zeros_like(height, dtype=np.float32)
    base = fbm(size, 0.009, 4, 2.1, 0.6, seed=seed)

    yy, xx = np.indices(height.shape)
    coast = (height <= sea_level + 0.02).astype(np.float32)

    for _ in range(50):
        src_x = np.clip((xx - wind[0]).astype(np.int32), 0, size - 1)
        src_y = np.clip((yy - wind[1]).astype(np.int32), 0, size - 1)
        moist = 0.92 * moist[src_y, src_x] + 0.08 * coast
        lift = np.maximum(height - moist, 0.0)
        moist *= np.exp(-2.8 * lift)

    moist = 0.65 * moist + 0.35 * base
    return np.clip(moist, 0.0, 1.0)


def biome_map(height: np.ndarray, moisture: np.ndarray, sea_level: float) -> np.ndarray:
    out = np.zeros((*height.shape, 3), dtype=np.uint8)

    ocean = height < sea_level
    beach = (height >= sea_level) & (height < sea_level + 0.02)
    alpine = height > 0.78
    mountain = (height > 0.66) & ~alpine

    desert = (moisture < 0.28) & (height > sea_level + 0.02) & ~mountain & ~alpine
    grass = (moisture >= 0.28) & (moisture < 0.55) & (height > sea_level + 0.02) & ~mountain & ~alpine
    forest = (moisture >= 0.55) & (height > sea_level + 0.02) & ~mountain & ~alpine

    out[ocean] = np.array([20, 70, 160], dtype=np.uint8)
    out[beach] = np.array([230, 214, 160], dtype=np.uint8)
    out[desert] = np.array([222, 196, 110], dtype=np.uint8)
    out[grass] = np.array([98, 160, 82], dtype=np.uint8)
    out[forest] = np.array([45, 120, 62], dtype=np.uint8)
    out[mountain] = np.array([110, 110, 110], dtype=np.uint8)
    out[alpine] = np.array([238, 238, 238], dtype=np.uint8)

    return out


def generate_island(cfg: GeneratorConfig) -> Tuple[np.ndarray, np.ndarray]:
    size = cfg.size

    base = fbm(size, 0.0024, cfg.octaves, lacunarity=2.1, gain=0.55, seed=cfg.seed)
    ridges = ridged_noise(size, 0.0034, cfg.octaves - 1, seed=cfg.seed + 177)
    detail = fbm(size, 0.008, 4, 2.15, 0.55, seed=cfg.seed + 333)

    terrain = 0.54 * base + 0.31 * ridges + 0.15 * detail
    terrain = domain_warp(size, terrain, warp_strength=size * 0.032, seed=cfg.seed + 999)

    mask = island_mask(size, seed=cfg.seed + 444)
    terrain = terrain * mask

    shelves = fbm(size, 0.01, 3, 2.1, 0.6, seed=cfg.seed + 555)
    terrain = np.where(mask < 0.2, terrain * (0.8 + 0.2 * shelves), terrain)

    terrain = gaussian_blur5(np.clip(terrain, 0.0, 1.0), iterations=1)

    terrain = hydraulic_erosion(
        terrain,
        droplets=cfg.erosion_droplets,
        max_steps=cfg.erosion_steps,
        seed=cfg.seed + 666,
    )
    terrain = thermal_erosion(terrain, iterations=cfg.thermal_iterations)

    terrain = terrain - terrain.min()
    terrain = terrain / (terrain.max() + 1e-8)

    gamma = 1.14
    terrain = terrain**gamma

    moisture = moisture_map(terrain, cfg.sea_level, cfg.moisture_wind_angle_deg, seed=cfg.seed + 777)
    return np.clip(terrain, 0.0, 1.0), moisture


def save_outputs(height: np.ndarray, moisture: np.ndarray, cfg: GeneratorConfig, prefix: str) -> None:
    np.save(f"{prefix}_heightmap.npy", height.astype(np.float32))

    h16 = np.clip(height * 65535.0, 0, 65535).astype(np.uint16)
    if Image is not None:
        Image.fromarray(h16, mode="I;16").save(f"{prefix}_heightmap_16bit.png")

        preview = (np.clip(height, 0.0, 1.0) * 255).astype(np.uint8)
        Image.fromarray(preview, mode="L").save(f"{prefix}_height_preview.png")

        biomes = biome_map(height, moisture, cfg.sea_level)
        Image.fromarray(biomes, mode="RGB").save(f"{prefix}_biomes_preview.png")
    else:
        print("[WARN] Pillow non installé: PNG non générés, seulement le .npy")

    block_heights = np.round(height * cfg.max_height_blocks).astype(np.int32)
    np.save(f"{prefix}_blocks.npy", block_heights)


def parse_args() -> GeneratorConfig:
    p = argparse.ArgumentParser(description="Générateur procédural d'île ultra réaliste")
    p.add_argument("--size", type=int, default=1024, help="Résolution carrée de la heightmap")
    p.add_argument("--seed", type=int, default=42, help="Seed aléatoire")
    p.add_argument("--sea-level", type=float, default=0.45, help="Niveau marin normalisé [0..1]")
    p.add_argument("--max-height-blocks", type=int, default=320, help="Hauteur max en blocs Minecraft")
    p.add_argument("--octaves", type=int, default=7, help="Nombre d'octaves du bruit")
    p.add_argument("--erosion-droplets", type=int, default=220_000, help="Nombre de gouttelettes d'érosion")
    p.add_argument("--erosion-steps", type=int, default=45, help="Pas max par gouttelette")
    p.add_argument("--thermal-iterations", type=int, default=14, help="Itérations d'érosion thermique")
    p.add_argument("--wind-angle", type=float, default=35.0, help="Angle du vent (humidité) en degrés")
    args = p.parse_args()

    return GeneratorConfig(
        size=args.size,
        seed=args.seed,
        sea_level=args.sea_level,
        max_height_blocks=args.max_height_blocks,
        octaves=args.octaves,
        erosion_droplets=args.erosion_droplets,
        erosion_steps=args.erosion_steps,
        thermal_iterations=args.thermal_iterations,
        moisture_wind_angle_deg=args.wind_angle,
    )


def main() -> None:
    cfg = parse_args()
    height, moisture = generate_island(cfg)
    prefix = f"island_s{cfg.size}_seed{cfg.seed}"
    save_outputs(height, moisture, cfg, prefix)
    print(f"Génération terminée: {prefix}_heightmap_16bit.png / {prefix}_heightmap.npy")


if __name__ == "__main__":
    main()
