/** Map catalog paths to pre-compressed WebP assets when available. */
export function assetSrc(url?: string | null): string {
  if (!url) return "/assets/hero-image.webp";
  if (!url.startsWith("/assets/")) return url;
  if (url.endsWith(".webp")) return url;
  return url.replace(/\.(jpe?g|png)$/i, ".webp");
}
