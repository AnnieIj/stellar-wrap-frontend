import { GIFEncoder, quantize, applyPalette } from "gifenc";

interface FramePayload {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

self.onmessage = (e: MessageEvent<{ frames: FramePayload[]; delayMs: number }>) => {
  try {
    const { frames, delayMs } = e.data;
    const gif = GIFEncoder();
    for (const frame of frames) {
      const palette = quantize(frame.data, 256);
      const index = applyPalette(frame.data, palette);
      gif.writeFrame(index, frame.width, frame.height, { palette, delay: delayMs });
    }
    gif.finish();
    self.postMessage({ gif: gif.bytes() });
  } catch (err) {
    self.postMessage({
      error: err instanceof Error ? err.message : "GIF encoding failed",
    });
  }
};

export {};
