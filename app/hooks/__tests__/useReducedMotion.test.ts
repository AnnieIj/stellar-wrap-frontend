import { describe, expect, it } from "vitest";
import {
  getPrefersReducedMotion,
  REDUCED_MOTION_QUERY,
  reducedMotionTransition,
} from "@/app/hooks/useReducedMotion";

describe("reduced motion utilities", () => {
  it("exposes the standard media query", () => {
    expect(REDUCED_MOTION_QUERY).toBe("(prefers-reduced-motion: reduce)");
  });

  it("reads matches from a provided MediaQueryList", () => {
    expect(getPrefersReducedMotion({ matches: true })).toBe(true);
    expect(getPrefersReducedMotion({ matches: false })).toBe(false);
  });

  it("returns false when window is unavailable (SSR-safe)", () => {
    expect(getPrefersReducedMotion(null)).toBe(false);
  });

  it("collapses decorative transitions when reduced motion is enabled", () => {
    expect(
      reducedMotionTransition(true, {
        duration: 2,
        delay: 0.5,
        repeat: Infinity,
      }),
    ).toEqual({
      duration: 0,
      delay: 0,
      repeat: 0,
    });
  });

  it("preserves transitions when reduced motion is disabled", () => {
    const transition = { duration: 2, repeat: Infinity };
    expect(reducedMotionTransition(false, transition)).toEqual(transition);
  });
});
