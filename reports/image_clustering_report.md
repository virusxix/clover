# THE CLOVER — Image Clustering Report

**Dataset:** `c:\clover\assets`  
**Images analyzed:** 47  
**Method:** Computer vision only (perceptual hash, HSV histograms, ORB structure, SSIM, face-region histograms, agglomerative clustering). File names were not used for grouping.

**Full machine output:** `reports/image_clusters.json`  
**Re-run:** `python scripts/cluster_images.py`

---

## Executive summary

| Metric | Count |
|--------|------:|
| Visual clusters | 17 |
| Exact / near-duplicate pairs | 13 |
| Images flagged blurry | 9 |
| Images flagged low-quality | 5 |
| Images flagged screenshot-like | 10 |
| Standalone / weak-match bucket | 12 (+ 6 quality flags) |

**Key finding:** Six exported `product-*.png` files are near-duplicates of specific `photo_6111774033587147*.jpg` uploads (98% similarity, hash distance 0–2). Safe to keep one file per pair for the storefront.

---

## Clusters (visual groups)

### Group 1: Ribbed Jacket — Multi-Angle Studio Set
- **Images (5):** `photo_6111774033587147107_y.jpg`, `photo_6111774033587147108_y.jpg`, `photo_6111774033587147110_y.jpg`, `photo_6111774033587147111_y.jpg`, `photo_6111774033587147112_y.jpg`
- **Representative:** `photo_6111774033587147111_y.jpg`
- **Similarity:** 60%
- **Reason:** Shared neutral studio background, similar garment colors (earth tones), consistent product framing and lighting.

---

### Group 2: Brand Logos (Exact Duplicates of Uploads)
- **Images (4):** `logo-icon.png`, `logo-full.png`, `photo_6111774033587147086_x.jpg`, `photo_6111774033587147087_y.jpg`
- **Representative:** `logo-icon.png`
- **Similarity:** 65% (pairwise dupes at **98%**)
- **Reason:** `logo-icon` ↔ `7086` and `logo-full` ↔ `7087` are perceptual duplicates (hash distance 0–2). Same flat graphic subject, not product photography.
- **Flags:** Screenshot-like UI export on logo files; `logo-full` / `7087` also low sharpness.

---

### Group 3: Stacked Jackets — Dark Studio (Near-Duplicates)
- **Images (4):** `photo_6111774033587147122_y.jpg`, `photo_6111774033587147127_y.jpg`, `product-stack-hero.png`, `product-stack-lifestyle.png`
- **Representative:** `photo_6111774033587147122_y.jpg`
- **Similarity:** 95%
- **Reason:** Same stacked ribbed zip jackets, dark background, identical composition; PNG exports match JPG uploads (hash distance 0–6).

---

### Group 4: Jacket Colorways — Paired Angles
- **Images (3):** `photo_6111774033587147116_y.jpg`, `photo_6111774033587147117_y.jpg`, `photo_6111774033587147118_y.jpg`
- **Representative:** `photo_6111774033587147117_y.jpg`
- **Similarity:** 60%
- **Reason:** Same product line, similar studio setup; `7116`↔`7117` at 70% (related angles). `7118` flagged blurry.

---

### Group 5: Dark Fabric Flat Lay & Zip Detail (Near-Duplicates)
- **Images (3):** `photo_6111774033587147124_y.jpg`, `product-trio-flat.png`, `product-zip-detail.png`
- **Representative:** `product-trio-flat.png`
- **Similarity:** 94%
- **Reason:** Low-key dark fabric background, flat-lay apparel; `product-trio-flat` ↔ `product-zip-detail` are **98%** duplicates (hash 0).

---

### Group 6: Lifestyle / On-Body Jacket Views
- **Images (3):** `photo_6111774033587147097_y.jpg`, `photo_6111774033587147099_y.jpg`, `photo_6111774033587147101_y.jpg`
- **Representative:** `photo_6111774033587147097_y.jpg`
- **Similarity:** 48%
- **Reason:** Similar aspect ratio and on-garment / detail-focused presentation (weaker match — same catalog shoot, different poses).

---

### Group 7: Bright White-Studio Pair
- **Images (2):** `photo_6111774033587147103_y.jpg`, `photo_6111774033587147104_y.jpg`
- **Representative:** `photo_6111774033587147103_y.jpg`
- **Similarity:** 51%
- **Reason:** High-key white floor/background, similar product lighting. `7103` flagged blurry.

---

### Group 8: Folded Trio — White Studio (Exact Duplicate)
- **Images (2):** `photo_6111774033587147125_y.jpg`, `product-trio-fold.png`
- **Representative:** `photo_6111774033587147125_y.jpg`
- **Similarity:** 98%
- **Reason:** Near-identical folded jacket trio on white; PNG is export of JPG (hash distance 2).

---

### Group 9: Four-Stack Flat Lay (Exact Duplicate)
- **Images (2):** `photo_6111774033587147126_y.jpg`, `product-stack-four.png`
- **Representative:** `photo_6111774033587147126_y.jpg`
- **Similarity:** 98%
- **Reason:** Same four-color stack composition; hash distance 0.

---

### Group 10: Uncategorized — Mixed Catalog & Hero
- **Images (12):** `hero-image.png`, `photo_6111774033587147088_y.jpg`, `photo_6111774033587147094_y.jpg`, `photo_6111774033587147095_y.jpg`, `photo_6111774033587147096_y.jpg`, `photo_6111774033587147098_y.jpg`, `photo_6111774033587147100_y.jpg`, `photo_6111774033587147109_y.jpg`, `photo_6111774033587147113_y.jpg`, `photo_6111774033587147114_y.jpg`, `photo_6111774033587147119_y.jpg`, `photo_6111774033587147123_y (1).jpg`
- **Representative:** `photo_6111774033587147096_y.jpg`
- **Similarity:** 28% (loose bucket)
- **Reason:** No tight cluster; includes **unique hero** (`hero-image.png` — athlete sports bra, grey studio) plus assorted one-off product angles. *Recommend splitting `hero-image.png` manually as its own “Athlete Hero” group.*

