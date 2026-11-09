/** Sniff common image containers from the first bytes (filename/MIME can lie). */

export type SniffedImageKind = "jpeg" | "png" | "webp" | "gif" | "heic" | "unknown";

function bytesStartWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

/**
 * Detect HEIC/HEIF via ISO BMFF `ftyp` brand at offset 4.
 * Brands: heic, heif, heix, hevc, mif1, msf1, etc.
 */
function looksLikeHeic(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  // size(4) + 'ftyp'(4) + major_brand(4)
  const ftyp =
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70;
  if (!ftyp) return false;

  const brand = String.fromCharCode(
    bytes[8] ?? 0,
    bytes[9] ?? 0,
    bytes[10] ?? 0,
    bytes[11] ?? 0,
  ).toLowerCase();

  return (
    brand.startsWith("hei") ||
    brand.startsWith("hev") ||
    brand === "mif1" ||
    brand === "msf1"
  );
}

export function sniffImageKind(bytes: Uint8Array): SniffedImageKind {
  if (bytesStartWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "png";
  if (
    bytesStartWith(bytes, [0x47, 0x49, 0x46, 0x38]) // GIF8
  ) {
    return "gif";
  }
  // RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  if (looksLikeHeic(bytes)) return "heic";
  return "unknown";
}

export function isBrowserDisplayableImageKind(
  kind: SniffedImageKind,
): boolean {
  return kind === "jpeg" || kind === "png" || kind === "webp" || kind === "gif";
}
