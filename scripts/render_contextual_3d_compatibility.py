#!/usr/bin/env python3
"""Renderiza una vista 3D contextual de compatibilidad del gemelo turístico.

Representa el mismo contenido operativo que el visor WebGL (malla urbana,
aforo, sensores y rutas) para equipos en los que el contexto WebGL falla.
No sustituye a un tileset LiDAR interactivo.
"""
from __future__ import annotations

from pathlib import Path
import math
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

OUT = Path("public/visor-3d-contextual-compatibilidad.png")


def seeded(row: int, col: int, offset: int = 0) -> float:
    value = math.sin((row + offset) * 12.9898 + (col - offset) * 78.233) * 43758.5453
    return value - math.floor(value)


def main() -> None:
    fig = plt.figure(figsize=(16, 9), dpi=120, facecolor="#eef7f9")
    ax = fig.add_subplot(111, projection="3d")
    ax.set_facecolor("#eef7f9")

    # Lámina de agua/litoral y ejes de movilidad.
    ax.plot_surface(
        np.array([[-75, 75], [-75, 75]]),
        np.array([[-72, -72], [-49, -49]]),
        np.array([[-0.5, -0.5], [-0.5, -0.5]]),
        color="#88d3ef", alpha=0.88, shade=False
    )
    for row in range(-5, 6):
        ax.plot([-64, 64], [row * 10, row * 10], [0, 0], color="#c5d4df", linewidth=2.2, alpha=0.95)
    for col in range(-6, 7):
        ax.plot([col * 9, col * 9], [-54, 54], [0, 0], color="#c5d4df", linewidth=2.2, alpha=0.95)

    # Edificación urbana isométrica con cubiertas diferenciadas.
    for row in range(-5, 6):
        for col in range(-6, 7):
            seed = seeded(row, col, 3)
            if seed < 0.18 or (row < -3 and col % 3 == 0):
                continue
            width = 3.9 + seeded(row, col, 7) * 3.0
            depth = 3.9 + seeded(col, row, 11) * 3.0
            height = 4.0 + seed * 25
            x = col * 9 + (seeded(row, col, 16) - 0.5) * 1.1 - width / 2
            y = row * 10 + (seeded(col, row, 21) - 0.5) * 1.1 - depth / 2
            ax.bar3d(x, y, 0, width, depth, height, color="#d7e1e8", edgecolor="#aebfcd", linewidth=0.14, shade=True, alpha=1)
            ax.bar3d(x + width * 0.08, y + depth * 0.08, height, width * 0.84, depth * 0.84, 0.55, color="#aabdc9", edgecolor="#91a5b4", linewidth=0.10, shade=True, alpha=1)

    # Volúmenes de aforo simulados (verde / ámbar / rojo).
    for x, y, width, depth, height, color in [
        (-49, -27, 27, 22, 13, "#10b981"),
        (-7, -8, 34, 25, 18, "#f59e0b"),
        (32, 14, 24, 24, 27, "#ef4444"),
    ]:
        ax.bar3d(x, y, 0.35, width, depth, height, color=color, edgecolor=color, linewidth=0.75, shade=False, alpha=0.30)

    # Rutas de redistribución, sensores y recursos turísticos.
    for xs, ys in [([-55, -33, -12, 12, 37], [-38, -19, -11, 4, 25]), ([-42, -24, -2, 25, 48], [28, 17, 8, -4, -23])]:
        ax.plot(xs, ys, [2.6] * len(xs), color="#0284c7", linewidth=3, linestyle=(0, (5, 3)), alpha=0.98)
    sensors = [(-42, 18), (-19, -3), (8, 17), (31, -18), (47, 8)]
    for index, (x, y) in enumerate(sensors):
        ax.scatter([x], [y], [7], s=95, c="#ef4444" if index == 3 else "#06b6d4", depthshade=False, edgecolors="#ffffff", linewidths=1.4)
    for x, y in [(-31, 24), (-5, 8), (18, 22), (43, -5)]:
        ax.scatter([x], [y], [11], s=125, marker="^", c="#d9295d", depthshade=False, edgecolors="#ffffff", linewidths=1.5)

    ax.view_init(elev=35, azim=-58)
    ax.set_xlim(-78, 78)
    ax.set_ylim(-78, 62)
    ax.set_zlim(0, 45)
    ax.set_box_aspect((1.15, 1.0, 0.42))
    ax.set_axis_off()
    ax.dist = 4.5
    plt.subplots_adjust(left=0, right=1, bottom=0, top=1)
    fig.savefig(OUT, facecolor="#eef7f9", transparent=False, pil_kwargs={"optimize": True})
    plt.close(fig)
    print(f"Render creado: {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