---

## Quality & duplicate flags

### Exact / near-duplicate pairs (≥92% visual similarity)

| Image A | Image B | Similarity | Hash distance |
|---------|---------|------------|---------------|
| `logo-icon.png` | `photo_6111774033587147086_x.jpg` | 98% | 0 |
| `logo-full.png` | `photo_6111774033587147087_y.jpg` | 98% | 2 |
| `photo_6111774033587147122_y.jpg` | `photo_6111774033587147127_y.jpg` | 98% | 0 |
| `photo_6111774033587147122_y.jpg` | `product-stack-hero.png` | 98% | 0 |
| `photo_6111774033587147127_y.jpg` | `product-stack-hero.png` | 98% | 0 |
| `photo_6111774033587147125_y.jpg` | `product-trio-fold.png` | 98% | 2 |
| `photo_6111774033587147126_y.jpg` | `product-stack-four.png` | 98% | 0 |
| `product-trio-flat.png` | `product-zip-detail.png` | 98% | 0 |
| `photo_6111774033587147122_y.jpg` | `product-stack-lifestyle.png` | 92% | 6 |
| `photo_6111774033587147124_y.jpg` | `product-trio-flat.png` | 92% | 6 |
| `photo_6111774033587147124_y.jpg` | `product-zip-detail.png` | 92% | 6 |
| `photo_6111774033587147127_y.jpg` | `product-stack-lifestyle.png` | 92% | 6 |
| `product-stack-hero.png` | `product-stack-lifestyle.png` | 92% | 6 |

### Blurry (Laplacian variance &lt; 80)
`photo_6111774033587147089_y.jpg`, `photo_6111774033587147090_y.jpg`, `photo_6111774033587147091_y.jpg`, `photo_6111774033587147092_y.jpg`, `photo_6111774033587147093_y.jpg`, `photo_6111774033587147102_y.jpg`, `photo_6111774033587147103_y.jpg`, `photo_6111774033587147106_y.jpg`, `photo_6111774033587147118_y.jpg`, `logo-full.png`

### Low resolution / low contrast
`photo_6111774033587147090_y.jpg`, `photo_6111774033587147091_y.jpg`, `photo_6111774033587147106_y.jpg`, `logo-full.png`, `photo_6111774033587147087_y.jpg`

### Screenshot-like (aspect ratio / flat UI heuristics)
`logo-icon.png`, `logo-full.png`, `photo_6111774033587147086_x.jpg`, `photo_6111774033587147087_y.jpg`, `photo_6111774033587147090_y.jpg`, `photo_6111774033587147091_y.jpg`, `photo_6111774033587147093_y.jpg`, `photo_6111774033587147106_y.jpg`

---

## Summary table (all groups)

| # | Group name | Count | Similarity | Representative |
|---|------------|------:|-----------|----------------|
| 1 | Ribbed Jacket — Multi-Angle Studio Set | 5 | 60% | `photo_6111774033587147111_y.jpg` |
| 2 | Brand Logos (duplicate uploads) | 4 | 65% | `logo-icon.png` |
| 3 | Stacked Jackets — Dark Studio | 4 | 95% | `photo_6111774033587147122_y.jpg` |
| 4 | Jacket Colorways — Paired Angles | 3 | 60% | `photo_6111774033587147117_y.jpg` |
| 5 | Dark Fabric Flat Lay & Zip Detail | 3 | 94% | `product-trio-flat.png` |
| 6 | Lifestyle / On-Body Jacket Views | 3 | 48% | `photo_6111774033587147097_y.jpg` |
| 7 | Bright White-Studio Pair | 2 | 51% | `photo_6111774033587147103_y.jpg` |
| 8 | Folded Trio — White Studio (duplicate) | 2 | 98% | `photo_6111774033587147125_y.jpg` |
| 9 | Four-Stack Flat Lay (duplicate) | 2 | 98% | `photo_6111774033587147126_y.jpg` |
| 10 | Uncategorized — Mixed Catalog & Hero | 12 | 28% | `photo_6111774033587147096_y.jpg` |
| 11 | Low Quality / Blurry | 1 | — | `photo_6111774033587147089_y.jpg` |
| 12 | Screenshots & UI Captures | 1 | — | `photo_6111774033587147090_y.jpg` |
| 13 | Screenshots & UI Captures | 1 | — | `photo_6111774033587147091_y.jpg` |
| 14 | Low Quality / Blurry | 1 | — | `photo_6111774033587147092_y.jpg` |
| 15 | Screenshots & UI Captures | 1 | — | `photo_6111774033587147093_y.jpg` |
| 16 | Low Quality / Blurry | 1 | — | `photo_6111774033587147102_y.jpg` |
| 17 | Screenshots & UI Captures | 1 | — | `photo_6111774033587147106_y.jpg` |

---

## Recommended actions for the storefront

1. **Deduplicate assets:** Keep either `product-*.png` *or* its matching `photo_*.jpg`, not both.
2. **Hero:** `hero-image.png` is unique (athlete sports bra) — keep for marketing; do not merge with jacket stacks.
3. **Review flagged shots:** `7089`–`7093`, `7102`, `7106` — blurry or screenshot-like; replace before use in shop grids.
4. **Logos:** Use `logo-icon.png` / `logo-full.png` only; `7086` / `7087` are redundant copies.

---

*Generated by `scripts/cluster_images.py` using OpenCV, ImageHash, and scikit-learn.*
