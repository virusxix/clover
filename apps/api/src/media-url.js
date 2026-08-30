/** Prefer pre-generated WebP for local /assets catalog paths. */
export function preferWebpUrl(url) {
  if (!url || typeof url !== "string") return url;
  if (!url.startsWith("/assets/")) return url;
  if (url.endsWith(".webp")) return url;
  return url.replace(/\.(jpe?g|png)$/i, ".webp");
}
