#!/usr/bin/env python3
"""Compare matched Stage 2 reference/Cocos frames after viewport normalization."""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


CASES = (
    ("prep-drag", "t02.png", "cocos-stage2-drag.png"),
    ("prep-layout", "t07.png", "cocos-stage2-preparation.png"),
    ("wave-start", "t12.png", "cocos-stage2-wave-start.png"),
    ("combat", "t18.png", "cocos-stage2-combat.png"),
)

ACTOR_MASKS = {
    "wave-start": (
        ("enemy-shooter", 216.899, 65.331, ("units-red/Shooter1_move_*.png",)),
        ("enemy-swordsman-a", 359.321, 69.251, ("units-red/Swordsman1_move_*.png",)),
        ("enemy-swordsman-b", 410.279, 43.118, ("units-red/Swordsman1_move_*.png",)),
    ),
    "combat": (
        ("enemy-swordsman-a", 514.808, 339.721, ("units-red/Swordsman1_move_*.png", "units-red/Swordsman1_attack_*.png")),
        ("enemy-shooter", 533.101, 398.519, ("units-red/Shooter1_move_*.png", "units-red/Shooter1_attack_*.png")),
        ("enemy-swordsman-low-hp", 283.537, 522.648, ("units-red/Swordsman1_move_*.png", "units-red/Swordsman1_attack_*.png")),
        ("ally-shooter-a", 205.139, 806.185, ("units/Shooter1_idle_*.png", "units/Shooter1_attack_*.png")),
        ("ally-shooter-b", 474.303, 836.237, ("units/Shooter1_idle_*.png", "units/Shooter1_attack_*.png")),
    ),
}

UNIT_GLOBAL_SCALE = 0.9
ACTOR_SEARCH_RADIUS_PX = 16
ALPHA_CORE_THRESHOLD = 128
TEMPLATE_FIT_RELIABLE_MAE = 30.0
TEMPLATE_VISIBLE_FRACTION = 0.6


def crop_normalized(image: Image.Image, source: str) -> Image.Image:
    """Remove the 52 px reference browser chrome or 25/26 px Cocos letterbox."""
    width, height = image.size
    if width != 574:
        raise ValueError(f"expected 574 px width, got {image.size}")
    if source == "reference":
        if height != 1036:
            raise ValueError(f"expected 574x1036 reference, got {image.size}")
        return image.crop((0, 52, 574, 1036))
    if height != 1035:
        raise ValueError(f"expected 574x1035 Cocos capture, got {image.size}")
    return image.crop((0, 26, 574, 1010))


def white_glyph_bounds(rgb: np.ndarray) -> dict[str, int] | None:
    mask = (rgb.min(axis=2) >= 225) & ((rgb.max(axis=2) - rgb.min(axis=2)) <= 28)
    ys, xs = np.nonzero(mask)
    if not len(xs):
        return None
    return {
        "x": int(xs.min()),
        "y": int(ys.min()),
        "width": int(xs.max() - xs.min() + 1),
        "height": int(ys.max() - ys.min() + 1),
        "whitePixelCount": int(mask.sum()),
    }


def image_patch(rgb: np.ndarray, center_x: int, center_y: int, width: int, height: int) -> np.ndarray | None:
    left = center_x - width // 2
    top = center_y - height // 2
    right = left + width
    bottom = top + height
    if left < 0 or top < 0 or right > rgb.shape[1] or bottom > rgb.shape[0]:
        return None
    return rgb[top:bottom, left:right]


def template_fit(
    rgb: np.ndarray,
    sprite_rgb: np.ndarray,
    alpha_mask: np.ndarray,
    expected_x: float,
    expected_y: float,
) -> tuple[tuple[int, int], float]:
    """Locate one sprite near its evidence coordinate using opaque source pixels only."""
    height, width = alpha_mask.shape
    expected = (round(expected_x), round(expected_y))
    best_center = expected
    best_mae = float("inf")
    for center_y in range(expected[1] - ACTOR_SEARCH_RADIUS_PX, expected[1] + ACTOR_SEARCH_RADIUS_PX + 1):
        for center_x in range(expected[0] - ACTOR_SEARCH_RADIUS_PX, expected[0] + ACTOR_SEARCH_RADIUS_PX + 1):
            patch = image_patch(rgb, center_x, center_y, width, height)
            if patch is None:
                continue
            per_pixel_mae = np.abs(patch - sprite_rgb).mean(axis=2)[alpha_mask]
            visible_count = max(1, round(len(per_pixel_mae) * TEMPLATE_VISIBLE_FRACTION))
            mae = float(np.partition(per_pixel_mae, visible_count - 1)[:visible_count].mean())
            if mae < best_mae:
                best_center = (center_x, center_y)
                best_mae = mae
    return best_center, best_mae


