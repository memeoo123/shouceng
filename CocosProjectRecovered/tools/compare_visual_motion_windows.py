#!/usr/bin/env python3
"""Compare Cocos evidence-replay captures with original adjacent video frames."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from pathlib import Path

import numpy as np
from PIL import Image

from compare_visual_baselines import (
    ACTOR_SEARCH_RADIUS_PX,
    TEMPLATE_FIT_RELIABLE_MAE,
    UNIT_GLOBAL_SCALE,
    best_template_fit,
    compare,
    crop_normalized,
)


def cocos_frame_name(window_id: str, offset_ms: int) -> str:
    suffix = "" if offset_ms == 0 else f"-{'m' if offset_ms < 0 else 'p'}{abs(offset_ms)}"
    return f"_tmp_cocos-motion-{window_id}{suffix}.png"


def crop_cocos(image: Image.Image) -> Image.Image:
    if image.width != 574 or image.height not in (1035, 1036):
        raise ValueError(f"expected 574x1035/1036 Cocos capture, got {image.size}")
    return image.crop((0, 26, 574, 1010))


def sprite_phase(path: Path) -> tuple[str | None, int | None]:
    match = re.search(r"_(idle|move|attack)_(\d+)\.png$", path.name)
    return (match.group(1), int(match.group(2))) if match else (None, None)


def analyze(project: Path, original_report: dict[str, object], cocos_dir: Path) -> dict[str, object]:
    sprite_root = project / "assets" / "resources" / "original" / "units"
    evidence_dir = project / "evidence" / "original-motion-windows"
    render_scale = UNIT_GLOBAL_SCALE * 574 / 750
    cases = []
    reliable_deltas = []

    for window_id, window in original_report["windows"].items():
        actors_by_offset = {
            sample["offsetMs"]: []
            for actor in window["actors"]
            for sample in actor["samples"]
        }
        for actor in window["actors"]:
            for sample in actor["samples"]:
                actors_by_offset[sample["offsetMs"]].append((actor, sample))

        for frame in window["frames"]:
            offset_ms = frame["offsetMs"]
            original_path = evidence_dir / Path(frame["path"]).name
            cocos_path = cocos_dir / cocos_frame_name(window_id, offset_ms)
            reference = crop_normalized(Image.open(original_path), "reference")
            actual = crop_cocos(Image.open(cocos_path))
            metrics = compare(reference, actual, "motion-window", project)
            actor_results = []
            for actor, reference_sample in actors_by_offset[offset_ms]:
                expected = tuple(reference_sample["normalizedCenterPx"])
                match = best_template_fit(
                    np.asarray(actual.convert("RGB"), dtype=np.float32),
                    sprite_root,
                    tuple(actor["candidatePatterns"]),
                    render_scale,
                    *expected,
                )
                detected_path = match["path"]
                action, frame_index = sprite_phase(detected_path)
                center = match["center"]
                delta = [center[0] - expected[0], center[1] - expected[1]]
                boundary_hit = any(abs(value) == ACTOR_SEARCH_RADIUS_PX for value in delta)
                reliable = not boundary_hit and float(match["mae"]) <= TEMPLATE_FIT_RELIABLE_MAE
                if reliable and reference_sample["centerReliable"]:
                    reliable_deltas.append(delta)
                actor_results.append({
                    "id": actor["id"],
                    "referenceCenterPx": list(expected),
                    "cocosDetectedCenterPx": list(center),
                    "cocosMinusReferencePx": delta,
                    "referenceCenterReliable": reference_sample["centerReliable"],
                    "referencePhaseReliable": reference_sample["phaseReliable"],
                    "cocosCenterReliable": reliable,
                    "cocosDetectedSprite": str(detected_path.relative_to(project)).replace("\\", "/"),
                    "cocosDetectedAction": action,
                    "cocosDetectedFrameIndex": frame_index,
                    "cocosDetectedFlippedHorizontally": bool(match["flippedHorizontally"]),
                    "templateFitTrimmedMae0To255": round(float(match["mae"]), 4),
                    "fitMargin0To255": round(float(match["fitMargin"]), 4),
                    "searchBoundaryHit": boundary_hit,
                })
            cases.append({
                "windowId": window_id,
                "offsetMs": offset_ms,
                "referenceTimeSeconds": frame["mediaTimeSeconds"],
                "reference": str(original_path.relative_to(project)).replace("\\", "/"),
                "capture": cocos_path.name,
                "metrics": {
                    "rgbMaeNormalized": metrics["rgbMaeNormalized"],
                    "edgeIouThreshold48": metrics["edgeIouThreshold48"],
                    "luminanceCorrelation": metrics["luminanceCorrelation"],
                },
                "actors": actor_results,
            })

    abs_deltas = [abs(axis) for delta in reliable_deltas for axis in delta]
    return {
        "schemaVersion": 1,
        "generatedAtLocal": datetime.now().astimezone().isoformat(timespec="seconds"),
        "purpose": "Validate deterministic Cocos rendering of measured original-video states; not a production-timing equivalence claim",
        "normalization": {
            "referenceCrop": [0, 52, 574, 1036],
            "cocosCrop": [0, 26, 574, 1010],
            "normalizedSize": [574, 984],
        },
        "summary": {
            "caseCount": len(cases),
            "reliableActorPairCount": len(reliable_deltas),
            "maximumReliableActorCenterAxisDeltaPx": max(abs_deltas) if abs_deltas else None,
            "averageRgbMaeNormalized": round(sum(case["metrics"]["rgbMaeNormalized"] for case in cases) / len(cases), 6),
            "averageEdgeIouThreshold48": round(sum(case["metrics"]["edgeIouThreshold48"] for case in cases) / len(cases), 6),
        },
        "cases": cases,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    default_project = Path(__file__).resolve().parents[1]
    parser.add_argument("--project", type=Path, default=default_project)
    parser.add_argument("--original-report", type=Path)
    parser.add_argument("--cocos-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    project = args.project.resolve()
    report_path = (args.original_report or project / "evidence" / "COCOS_ORIGINAL_MOTION_WINDOWS.json").resolve()
    output = (args.output or project / "evidence" / "COCOS_MOTION_WINDOW_DIFF.json").resolve()
    original_report = json.loads(report_path.read_text(encoding="utf-8"))
    report = analyze(project, original_report, args.cocos_dir.resolve())
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
