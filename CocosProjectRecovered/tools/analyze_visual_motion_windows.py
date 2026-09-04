#!/usr/bin/env python3
"""Measure short actor motion windows from original reference video frames.

The script intentionally analyzes original evidence only. It does not infer or
modify production animation timing; it records positions and candidate sprite
phases so later Cocos playback can be checked against a reproducible baseline.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

from compare_visual_baselines import (
    ACTOR_SEARCH_RADIUS_PX,
    TEMPLATE_FIT_RELIABLE_MAE,
    UNIT_GLOBAL_SCALE,
    best_template_fit,
    crop_normalized,
)


DESIGN_WIDTH = 750
FRAME_OFFSETS_MS = (-204, -102, 0, 102, 204)
PHASE_FIT_MIN_MARGIN = 0.5
WINDOWS = {
    "t12": {
        "anchorSeconds": 12.0,
        "actors": (
            ("enemy-shooter", 216.899, 65.331, ("units-red/Shooter1_move_*.png",)),
            ("enemy-swordsman-a", 359.321, 69.251, ("units-red/Swordsman1_move_*.png",)),
            ("enemy-swordsman-b", 410.279, 43.118, ("units-red/Swordsman1_move_*.png",)),
        ),
    },
    "t18": {
        "anchorSeconds": 18.0,
        "actors": (
            ("enemy-swordsman-a", 514.808, 339.721, ("units-red/Swordsman1_move_*.png", "units-red/Swordsman1_attack_*.png")),
            ("enemy-shooter", 533.101, 398.519, ("units-red/Shooter1_move_*.png", "units-red/Shooter1_attack_*.png")),
            ("enemy-swordsman-low-hp", 283.537, 522.648, ("units-red/Swordsman1_move_*.png", "units-red/Swordsman1_attack_*.png")),
            ("ally-shooter-a", 205.139, 806.185, ("units/Shooter1_idle_*.png", "units/Shooter1_attack_*.png")),
            ("ally-shooter-b", 474.303, 836.237, ("units/Shooter1_idle_*.png", "units/Shooter1_attack_*.png")),
        ),
    },
}


def frame_name(window_id: str, offset_ms: int) -> str:
    if offset_ms == 0:
        return f"{window_id}.png"
    direction = "m" if offset_ms < 0 else "p"
    return f"{window_id}-{direction}{abs(offset_ms)}.png"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sprite_phase(path: Path) -> tuple[str | None, int | None]:
    match = re.search(r"_(idle|move|attack)_(\d+)\.png$", path.name)
    if not match:
        return None, None
    return match.group(1), int(match.group(2))


def serialize_match(match: dict[str, object], project: Path, expected: tuple[float, float]) -> dict[str, object]:
    path = match["path"]
    assert isinstance(path, Path)
    action, frame_index = sprite_phase(path)
    center = match["center"]
    assert isinstance(center, tuple)
    offset = [center[0] - round(expected[0]), center[1] - round(expected[1])]
    boundary_hit = any(abs(value) == ACTOR_SEARCH_RADIUS_PX for value in offset)
    center_reliable = not boundary_hit and float(match["mae"]) <= TEMPLATE_FIT_RELIABLE_MAE
    phase_reliable = center_reliable and float(match["fitMargin"]) >= PHASE_FIT_MIN_MARGIN
    return {
        "detectedSprite": str(path.relative_to(project)).replace("\\", "/"),
        "action": action,
        "frameIndex": frame_index,
        "flippedHorizontally": bool(match["flippedHorizontally"]),
        "normalizedCenterPx": [int(center[0]), int(center[1])],
        "designCenter": [round(center[0] * DESIGN_WIDTH / 574, 3), round(center[1] * DESIGN_WIDTH / 574, 3)],
        "expectedFromPreviousPx": [round(expected[0], 3), round(expected[1], 3)],
        "offsetFromExpectedPx": offset,
        "templateFitTrimmedMae0To255": round(float(match["mae"]), 4),
        "runnerUpTrimmedMae0To255": round(float(match["runnerUpMae"]), 4),
        "fitMargin0To255": round(float(match["fitMargin"]), 4),
        "searchBoundaryHit": boundary_hit,
        "centerReliable": center_reliable,
        "phaseReliable": phase_reliable,
    }


def detect_actor_track(
    frames: dict[int, np.ndarray],
    sprite_root: Path,
    project: Path,
    design_x: float,
    design_y: float,
    patterns: tuple[str, ...],
) -> dict[int, dict[str, object]]:
    scale = 574 / DESIGN_WIDTH
    render_scale = UNIT_GLOBAL_SCALE * scale
    anchor_expected = (design_x * scale, design_y * scale)
    raw: dict[int, dict[str, object]] = {}

    def detect(offset_ms: int, expected: tuple[float, float]) -> tuple[float, float]:
        match = best_template_fit(frames[offset_ms], sprite_root, patterns, render_scale, *expected)
        raw[offset_ms] = serialize_match(match, project, expected)
        center = raw[offset_ms]["normalizedCenterPx"]
        assert isinstance(center, list)
        return float(center[0]), float(center[1])

    detect(0, anchor_expected)
    center = tuple(raw[0]["normalizedCenterPx"])
    for offset_ms in (-102, -204):
        center = detect(offset_ms, center)
    center = tuple(raw[0]["normalizedCenterPx"])
    for offset_ms in (102, 204):
        center = detect(offset_ms, center)
    return raw


def actor_summary(samples: list[dict[str, object]]) -> dict[str, object]:
    reliable_samples = [sample for sample in samples if sample["centerReliable"]]
    phase_reliable_samples = [sample for sample in samples if sample["phaseReliable"]]
    steps = []
    for previous, current in zip(samples, samples[1:]):
        if not previous["centerReliable"] or not current["centerReliable"]:
            steps.append({
                "fromOffsetMs": previous["offsetMs"],
                "toOffsetMs": current["offsetMs"],
                "centerReliable": False,
                "phaseReliable": False,
            })
            continue
        px = previous["normalizedCenterPx"]
        cx = current["normalizedCenterPx"]
        dx = int(cx[0]) - int(px[0])
        dy = int(cx[1]) - int(px[1])
        steps.append({
            "fromOffsetMs": previous["offsetMs"],
            "toOffsetMs": current["offsetMs"],
            "centerReliable": True,
            "phaseReliable": bool(previous["phaseReliable"] and current["phaseReliable"]),
            "deltaPx": [dx, dy],
            "distancePx": round(math.hypot(dx, dy), 3),
            "actionChanged": previous["action"] != current["action"],
            "frameIndexChanged": previous["frameIndex"] != current["frameIndex"],
            "facingChanged": previous["flippedHorizontally"] != current["flippedHorizontally"],
        })
    reliable_steps = [step for step in steps if step["centerReliable"]]
    phase_reliable_steps = [step for step in steps if step["phaseReliable"]]
    return {
        "reliableSampleCount": len(reliable_samples),
        "phaseReliableSampleCount": len(phase_reliable_samples),
        "sampleCount": len(samples),
        "motionObserved": any(float(step["distancePx"]) >= 1.5 for step in reliable_steps),
        "animationPhaseChangeObserved": any(bool(step["frameIndexChanged"]) or bool(step["actionChanged"]) for step in phase_reliable_steps),
        "steps": steps,
    }


def analyze(project: Path, input_dir: Path) -> dict[str, object]:
    sprite_root = project / "assets" / "resources" / "original" / "units"
    result: dict[str, object] = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "purpose": "Original-video adjacent-frame evidence for later Cocos motion/animation validation",
        "source": {
            "video": "../../targets/wx4f4f3709865004a2/3/evidence/original-reference/QQ20260819-171433.mp4",
            "decoder": "installed Chrome HTML5 video decoder via local byte-range server",
            "sourceFrameSize": [574, 1036],
            "normalizedFrameSize": [574, 984],
            "sampleSpacingMs": 102,
            "note": "Requested media times are exact; the decoder displays the nearest encoded video frame.",
        },
        "heuristics": {
            "actorSearchRadiusPerStepPx": ACTOR_SEARCH_RADIUS_PX,
            "maximumReliableTemplateFitTrimmedMae0To255": TEMPLATE_FIT_RELIABLE_MAE,
            "minimumReliablePhaseFitMargin0To255": PHASE_FIT_MIN_MARGIN,
            "tracking": "anchor at matched t12/t18 coordinate, then propagate independently backward and forward by 102 ms",
            "occlusionPolicy": "boundary hits or template MAE above threshold are retained but excluded from position conclusions; low runner-up margin also excludes sprite-phase conclusions",
        },
        "windows": {},
    }

    windows_output: dict[str, object] = {}
    for window_id, definition in WINDOWS.items():
        frames: dict[int, np.ndarray] = {}
        frame_records = []
        for offset_ms in FRAME_OFFSETS_MS:
            path = input_dir / frame_name(window_id, offset_ms)
            if not path.is_file():
                raise FileNotFoundError(path)
            image = Image.open(path).convert("RGB")
            normalized = crop_normalized(image, "reference")
            frames[offset_ms] = np.asarray(normalized, dtype=np.float32)
            frame_records.append({
                "offsetMs": offset_ms,
                "mediaTimeSeconds": round(float(definition["anchorSeconds"]) + offset_ms / 1000, 3),
                "path": str(path.relative_to(project)).replace("\\", "/"),
                "sha256": sha256(path),
            })

        actors_output = []
        for actor_id, design_x, design_y, patterns in definition["actors"]:
            track = detect_actor_track(frames, sprite_root, project, design_x, design_y, patterns)
            samples = []
            for offset_ms in FRAME_OFFSETS_MS:
                sample = {"offsetMs": offset_ms, **track[offset_ms]}
                samples.append(sample)
            actors_output.append({
                "id": actor_id,
                "candidatePatterns": list(patterns),
                "anchorDesignCenter": [design_x, design_y],
                "samples": samples,
                "summary": actor_summary(samples),
            })

        reliable_actors = [actor for actor in actors_output if actor["summary"]["reliableSampleCount"] >= 4]
        windows_output[window_id] = {
            "anchorSeconds": definition["anchorSeconds"],
            "frames": frame_records,
            "actors": actors_output,
            "summary": {
                "trackedActorCount": len(actors_output),
                "actorsWithAtLeastFourReliableSamples": len(reliable_actors),
                "motionObserved": any(actor["summary"]["motionObserved"] for actor in reliable_actors),
                "animationPhaseChangeObserved": any(actor["summary"]["animationPhaseChangeObserved"] for actor in reliable_actors),
            },
        }
    result["windows"] = windows_output
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    default_project = Path(__file__).resolve().parents[1]
    parser.add_argument("--project", type=Path, default=default_project)
    parser.add_argument("--input-dir", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    project = args.project.resolve()
    input_dir = (args.input_dir or project / "evidence" / "original-motion-windows").resolve()
    output = (args.output or project / "evidence" / "COCOS_ORIGINAL_MOTION_WINDOWS.json").resolve()
    report = analyze(project, input_dir)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "output": str(output),
        "windows": {key: value["summary"] for key, value in report["windows"].items()},
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
