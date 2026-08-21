// X reads twitter:image when it is present and falls back to og:image when it
// is not. Pointing both at the same generator keeps the tag explicit rather
// than relying on that fallback.
export {
  default,
  alt,
  size,
  contentType,
  generateStaticParams,
} from "./opengraph-image";
