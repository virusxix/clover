"""Remove corner watermark text — only on images that have it."""
from pathlib import Path

import cv2
import numpy as np

ASSETS = Path(__file__).resolve().parents[1] / "assets"

# Visible "豆包AI生成" watermark in bottom-right — fix these only.
# Never process hero-image.png or lifestyle photos with large subject/background —
# inpainting bleeds into the photo background.
NEEDS_FIX_LIGHT_BG = ("product-trio-flat.png",)
NEEDS_FIX_DARK_FABRIC = (
    "product-stack-lifestyle.png",
    "product-zip-detail.png",
)


def fix_light_background(path: Path) -> None:
    img = cv2.imread(str(path))
    h, w = img.shape[:2]
    x0, y0 = int(w * 0.84), int(h * 0.93)
    ref = max(0, y0 - 8)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    mask = np.zeros((h, w), np.uint8)
    for y in range(y0, h):
        for x in range(x0, w):
            if gray[y, x] > 105 and abs(int(gray[y, x]) - int(gray[ref, x])) > 6:
                mask[y, x] = 255
    out = cv2.inpaint(
        img, cv2.dilate(mask, np.ones((3, 3), np.uint8), 1), 3, cv2.INPAINT_TELEA
    )
    cv2.imwrite(str(path), out, [cv2.IMWRITE_PNG_COMPRESSION, 3])


def fix_white_on_dark(path: Path) -> None:
    img = cv2.imread(str(path))
    h, w = img.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    for y in range(int(h * 0.90), h):
        for x in range(int(w * 0.76), w):
            if gray[y, x] > 175 and hsv[y, x, 2] > 165:
                mask[y, x] = 255
    out = cv2.inpaint(
        img, cv2.dilate(mask, np.ones((3, 3), np.uint8), 2), 4, cv2.INPAINT_TELEA
    )
    cv2.imwrite(str(path), out, [cv2.IMWRITE_PNG_COMPRESSION, 3])


if __name__ == "__main__":
    for name in NEEDS_FIX_LIGHT_BG:
        p = ASSETS / name
        if p.exists():
            fix_light_background(p)
            print(f"Fixed (light bg): {name}")
    for name in NEEDS_FIX_DARK_FABRIC:
        p = ASSETS / name
        if p.exists():
            fix_white_on_dark(p)
            print(f"Fixed (dark fabric): {name}")
