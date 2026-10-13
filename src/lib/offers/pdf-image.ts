import sharp from "sharp";

/**
 * react-pdf only decodes JPG/PNG and the browser fetch is subject to CORS,
 * so product images (often WebP / remote) are fetched server-side and
 * embedded as small JPEG data URIs.
 */
export async function imageToPdfDataUri(
  url: string | null | undefined,
): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const input = Buffer.from(await res.arrayBuffer());
    const out = await sharp(input)
      .resize(96, 96, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 80 })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch (e) {
    console.warn("[offer pdf] image conversion failed", url, e);
    return null;
  }
}
