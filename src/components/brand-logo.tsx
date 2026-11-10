type BrandLogoProps = {
  className?: string;
  alt?: string;
};

/**
 * LRE wordmark. Black script on light backgrounds, white script on dark ones
 * (the red dots stay red in both). `/logo.png` is the white version, which is
 * also what dark page headers use directly.
 */
export function BrandLogo({
  className = "h-8 w-auto object-contain",
  alt = "LRE Productions",
}: BrandLogoProps) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-dark.png"
        alt={alt}
        className={["brand-logo dark:hidden", className].filter(Boolean).join(" ")}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt={alt}
        className={["brand-logo hidden dark:block", className].filter(Boolean).join(" ")}
      />
    </>
  );
}
