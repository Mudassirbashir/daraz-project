/**
 * High-performance text line wrapping & measurement helper powered by pretext canvas engine (with safe fallback).
 */
export function measureTextLayout(text: string, maxWidth: number, font = "14px sans-serif") {
  try {
    // Dynamically attempt require for @chenglou/pretext
    const pretext = require("@chenglou/pretext");
    if (pretext && typeof pretext.prepare === "function" && typeof pretext.layout === "function") {
      const prepared = pretext.prepare(text, font);
      const result: any = pretext.layout(prepared, maxWidth, 20);
      const naturalWidth = typeof pretext.measureNaturalWidth === "function"
        ? pretext.measureNaturalWidth(prepared)
        : text.length * 8;

      return {
        lineCount: result.lineCount || result.lines?.length || 1,
        height: result.height || 20,
        naturalWidth: typeof naturalWidth === "number" ? naturalWidth : text.length * 8,
      };
    }
  } catch (err) {
    // Graceful fallback for non-canvas / edge environments
  }

  return {
    lineCount: Math.ceil(text.length / Math.max(1, Math.floor(maxWidth / 8))),
    height: 20,
    naturalWidth: text.length * 8,
  };
}
