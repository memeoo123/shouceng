"""Generate red-team unit frames with the original authorized game's shader rule."""

from pathlib import Path

from PIL import Image


PROJECT = Path(__file__).resolve().parents[1]
SOURCE = PROJECT / "bin" / "res" / "units"
TARGET = PROJECT / "bin" / "res" / "units-red"


def convert(source: Path, target: Path) -> int:
    image = Image.open(source).convert("RGBA")
    pixels = list(image.get_flattened_data())
    changed = 0
    converted = []
    for red, green, blue, alpha in pixels:
        # Exact BattleRFillShader `color_rb` test from the recovered package.
        if alpha > 255 * 0.4 and blue > red and red < 255 * 0.3 and blue > 255 * 0.3:
            red = round(blue * 0.924)
            green = 0
            blue = round(blue * 0.265)
            changed += 1
        converted.append((red, green, blue, alpha))
    image.putdata(converted)
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, "PNG", optimize=True)
    return changed


def main() -> None:
    files = sorted(SOURCE.glob("*.png"))
    changed = sum(convert(source, TARGET / source.name) for source in files)
    print(f"generated={len(files)} changed_pixels={changed} target={TARGET}")


if __name__ == "__main__":
    main()
