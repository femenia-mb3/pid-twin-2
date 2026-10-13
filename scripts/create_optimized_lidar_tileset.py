#!/usr/bin/env python3
"""Genera un tileset 3D Tiles LiDAR PNOA optimizado para carga web.

Conserva las teselas reales hasta el nivel indicado y redirige sus URIs al
conjunto PNOA completo. Así se evita que el visor descargue la pirámide de
alta densidad completa al abrir el Nivel 3.
"""
from __future__ import annotations

import argparse
import json
from copy import deepcopy
from pathlib import Path


def level_for(node: dict) -> int | None:
    uri = node.get("content", {}).get("uri") or node.get("content", {}).get("url")
    if not uri:
        return None
    try:
        return int(uri.split("/", 1)[0])
    except (ValueError, IndexError):
        return None


def prune(node: dict, max_level: int, source_prefix: str) -> dict | None:
    result = deepcopy(node)
    uri = result.get("content", {}).get("uri") or result.get("content", {}).get("url")
    node_level = level_for(result)

    if uri:
        result.setdefault("content", {})["uri"] = f"{source_prefix}{uri}"
        result["content"].pop("url", None)

    children = []
    if node_level is None or node_level < max_level:
        for child in node.get("children", []):
            pruned = prune(child, max_level, source_prefix)
            if pruned is not None:
                children.append(pruned)

    if children:
        result["children"] = children
    else:
        result.pop("children", None)
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=Path("public/tilesets/malaga-centro-2024/tileset.json"))
    parser.add_argument("--output", type=Path, default=Path("public/tilesets/malaga-centro-2024-optimizado/tileset.json"))
    parser.add_argument("--max-level", type=int, default=15)
    args = parser.parse_args()

    source = json.loads(args.source.read_text(encoding="utf-8"))
    source_prefix = "../malaga-centro-2024/"
    optimized = {
        "asset": {
            **source.get("asset", {}),
            "generator": "PID SEGITTUR - perfil web LiDAR PNOA optimizado",
            "extras": {
                "sourceTileset": "../malaga-centro-2024/tileset.json",
                "maxLevel": args.max_level,
                "purpose": "Carga inicial estable del Nivel 3; conserva teselas PNOA reales."
            }
        },
        "geometricError": source.get("geometricError", 0),
        "root": prune(source["root"], args.max_level, source_prefix)
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(optimized, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Perfil generado: {args.output} (máximo nivel {args.max_level})")


if __name__ == "__main__":
    main()
