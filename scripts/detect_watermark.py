"""Detect bottom-right corner watermarks in product photos."""
from pathlib import Path

import cv2
import numpy as np

ASSETS = Path(__file__).resolve().parents[1] / "assets"


def has_corner_watermark(path: Path) -> bool:
    img = cv2.imread(str(path))
    if img is None:
        return False
    h, w = img.shape[:2]
    x0 = int(w * 0.82)
    y0 = int(h * 0.88)
    roi = img[y0:h, x0:w]
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

    bg = np.median(img[8:48, 8:48])
    diff = np.linalg.norm(roi.astype(np.float32) - bg, axis=2)

    # Grey/white text on light background
    light_text = (gray > 110) & (gray < 250) & (diff > 8) & (diff < 80)
    # White text on dark fabric
    white_on_dark = (gray > 165) & (hsv[:, :, 2] > 160) & (hsv[:, :, 1] < 85)

    score = int(np.sum(light_text)) + int(np.sum(white_on_dark)) * 2
    return score > 120


if __name__ == "__main__":
    for p in sorted(ASSETS.glob("product-*.png")):
        flag = "WATERMARK" if has_corner_watermark(p) else "clean"
        print(f"{flag}: {p.name}")
