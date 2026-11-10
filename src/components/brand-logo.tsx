type BrandLogoProps = {
  className?: string;
  alt?: string;
};

/** Wordmark: black in light mode, white in dark mode (via .brand-logo CSS). */
export function BrandLogo({
  className = "h-8 w-auto object-contain",
  alt = "LRE Productions",
}: BrandLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt={alt}
      className={["brand-logo", className].filter(Boolean).join(" ")}
    />
  );
}