def best_template_fit(
    rgb: np.ndarray,
    sprite_root: Path,
    patterns: tuple[str, ...],
    render_scale: float,
    expected_x: float,
    expected_y: float,
) -> dict[str, object]:
    candidates = sorted({path for pattern in patterns for path in sprite_root.glob(pattern)})
    if not candidates:
        raise FileNotFoundError(f"no actor sprites matched {patterns}")
    matches: list[dict[str, object]] = []
    for sprite_path in candidates:
        source_sprite = Image.open(sprite_path).convert("RGBA")
        body = sprite_path.name.split("_", 1)[0]
        render_box_path = sprite_path.parent / f"{body}_idle_0.png"
        render_box = Image.open(render_box_path)
        scaled_size = (
            max(1, round(render_box.width * render_scale)),
            max(1, round(render_box.height * render_scale)),
        )
        source_sprite = source_sprite.resize(scaled_size, Image.Resampling.LANCZOS)
        for flipped in (False, True):
            sprite = source_sprite.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if flipped else source_sprite
            sprite_pixels = np.asarray(sprite, dtype=np.float32)
            alpha_mask = sprite_pixels[:, :, 3] >= ALPHA_CORE_THRESHOLD
            center, mae = template_fit(rgb, sprite_pixels[:, :, :3], alpha_mask, expected_x, expected_y)
            matches.append({
                "path": sprite_path,
                "renderBoxPath": render_box_path,
                "flippedHorizontally": flipped,
                "center": center,
                "mae": mae,
                "size": scaled_size,
                "alphaMask": alpha_mask,
            })
    matches.sort(key=lambda item: item["mae"])
    best = matches[0]
    best["candidateCount"] = len(candidates)
    best["runnerUpMae"] = matches[1]["mae"] if len(matches) > 1 else None
    best["fitMargin"] = (matches[1]["mae"] - best["mae"]) if len(matches) > 1 else None
    return best


