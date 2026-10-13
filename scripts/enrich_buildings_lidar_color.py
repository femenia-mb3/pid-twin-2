#!/usr/bin/env python3
"""Enriquece piezas catastrales con el color RGB mediano de cubiertas LiDAR."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import laspy
import numpy as np
from pyproj import Transformer
from shapely import points
from shapely.geometry import shape
from shapely.ops import transform
from shapely.strtree import STRtree


def median_from_histogram(histogram: np.ndarray, counts: np.ndarray) -> np.ndarray:
    targets = np.maximum(1, (counts + 1) // 2)
    cumulative = np.cumsum(histogram, axis=1)
    return np.argmax(cumulative >= targets[:, None], axis=1).astype(np.uint8)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--buildings", required=True, type=Path)
    parser.add_argument("--lidar", required=True, nargs="+", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--chunk-size", type=int, default=500_000)
    args = parser.parse_args()

    collection = json.loads(args.buildings.read_text(encoding="utf-8"))
    features = collection.get("features", [])
    if not features:
        raise RuntimeError("El GeoJSON no contiene edificios.")

    transformer = Transformer.from_crs("EPSG:4326", "EPSG:25830", always_xy=True)
    footprints = [transform(transformer.transform, shape(feature["geometry"])) for feature in features]
    tree = STRtree(footprints)

    building_count = len(features)
    red_hist = np.zeros((building_count, 256), dtype=np.uint32)
    green_hist = np.zeros_like(red_hist)
    blue_hist = np.zeros_like(red_hist)
    counts = np.zeros(building_count, dtype=np.uint32)

    total_read = 0
    total_roof = 0
    total_matched = 0

    for lidar_path in args.lidar:
        with laspy.open(lidar_path) as reader:
            for chunk in reader.chunk_iterator(args.chunk_size):
                total_read += len(chunk)
                classification = np.asarray(chunk.classification)
                valid = classification == 6
                if not np.any(valid):
                    continue

                red = np.asarray(chunk.red)[valid]
                green = np.asarray(chunk.green)[valid]
                blue = np.asarray(chunk.blue)[valid]
                rgb_valid = (red > 0) & (green > 0) & (blue > 0)
                if not np.any(rgb_valid):
                    continue

                x = np.asarray(chunk.x)[valid][rgb_valid]
                y = np.asarray(chunk.y)[valid][rgb_valid]
                red = np.right_shift(red[rgb_valid], 8).astype(np.uint8)
                green = np.right_shift(green[rgb_valid], 8).astype(np.uint8)
                blue = np.right_shift(blue[rgb_valid], 8).astype(np.uint8)
                total_roof += len(x)

                pairs = tree.query(points(x, y), predicate="within")
                if pairs.shape[1] == 0:
                    continue

                point_indices = pairs[0]
                building_indices = pairs[1]
                np.add.at(counts, building_indices, 1)
                np.add.at(red_hist, (building_indices, red[point_indices]), 1)
                np.add.at(green_hist, (building_indices, green[point_indices]), 1)
                np.add.at(blue_hist, (building_indices, blue[point_indices]), 1)
                total_matched += pairs.shape[1]

    median_red = median_from_histogram(red_hist, counts)
    median_green = median_from_histogram(green_hist, counts)
    median_blue = median_from_histogram(blue_hist, counts)

    colored = 0
    for index, feature in enumerate(features):
        properties = feature.setdefault("properties", {})
        count = int(counts[index])
        properties["lidarPointCount"] = count
        properties["lidarColorMethod"] = "median_class_6_rgb_16bit"
        if count:
            rgb = [int(median_red[index]), int(median_green[index]), int(median_blue[index])]
            properties["lidarRgb"] = rgb
            properties["lidarColor"] = "#{:02x}{:02x}{:02x}".format(*rgb)
            colored += 1
        else:
            properties["lidarRgb"] = None
            properties["lidarColor"] = None

    collection.setdefault("metadata", {})["lidarColor"] = {
        "method": "Median RGB of LAS classification 6 points within each cadastral footprint",
        "sourceFiles": [path.name for path in args.lidar],
        "sourceCrs": "EPSG:25830",
        "rgbInput": "16-bit",
        "rgbOutput": "8-bit",
        "features": building_count,
        "featuresWithColor": colored,
        "pointsRead": total_read,
        "roofPoints": total_roof,
        "matchedPoints": total_matched,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(collection, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(collection["metadata"]["lidarColor"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
