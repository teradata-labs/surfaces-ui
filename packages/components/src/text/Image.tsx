import { type CSSProperties, type ReactNode, createContext, useContext } from "react";

/**
 * Turns the name or address an image was given into the address to draw, or nothing. The host owns it: it is the
 * only way an address reaches an `<img>` for text or a catalog component an agent wrote.
 */
export type ImageResolver = (src: string) => string | undefined;

const ImageResolverContext = createContext<ImageResolver | undefined>(undefined);

/**
 * Says, once for everything below it, how an image an agent named is turned into an address: the catalog's `Image`
 * and the images in `Markdown` (`![alt](src)`) both ask it, unless they are given a `resolveImage` of their own.
 * `SurfaceView` takes `resolveImage` and provides it, so a host with one surface needs no provider.
 */
export function ImageResolverProvider({ resolve, children }: { resolve: ImageResolver | undefined; children: ReactNode }) {
  return <ImageResolverContext.Provider value={resolve}>{children}</ImageResolverContext.Provider>;
}

/** The resolver a host provided above, if any. */
export function useImageResolver(): ImageResolver | undefined {
  return useContext(ImageResolverContext);
}

const IMAGE_DATA = /^data:image\/(?:png|jpe?g|gif|webp|avif);/i;

/**
 * Whether an address may be drawn as an image: http(s), a `blob:` the host made from a file, a raster `data:image/`,
 * or a path on the same origin (`/files/1.png`). Never a script, `file:` or a protocol-relative address. Used for
 * what a host's resolver returned and for a preview a host supplies; never for text an agent wrote.
 */
export function safeImageAddress(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/^\/(?![/\\])/.test(value)) return value;
  if (IMAGE_DATA.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "blob:" ? value : undefined;
  } catch {
    return undefined;
  }
}

/** The address to draw for an image the text or an agent gave, or nothing: the host's resolver is the only source. */
export function resolveImageAddress(resolve: ImageResolver | undefined, src: string): string | undefined {
  if (!resolve || !src) return undefined;
  try {
    return safeImageAddress(resolve(src));
  } catch {
    return undefined;
  }
}

export type ImageFit = "contain" | "cover";

export interface ImageProps {
  /** What the image is called: the name or address the text or agent gave. It is never loaded as written; the resolver turns it into the address to draw. */
  src: string;
  /** What it shows, for anyone who cannot see it. Required; shown in its place when there is no address. An empty string marks decoration. */
  alt: string;
  caption?: ReactNode;
  /** The most the image is wide, in pixels. It never grows past its container. */
  width?: number;
  /** A fixed height in pixels; the image then fills the box by `fit`. */
  height?: number;
  /** How a fixed box is filled: whole (`contain`, the default) or edge to edge, cropped (`cover`). */
  fit?: ImageFit;
  /** The most the image is tall, in pixels. */
  maxHeight?: number;
  /** Overrides the resolver provided above (`ImageResolverProvider`). */
  resolveImage?: ImageResolver;
  className?: string;
}

/**
 * A picture the host decides how to find. The address is drawn only when the host's resolver gives one for `src`;
 * without a resolver, or when it gives nothing, the `alt` text stands in its place, so what a model wrote can never
 * load an address of its own choosing.
 */
export function Image({ src, alt, caption, width, height, fit = "contain", maxHeight, resolveImage, className }: ImageProps) {
  const provided = useImageResolver();
  const address = resolveImageAddress(resolveImage ?? provided, src);
  const style: Record<string, string> = {};
  if (width) style["--sf-image-width"] = `${width}px`;
  if (height) style["--sf-image-height"] = `${height}px`;
  if (maxHeight) style["--sf-image-max-height"] = `${maxHeight}px`;
  return (
    <figure className={["sf-image", className].filter(Boolean).join(" ")} data-fit={fit} data-fixed={height ? true : undefined} style={style as CSSProperties}>
      {address ? (
        <img className="sf-image-body" src={address} alt={alt} loading="lazy" decoding="async" />
      ) : (
        <div className="sf-image-missing" role={alt ? "img" : undefined} aria-label={alt || undefined}>
          <span aria-hidden="true">{alt || "Image"}</span>
        </div>
      )}
      {caption != null && caption !== "" && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