def actor_mask_metrics(
    reference: Image.Image,
    actual: Image.Image,
    case_id: str,
    project: Path,
) -> list[dict[str, object]]:
    """Compare evidence actors through their real sprite alpha instead of broad ellipses."""
    objects = ACTOR_MASKS.get(case_id, ())
    if not objects:
        return []
    ref = np.asarray(reference.convert("RGB"), dtype=np.float32)
    got = np.asarray(actual.convert("RGB"), dtype=np.float32)
    ref_edges = np.asarray(reference.convert("L").filter(ImageFilter.FIND_EDGES), dtype=np.uint8) >= 48
    got_edges = np.asarray(actual.convert("L").filter(ImageFilter.FIND_EDGES), dtype=np.uint8) >= 48
    _, width = ref.shape[:2]
    design_scale = width / 750
    render_scale = UNIT_GLOBAL_SCALE * design_scale
    sprite_root = project / "assets" / "resources" / "original" / "units"
    results = []
    for actor_id, design_x, design_y, sprite_patterns in objects:
        center_x = design_x * design_scale
        center_y = design_y * design_scale
        ref_match = best_template_fit(ref, sprite_root, sprite_patterns, render_scale, center_x, center_y)
        got_match = best_template_fit(got, sprite_root, sprite_patterns, render_scale, center_x, center_y)
        ref_center = ref_match["center"]
        got_center = got_match["center"]
        scaled_size = got_match["size"]
        alpha_mask = got_match["alphaMask"]
        ref_patch = image_patch(ref, *ref_center, *scaled_size)
        got_patch = image_patch(got, *got_center, *scaled_size)
        ref_edge_patch = image_patch(ref_edges, *ref_center, *scaled_size)
        got_edge_patch = image_patch(got_edges, *got_center, *scaled_size)
        if ref_patch is None or got_patch is None or ref_edge_patch is None or got_edge_patch is None:
            raise ValueError(f"actor mask escaped the normalized viewport: {case_id}/{actor_id}")
        aligned_delta = np.abs(ref_patch - got_patch)
        edge_union = np.logical_and(alpha_mask, np.logical_or(ref_edge_patch, got_edge_patch))
        edge_intersection = np.logical_and(alpha_mask, np.logical_and(ref_edge_patch, got_edge_patch))
        expected_rounded = [round(center_x), round(center_y)]
        reference_offset = [ref_center[0] - expected_rounded[0], ref_center[1] - expected_rounded[1]]
        cocos_offset = [got_center[0] - expected_rounded[0], got_center[1] - expected_rounded[1]]
        boundary_hit = any(abs(value) == ACTOR_SEARCH_RADIUS_PX for value in (*reference_offset, *cocos_offset))
        center_reliable = (
            not boundary_hit
            and ref_match["mae"] <= TEMPLATE_FIT_RELIABLE_MAE
            and got_match["mae"] <= TEMPLATE_FIT_RELIABLE_MAE
        )
        results.append({
            "id": actor_id,
            "maskKind": "sprite-alpha-core",
            "candidatePatterns": list(sprite_patterns),
            "candidateCount": got_match["candidateCount"],
            "referenceDetectedSprite": str(ref_match["path"].relative_to(project)).replace("\\", "/"),
            "cocosDetectedSprite": str(got_match["path"].relative_to(project)).replace("\\", "/"),
            "renderBoxSource": str(got_match["renderBoxPath"].relative_to(project)).replace("\\", "/"),
            "referenceDetectedFlippedHorizontally": ref_match["flippedHorizontally"],
            "cocosDetectedFlippedHorizontally": got_match["flippedHorizontally"],
            "designCenter": [design_x, design_y],
            "expectedNormalizedCenter": [round(center_x, 3), round(center_y, 3)],
            "scaledSpriteSize": list(scaled_size),
            "alphaCoreThreshold": ALPHA_CORE_THRESHOLD,
            "templateVisibleFraction": TEMPLATE_VISIBLE_FRACTION,
            "alphaPixelCount": int(alpha_mask.sum()),
            "referenceDetectedCenter": list(ref_center),
            "cocosDetectedCenter": list(got_center),
            "referenceOffsetFromExpected": reference_offset,
            "cocosOffsetFromExpected": cocos_offset,
            "cocosMinusReference": [got_center[0] - ref_center[0], got_center[1] - ref_center[1]],
            "templateFitTrimmedMaeReference0To255": round(ref_match["mae"], 4),
            "templateFitTrimmedMaeCocos0To255": round(got_match["mae"], 4),
            "referenceRunnerUpTrimmedMae0To255": round(ref_match["runnerUpMae"], 4),
            "cocosRunnerUpTrimmedMae0To255": round(got_match["runnerUpMae"], 4),
            "referenceFitMargin0To255": round(ref_match["fitMargin"], 4),
            "cocosFitMargin0To255": round(got_match["fitMargin"], 4),
            "searchBoundaryHit": boundary_hit,
            "centerDetectionReliable": center_reliable,
            "rgbMaeAfterCenterAlignment0To255": round(float(aligned_delta[alpha_mask].mean()), 4),
            "edgeIouAfterCenterAlignmentThreshold48": round(
                float(edge_intersection.sum() / edge_union.sum()) if edge_union.any() else 1.0,
                6,
            ),
        })
    return results


def actor_offset_assessment(actor_masks: list[dict[str, object]]) -> dict[str, object] | None:
    if not actor_masks:
        return None
    reliable = [item for item in actor_masks if item["centerDetectionReliable"]]
    offsets = [item["cocosMinusReference"] for item in reliable]
    stable = False
    if len(offsets) >= 3:
        xs = [offset[0] for offset in offsets]
        ys = [offset[1] for offset in offsets]
        stable = max(xs) - min(xs) <= 2 and max(ys) - min(ys) <= 2
    return {
        "heuristic": {
            "maxTemplateFitTrimmedMae0To255": TEMPLATE_FIT_RELIABLE_MAE,
            "rejectSearchBoundaryHits": True,
            "minimumPairsForStableOffset": 3,
            "maximumAxisSpreadForStableOffsetPx": 2,
        },
        "reliablePairCount": len(reliable),
        "totalPairCount": len(actor_masks),
        "stableOffsetDetected": stable,
        "coordinateAdjustmentRecommended": stable,
        "reason": (
            "at least three reliable actor pairs agree within two pixels per axis"
            if stable
            else "insufficient consistent high-confidence pairs; preserve evidence coordinates"
        ),
    }


