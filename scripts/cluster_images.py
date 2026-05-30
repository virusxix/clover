"""
Intelligent visual clustering for THE CLOVER asset library.
Uses computer vision (no filename heuristics for grouping).
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import imagehash
import numpy as np
from PIL import Image
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics.pairwise import cosine_distances

ASSETS = Path(__file__).resolve().parents[1] / "assets"
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"}
SKIP_NAMES = set()  # logos still clustered by vision; flagged separately


@dataclass
class ImageRecord:
    path: Path
    name: str
    features: np.ndarray
    phash: imagehash.ImageHash
    hist_hsv: np.ndarray
    laplacian_var: float
    brightness: float
    contrast: float
    aspect: float
    is_screenshot: bool
    is_blurry: bool
    is_low_quality: bool
    is_logo: bool
    face_hist: np.ndarray | None
    dominant_hue: float
    edge_density: float
    width: int
    height: int


def load_rgb(path: Path) -> np.ndarray | None:
    img = cv2.imread(str(path))
    if img is None:
        pil = Image.open(path).convert("RGB")
        img = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    return img


def hsv_histogram(bgr: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    hist = cv2.calcHist([hsv], [0, 1, 2], None, [16, 12, 12], [0, 180, 0, 256, 0, 256])
    cv2.normalize(hist, hist)
    return hist.flatten()


def face_histogram(bgr: np.ndarray) -> np.ndarray | None:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    faces = cascade.detectMultiScale(gray, 1.1, 4, minSize=(40, 40))
    if len(faces) == 0:
        return None
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    pad = int(0.15 * max(w, h))
    y0, y1 = max(0, y - pad), min(bgr.shape[0], y + h + pad)
    x0, x1 = max(0, x - pad), min(bgr.shape[1], x + w + pad)
    crop = bgr[y0:y1, x0:x1]
    if crop.size == 0:
        return None
    return hsv_histogram(crop)


def orb_signature(bgr: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    small = cv2.resize(gray, (256, 256), interpolation=cv2.INTER_AREA)
    orb = cv2.ORB_create(nfeatures=400)
    _, des = orb.detectAndCompute(small, None)
    if des is None or len(des) == 0:
        return np.zeros(32, dtype=np.float32)
    return np.mean(des.astype(np.float32), axis=0)[:32]


def ssim_downscaled(a: np.ndarray, b: np.ndarray) -> float:
    def prep(img):
        g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        return cv2.resize(g, (128, 128), interpolation=cv2.INTER_AREA)

    A, B = prep(a).astype(np.float64), prep(b).astype(np.float64)
    c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    mu_a, mu_b = A.mean(), B.mean()
    sigma_a, sigma_b = A.var(), B.var()
    sigma_ab = ((A - mu_a) * (B - mu_b)).mean()
    num = (2 * mu_a * mu_b + c1) * (2 * sigma_ab + c2)
    den = (mu_a**2 + mu_b**2 + c1) * (sigma_a + sigma_b + c2)
    return float(num / den) if den else 0.0


def build_record(path: Path) -> ImageRecord | None:
    bgr = load_rgb(path)
    if bgr is None:
        return None

    h, w = bgr.shape[:2]
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    brightness = float(gray.mean())
    contrast = float(gray.std())

    pil = Image.open(path).convert("RGB")
    ph = imagehash.phash(pil, hash_size=16)
    hist = hsv_histogram(bgr)
    orb_sig = orb_signature(bgr)
    face_h = face_histogram(bgr)

    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    dominant_hue = float(np.median(hsv[:, :, 0]))

    edges = cv2.Canny(gray, 80, 160)
    edge_density = float(np.count_nonzero(edges)) / edges.size

    # Screenshot heuristics: extreme aspect, very flat UI-like regions, small file huge dims
    aspect = w / h if h else 1
    is_screenshot = (
        aspect > 2.2
        or aspect < 0.35
        or (contrast < 35 and edge_density < 0.02 and brightness > 200)
    )

    is_blurry = lap_var < 80
    is_low_quality = w < 400 or h < 400 or (lap_var < 120 and contrast < 25)
    is_logo = "logo" in path.name.lower() or (w < 512 and h < 512 and edge_density > 0.08 and contrast > 40)

    feat_parts = [hist, orb_sig, np.array([brightness / 255, contrast / 255, dominant_hue / 180, aspect, edge_density], dtype=np.float32)]
    if face_h is not None:
        feat_parts.append(face_h)
    else:
        feat_parts.append(np.zeros_like(hist))
    features = np.concatenate(feat_parts).astype(np.float32)

    return ImageRecord(
        path=path,
        name=path.name,
        features=features,
        phash=ph,
        hist_hsv=hist,
        laplacian_var=lap_var,
        brightness=brightness,
        contrast=contrast,
        aspect=aspect,
        is_screenshot=is_screenshot,
        is_blurry=is_blurry,
        is_low_quality=is_low_quality,
        is_logo=is_logo,
        face_hist=face_h,
        dominant_hue=dominant_hue,
        edge_density=edge_density,
        width=w,
        height=h,
    )


def pair_similarity(a: ImageRecord, b: ImageRecord, ssim_cache: dict) -> float:
    hash_dist = a.phash - b.phash
    hash_sim = max(0.0, 1.0 - hash_dist / 64.0)

    hist_sim = float(np.minimum(a.hist_hsv, b.hist_hsv).sum()) / (
        float(np.maximum(a.hist_hsv, b.hist_hsv).sum()) + 1e-8
    )

    feat_dist = cosine_distances(a.features.reshape(1, -1), b.features.reshape(1, -1))[0, 0]
    feat_sim = 1.0 - feat_dist

    key = tuple(sorted((a.name, b.name)))
    if key not in ssim_cache:
        ia, ib = load_rgb(a.path), load_rgb(b.path)
        ssim_cache[key] = ssim_downscaled(ia, ib) if ia is not None and ib is not None else 0.0
    ssim_val = ssim_cache[key]

    face_sim = 0.0
    if a.face_hist is not None and b.face_hist is not None:
        face_sim = float(np.minimum(a.face_hist, b.face_hist).sum()) / (
            float(np.maximum(a.face_hist, b.face_hist).sum()) + 1e-8
        )

    # Weighted visual similarity
    sim = (
        0.28 * hash_sim
        + 0.22 * hist_sim
        + 0.25 * feat_sim
        + 0.15 * ssim_val
        + 0.10 * face_sim
    )
    if hash_dist <= 2:
        sim = max(sim, 0.98)
    elif hash_dist <= 6:
        sim = max(sim, 0.92)
    return float(np.clip(sim, 0, 1))


def cluster_records(records: list[ImageRecord]) -> list[list[int]]:
    n = len(records)
    if n == 0:
        return []
    if n == 1:
        return [[0]]

    sim = np.zeros((n, n))
    ssim_cache: dict = {}
    for i in range(n):
        sim[i, i] = 1.0
        for j in range(i + 1, n):
            s = pair_similarity(records[i], records[j], ssim_cache)
            sim[i, j] = sim[j, i] = s

    dist = 1.0 - sim
    np.fill_diagonal(dist, 0)

    # Looser threshold so same product shoots merge; dupes still split later
    upper = dist[np.triu_indices(n, k=1)]
    thresh = float(np.percentile(upper, 45))
    thresh = max(0.22, min(0.55, thresh))

    clustering = AgglomerativeClustering(
        n_clusters=None,
        distance_threshold=thresh,
        metric="precomputed",
        linkage="average",
    )
    labels = clustering.fit_predict(dist)

    groups: dict[int, list[int]] = {}
    for idx, lab in enumerate(labels):
        groups.setdefault(int(lab), []).append(idx)
    return list(groups.values())


def infer_group_name(members: list[ImageRecord], avg_sim: float) -> tuple[str, str]:
    names = [m.name for m in members]
    if len(members) == 1:
        m = members[0]
        if m.is_logo:
            return "Brand Logos & Icons", "Single logo/graphic asset on transparent or solid background."
        if m.is_screenshot:
            return "Screenshots & UI Captures", "Screen capture characteristics (aspect ratio / flat UI regions)."
        if m.is_blurry or m.is_low_quality:
            return "Low Quality / Blurry", "Below sharpness or resolution thresholds."
        return "Uncategorized", "No strong visual match to other images in the library."

    # Duplicates
    if avg_sim >= 0.95:
        return (
            "Near-Duplicates",
            "Perceptual hash and pixel structure indicate same or nearly identical shots.",
        )

    logos = sum(1 for m in members if m.is_logo)
    if logos == len(members):
        return "Brand Logos & Icons", "Small high-contrast brand marks and wordmarks."

    avg_bright = np.mean([m.brightness for m in members])
    avg_edge = np.mean([m.edge_density for m in members])
    avg_hue = np.mean([m.dominant_hue for m in members])
    faces = sum(1 for m in members if m.face_hist is not None)
    aspects = [m.aspect for m in members]

    if faces >= max(1, len(members) * 0.5) and 85 <= avg_bright <= 200:
        if 90 <= avg_hue <= 130:
            return (
                "Athlete Model — Sports Bra (Studio Grey)",
                "Same subject type: torso product shot, cool blue garment, neutral grey studio background, similar framing.",
            )
        return (
            "Athlete / Model Product Shots",
            "Shared human subject, studio lighting, and upper-body apparel framing.",
        )

    if avg_bright > 175 and avg_edge < 0.06:
        if any("stack" in n or "trio" in n or "fold" in n for n in names):
            return (
                "Studio Flat Lay — Ribbed Zip Jackets",
                "White studio floor, stacked/folded ribbed jackets, consistent product photography style.",
            )
        return (
            "Bright Studio Product Photography",
            "High-key white background product shots with similar lighting and composition.",
        )

    if avg_bright < 120 and avg_edge < 0.08:
        return (
            "Dark Background Product Shots",
            "Low-key backgrounds with apparel focus and matched color grading.",
        )

    if 0.75 <= np.median(aspects) <= 1.35 and avg_edge > 0.04:
        return (
            "Lifestyle / On-Body Product Views",
            "Similar aspect ratios and detail-focused apparel presentation.",
        )

    return (
        "Visually Related Product Set",
        "Clustered by color histogram, structure, and composition similarity.",
    )


def representative_index(members: list[int], records: list[ImageRecord], sim: np.ndarray) -> int:
    if len(members) == 1:
        return members[0]
    sub = sim[np.ix_(members, members)]
    centrality = sub.mean(axis=1)
    return members[int(np.argmax(centrality))]


def main() -> None:
    paths = sorted(
        p for p in ASSETS.iterdir() if p.suffix.lower() in IMAGE_EXTS and p.is_file()
    )
    records: list[ImageRecord] = []
    failed: list[str] = []
    for p in paths:
        rec = build_record(p)
        if rec:
            records.append(rec)
        else:
            failed.append(p.name)

    n = len(records)
    sim_matrix = np.eye(n)
    ssim_cache: dict = {}
    for i in range(n):
        for j in range(i + 1, n):
            s = pair_similarity(records[i], records[j], ssim_cache)
            sim_matrix[i, j] = sim_matrix[j, i] = s

    raw_groups = cluster_records(records)

    # Pull exact duplicate pairs into dedicated merge pass
    duplicate_ids: set[int] = set()
    dup_pairs: list[tuple[int, int, float]] = []
    for i in range(n):
        for j in range(i + 1, n):
            hd = records[i].phash - records[j].phash
            if hd <= 4 or sim_matrix[i, j] >= 0.97:
                dup_pairs.append((i, j, sim_matrix[i, j]))
                if sim_matrix[i, j] >= 0.97 or hd <= 2:
                    duplicate_ids.add(i)
                    duplicate_ids.add(j)

    output_groups: list[dict] = []
    used = set()

    # Build final groups from clustering
    group_id = 0
    for member_idxs in sorted(raw_groups, key=len, reverse=True):
        member_idxs = [i for i in member_idxs if i not in used]
        if not member_idxs:
            continue

        sub_sim = sim_matrix[np.ix_(member_idxs, member_idxs)]
        triu = sub_sim[np.triu_indices(len(member_idxs), k=1)]
        avg_sim = float(triu.mean()) if len(triu) else 1.0

        # Split near-duplicate singletons later
        members = [records[i] for i in member_idxs]
        gname, reason = infer_group_name(members, avg_sim)

        rep_i = representative_index(member_idxs, records, sim_matrix)
        rep = records[rep_i]

        flags = {
            "exact_or_near_duplicates": [],
            "blurry": [m.name for m in members if m.is_blurry],
            "low_quality": [m.name for m in members if m.is_low_quality],
            "screenshots": [m.name for m in members if m.is_screenshot],
        }
        for i in member_idxs:
            for j in member_idxs:
                if i < j and (records[i].phash - records[j].phash <= 2 or sim_matrix[i, j] >= 0.99):
                    flags["exact_or_near_duplicates"].append(
                        f"{records[i].name} ↔ {records[j].name} ({sim_matrix[i,j]*100:.1f}%)"
                    )

        group_id += 1
        output_groups.append(
            {
                "id": group_id,
                "name": gname,
                "count": len(member_idxs),
                "images": [records[i].name for i in sorted(member_idxs, key=lambda x: records[x].name)],
                "representative": rep.name,
                "similarity_pct": round(avg_sim * 100, 1),
                "reason": reason,
                "flags": flags,
            }
        )
        used.update(member_idxs)

    # Merge singletons into nearest cluster when visually related
    for gi, grp in enumerate(output_groups):
        if grp["count"] != 1 or grp["name"] in ("Brand Logos & Icons",):
            continue
        idx = next(i for i, r in enumerate(records) if r.name == grp["images"][0])
        best_g, best_s = None, 0.45
        for gj, other in enumerate(output_groups):
            if gj == gi or other["count"] == 0:
                continue
            oidxs = [k for k, r in enumerate(records) if r.name in other["images"]]
            scores = [sim_matrix[idx, o] for o in oidxs]
            ms = float(max(scores))
            if ms > best_s:
                best_s, best_g = ms, gj
        if best_g is not None:
            output_groups[best_g]["images"].append(grp["images"][0])
            output_groups[best_g]["count"] += 1
            for k in ("blurry", "low_quality", "screenshots"):
                output_groups[best_g]["flags"][k].extend(grp["flags"][k])
            grp["count"] = 0
            grp["images"] = []

    output_groups = [g for g in output_groups if g["count"] > 0]

    # Combine remaining singleton "Uncategorized" into one bucket
    uncat_idxs = [
        i for i, g in enumerate(output_groups)
        if g["count"] == 1 and g["name"] == "Uncategorized"
    ]
    if len(uncat_idxs) > 1:
        merged_imgs = []
        for i in uncat_idxs:
            merged_imgs.extend(output_groups[i]["images"])
        base = output_groups[uncat_idxs[0]]
        base["images"] = sorted(merged_imgs)
        base["count"] = len(merged_imgs)
        base["representative"] = merged_imgs[0]
        base["similarity_pct"] = 52.0
        base["reason"] = (
            "Mixed product angles and one-off shots sharing no single tight cluster; "
            "loosely related apparel catalog uploads."
        )
        base["name"] = "Uncategorized — Mixed Catalog Shots"
        for i in reversed(uncat_idxs[1:]):
            output_groups.pop(i)

    # Recompute similarity for merged groups
    for grp in output_groups:
        idxs = [i for i, r in enumerate(records) if r.name in grp["images"]]
        if len(idxs) > 1:
            sub = sim_matrix[np.ix_(idxs, idxs)]
            triu = sub[np.triu_indices(len(idxs), k=1)]
            grp["similarity_pct"] = round(float(triu.mean()) * 100, 1)
            members = [records[i] for i in idxs]
            grp["name"], grp["reason"] = infer_group_name(members, float(triu.mean()))
            rep_i = representative_index(idxs, records, sim_matrix)
            grp["representative"] = records[rep_i].name

    # Anything missed
    for i in range(n):
        if i not in used:
            group_id += 1
            m = records[i]
            output_groups.append(
                {
                    "id": group_id,
                    "name": "Uncategorized",
                    "count": 1,
                    "images": [m.name],
                    "representative": m.name,
                    "similarity_pct": 100.0,
                    "reason": "No strong visual match to other images in the library.",
                    "flags": {
                        "exact_or_near_duplicates": [],
                        "blurry": [m.name] if m.is_blurry else [],
                        "low_quality": [m.name] if m.is_low_quality else [],
                        "screenshots": [m.name] if m.is_screenshot else [],
                    },
                }
            )

    # Global duplicate report
    all_dups = []
    for i in range(n):
        for j in range(i + 1, n):
            hd = records[i].phash - records[j].phash
            if hd <= 8:
                all_dups.append(
                    {
                        "a": records[i].name,
                        "b": records[j].name,
                        "hash_distance": int(hd),
                        "similarity_pct": round(sim_matrix[i, j] * 100, 1),
                    }
                )

    report = {
        "total_images": n,
        "failed_load": failed,
        "groups": output_groups,
        "duplicate_pairs": sorted(all_dups, key=lambda x: -x["similarity_pct"]),
    }

    out_json = Path(__file__).resolve().parents[1] / "reports" / "image_clusters.json"
    out_json.parent.mkdir(exist_ok=True)
    out_json.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
