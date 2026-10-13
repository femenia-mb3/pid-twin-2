#!/usr/bin/env python3
"""Convierte una nube PNOA LAZ a LAS conservando dimensiones, VLR y CRS.

Point Tiler 0.0.11 admite LAS pero no LAZ. Este paso deja el fichero oficial
intacto y crea un intermedio que se excluye de Git.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import laspy


def main() -> None:
    parser = argparse.ArgumentParser(description="Convertir PNOA LAZ a LAS sin pérdida")
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--chunk-size", type=int, default=1_000_000)
    args = parser.parse_args()

    if args.input.suffix.lower() != ".laz":
        raise SystemExit(f"La entrada debe ser .laz: {args.input}")
    if not args.input.is_file():
        raise SystemExit(f"No existe la entrada: {args.input}")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with laspy.open(args.input) as source:
        header = source.header.copy()
        with laspy.open(args.output, mode="w", header=header, do_compress=False) as target:
            written = 0
            for points in source.chunk_iterator(args.chunk_size):
                target.write_points(points)
                written += len(points)
                print(f"Convertidos {written:,} / {source.header.point_count:,} puntos", flush=True)

    with laspy.open(args.output) as result:
        if result.header.point_count == 0:
            raise SystemExit("La conversión no produjo puntos")
        print(f"LAS listo: {args.output} ({result.header.point_count:,} puntos; CRS={result.header.parse_crs().to_epsg()})")


if __name__ == "__main__":
    main()