def compare(reference: Image.Image, actual: Image.Image, case_id: str, project: Path) -> dict[str, object]:
    ref = np.asarray(reference.convert("RGB"), dtype=np.float32)
    got = np.asarray(actual.convert("RGB"), dtype=np.float32)
    delta = np.abs(ref - got)
    mae = float(delta.mean())
    rmse = float(np.sqrt(np.mean((ref - got) ** 2)))
    mse = float(np.mean((ref - got) ** 2))
    psnr = None if mse == 0 else float(20 * math.log10(255 / math.sqrt(mse)))

    ref_luma = ref @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    got_luma = got @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    correlation = float(np.corrcoef(ref_luma.ravel(), got_luma.ravel())[0, 1])

    ref_edges = np.asarray(reference.convert("L").filter(ImageFilter.FIND_EDGES), dtype=np.uint8) >= 48
    got_edges = np.asarray(actual.convert("L").filter(ImageFilter.FIND_EDGES), dtype=np.uint8) >= 48
    edge_union = int(np.logical_or(ref_edges, got_edges).sum())
    edge_iou = float(np.logical_and(ref_edges, got_edges).sum() / edge_union) if edge_union else 1.0

    # Same-text geometry proxy: the wave label is stable in all four matched frames.
    # Bounds cover bright, low-chroma glyph fill rather than claiming OCR equivalence.
    roi = (140, 15, 430, 115)
    x0, y0, x1, y1 = roi
    ref_bound = white_glyph_bounds(ref[y0:y1, x0:x1])
    got_bound = white_glyph_bounds(got[y0:y1, x0:x1])
    for bound in (ref_bound, got_bound):
        if bound:
            bound["x"] += x0
            bound["y"] += y0
    bound_delta = None
    if ref_bound and got_bound:
        bound_delta = {key: got_bound[key] - ref_bound[key] for key in ("x", "y", "width", "height")}

    actor_masks = actor_mask_metrics(reference, actual, case_id, project)
    return {
        "rgbMae0To255": round(mae, 4),
        "rgbMaeNormalized": round(mae / 255, 6),
        "rgbRmse0To255": round(rmse, 4),
        "psnrDb": None if psnr is None else round(psnr, 4),
        "luminanceCorrelation": round(correlation, 6),
        "edgeIouThreshold48": round(edge_iou, 6),
        "waveLabelWhiteGlyphBounds": {
            "roi": list(roi),
            "reference": ref_bound,
            "cocos": got_bound,
            "cocosMinusReference": bound_delta,
        },
        "actorMasks": actor_masks,
        "actorOffsetAssessment": actor_offset_assessment(actor_masks),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    project = args.project_root.resolve()
    workspace = project.parents[1]
    reference_dir = workspace / "targets" / "wx4f4f3709865004a2" / "3" / "evidence" / "original-reference" / "frames"
    evidence_dir = project / "evidence"
    results = []
    for case_id, reference_name, capture_name in CASES:
        reference_path = reference_dir / reference_name
        capture_path = evidence_dir / capture_name
        reference = crop_normalized(Image.open(reference_path), "reference")
        capture = crop_normalized(Image.open(capture_path), "cocos")
        results.append({
            "id": case_id,
            "reference": str(reference_path.relative_to(workspace)).replace("\\", "/"),
            "capture": str(capture_path.relative_to(project)).replace("\\", "/"),
            "normalizedSize": list(reference.size),
            "metrics": compare(reference, capture, case_id, project),
        })
    report = {
        "schemaVersion": "1.0",
        "generatedAtLocal": datetime.now().astimezone().isoformat(timespec="seconds"),
        "target": "wx4f4f3709865004a2/3",
        "normalization": {
            "referenceCrop": [0, 52, 574, 1036],
            "cocosCrop": [0, 26, 574, 1010],
            "reason": "remove captured browser chrome and fixed-width vertical letterbox; compare equal 574x984 game content",
        },
        "interpretation": "Diagnostic regression metrics only. Evidence-anchored actor masks use the original sprite alpha core, the runtime idle-frame render box, horizontal facing and a 60% least-error visible-pixel score to tolerate documented occlusion. Reference/Cocos centers and animation candidates are detected independently.",
        "cases": results,
    }
    output = args.output.resolve() if args.output else evidence_dir / "COCOS_VISUAL_DIFF.json"
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
