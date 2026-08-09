// @ts-ignore
import { prepare, layout, measureNaturalWidth } from "@chenglou/pretext";

/**
 * High-performance text line wrapping & measurement helper powered by pretext canvas engine.
 */
export function measureTextLayout(text: string, maxWidth: number, font = "14px sans-serif") {
  try {
    const prepared = prepare(text, font);
    const result: any = layout(prepared, maxWidth, 20);
    const naturalWidth = typeof measureNaturalWidth === "function" ? (measureNaturalWidth as any)(prepared) : text.length * 8;

    return {
      lineCount: result.lineCount || result.lines?.length || 1,
      height: result.height || 20,
      naturalWidth: typeof naturalWidth === "number" ? naturalWidth : text.length * 8,
    };
  } catch (err) {
    // Graceful fallback for non-canvas environments
    return {
      lineCount: Math.ceil(text.length / Math.max(1, Math.floor(maxWidth / 8))),
      height: 20,
      naturalWidth: text.length * 8,
    };
  }
}
