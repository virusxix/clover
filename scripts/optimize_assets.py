"""
Resize and compress catalog images to WebP for faster storefront loads.
Writes .webp next to originals under assets/ and soul-store/apps/web/public/assets/.
"""
from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Install Pillow: pip install pillow")
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
TARGET_DIRS = [
    ROOT / "assets",
    ROOT / "soul-store" / "apps" / "web" / "public" / "assets",
]
SKIP = {"logo-icon.png", "logo-full.png", "logo-clover.svg", "hero-video.mp4"}
MAX_WIDTH = {
    "hero": 1400,
    "product": 900,
    "thumb": 480,
}


def max_width_for(name: str) -> int:
    lower = name.lower()
    if "hero" in lower or "stack" in lower or "trio" in lower:
        return MAX_WIDTH["hero"]
    if "logo" in lower:
        return 256
    return MAX_WIDTH["product"]


def to_webp(src: Path) -> None:
    if src.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
        return
    if src.name in SKIP:
        return

    dest = src.with_suffix(".webp")
    try:
        img = Image.open(src)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGBA")
        else:
            img = img.convert("RGB")

        w = max_width_for(src.name)
        if img.width > w:
            ratio = w / img.width
            img = img.resize((w, int(img.height * ratio)), Image.Resampling.LANCZOS)

        save_kw = {"quality": 82, "method": 6}
        if img.mode == "RGBA":
            img.save(dest, "WEBP", **save_kw)
        else:
            img.save(dest, "WEBP", **save_kw)

        before = src.stat().st_size
        after = dest.stat().st_size
        print(f"  {src.name} -> {dest.name} ({before // 1024}KB -> {after // 1024}KB)")
    except OSError as e:
        print(f"  skip {src.name}: {e}")


def main() -> None:
    for folder in TARGET_DIRS:
        if not folder.is_dir():
            print(f"Missing folder: {folder}")
            continue
        print(f"\n{folder}")
        for path in sorted(folder.iterdir()):
            if path.is_file():
                to_webp(path)

    print("\nDone. WebP files are served at /assets/<name>.webp")


if __name__ == "__main__":
    main()
