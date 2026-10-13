#!/usr/bin/env bash
# Procesa la tesela PNOA-LiDAR del piloto Centro Histórico–Puerto de Málaga.
# Requisitos: tools/ptiler (Point Tiler v0.0.11+) y un LAZ de PNOA con EPSG:25830.
# Tesela objetivo: 373-4065 / H30, que cubre Centro Histórico, Alcazaba, Muelle Uno y Puerto.
# Salida: public/tilesets/malaga-centro-2024/tileset.json + GLB jerárquicos.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INPUT="${1:-$ROOT_DIR/data/lidar/malaga_centro/raw/PNOA_2024_AND_373-4065_H30_NPC02.LAZ}"
OUTPUT="${2:-$ROOT_DIR/public/tilesets/malaga-centro-2024}"
PTILER="${PTILER_BIN:-$ROOT_DIR/tools/ptiler}"

if [[ ! -f "$INPUT" ]]; then
  echo "ERROR: no se encuentra el archivo de entrada: $INPUT" >&2
  exit 1
fi
if [[ ! -x "$PTILER" ]]; then
  echo "ERROR: no se encuentra Point Tiler ejecutable: $PTILER" >&2
  exit 1
fi

# Point Tiler 0.0.11 procesa LAS, no LAZ. Conservamos el original descargado
# y creamos un intermedio LAS con la misma cabecera, clasificación y CRS.
if [[ "${INPUT,,}" == *.laz ]]; then
  LAS_INPUT="${INPUT%.*}.las"
  if [[ ! -s "$LAS_INPUT" ]]; then
    python3 "$ROOT_DIR/scripts/convert_laz_to_las.py" "$INPUT" "$LAS_INPUT"
  fi
  INPUT="$LAS_INPUT"
fi

rm -rf "$OUTPUT"
mkdir -p "$OUTPUT"

"$PTILER" \
  --input "$INPUT" \
  --output "$OUTPUT" \
  --input-epsg 25830 \
  --output-epsg 4979 \
  --min 15 \
  --max 19 \
  --max-memory-mb 8192 \
  --threads 6 \
  --quantize \
  --meshopt

[[ -s "$OUTPUT/tileset.json" ]]
printf '3D Tiles generado: %s\n' "$OUTPUT/tileset.json"
