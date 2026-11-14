import { useState, type ImgHTMLAttributes, type ReactNode } from "react";

interface FallbackImageProps extends Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "onError"
> {
  readonly src: string | undefined;
  /** Rendered when there is no source or the image fails to load. */
  readonly fallback: ReactNode;
}

export function FallbackImage({
  src,
  fallback,
  alt = "",
  ...image
}: FallbackImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | undefined>();
  if (src === undefined || src === failedSrc) return <>{fallback}</>;
  return (
    <img
      {...image}
      src={src}
      alt={alt}
      onError={() => {
        setFailedSrc(src);
      }}
    />
  );
}
