/**
 * Client-side cover-crop resize for platform exports.
 * Supports adjustable focus (pan) and zoom for downloads / save-to-packet.
 */

export type CoverCropOptions = {
  /** Horizontal focus in the source image, 0–1 (0.5 = center). */
  focusX?: number;
  /** Vertical focus in the source image, 0–1 (0.5 = center). */
  focusY?: number;
  /** Zoom factor ≥ 1. 1 = exact cover; higher crops tighter. */
  zoom?: number;
};

export type CoverCropDraw = {
  dx: number;
  dy: number;
  drawW: number;
  drawH: number;
  scale: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Compute cover-crop draw rect for a target canvas size. */
export function computeCoverCropDraw(
  imageWidth: number,
  imageHeight: number,
  outWidth: number,
  outHeight: number,
  options: CoverCropOptions = {},
): CoverCropDraw {
  const zoom = Math.max(1, options.zoom ?? 1);
  const focusX = clamp(options.focusX ?? 0.5, 0, 1);
  const focusY = clamp(options.focusY ?? 0.5, 0, 1);

  const scale =
    Math.max(outWidth / imageWidth, outHeight / imageHeight) * zoom;
  const drawW = imageWidth * scale;
  const drawH = imageHeight * scale;

  let dx = outWidth / 2 - focusX * imageWidth * scale;
  let dy = outHeight / 2 - focusY * imageHeight * scale;

  // Keep the image covering the frame (no letterboxing from pan).
  dx = clamp(dx, outWidth - drawW, 0);
  dy = clamp(dy, outHeight - drawH, 0);

  return { dx, dy, drawW, drawH, scale };
}

/**
 * Draws the source image into width×height with optional focus/zoom and
 * returns a JPEG data URL.
 */
export async function cropImageToDataUrl(
  sourceUrl: string,
  width: number,
  height: number,
  options: CoverCropOptions = {},
): Promise<string> {
  const image = await loadImage(sourceUrl);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported in this browser.");

  const { dx, dy, drawW, drawH } = computeCoverCropDraw(
    image.width,
    image.height,
    width,
    height,
    options,
  );

  ctx.fillStyle = "#0b0b0b";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, dx, dy, drawW, drawH);

  return canvas.toDataURL("image/jpeg", 0.92);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image for export."));
    img.src = url;
  });
}

export function downloadDataUrl(dataUrl: string, fileName: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.click();
}
