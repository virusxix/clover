import Image, { ImageProps } from "next/image";
import { assetSrc } from "@/lib/media";

type Props = Omit<ImageProps, "src"> & {
  src?: string | null;
  /** LCP / above-the-fold */
  priority?: boolean;
};

/** Static WebP from /public — skips slow on-the-fly optimization on Render. */
export function CatalogImage({ src, priority, quality = 75, alt = "", ...rest }: Props) {
  return (
    <Image
      src={assetSrc(src)}
      alt={alt}
      quality={quality}
      unoptimized
      priority={priority}
      loading={priority ? undefined : "lazy"}
      {...rest}
    />
  );
}
