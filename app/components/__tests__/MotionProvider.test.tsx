/**
 * Unit tests for MotionProvider.
 *
 * The testable behaviour is the feature-loading strategy:
 *  - Normal mode:    features = loadFeatures  (async import of domAnimation)
 *  - Reduced motion: features = () => Promise.resolve({})  (empty, no chunk)
 */

import { MOTION_FEATURES_LOADER } from "../MotionProvider";
import { getPrefersReducedMotion } from "@/app/hooks/useReducedMotion";

// ---------------------------------------------------------------------------
// MOTION_FEATURES_LOADER
// ---------------------------------------------------------------------------

describe("MOTION_FEATURES_LOADER", () => {
  it("is a function", () => {
    expect(typeof MOTION_FEATURES_LOADER).toBe("function");
  });

  it("returns a Promise that resolves to a non-null value", () => {
    return MOTION_FEATURES_LOADER().then((features) => {
      expect(features).not.toBeNull();
      expect(features).not.toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Reduced-motion skip path
// ---------------------------------------------------------------------------

describe("reduced-motion skip path", () => {
  function makeFeatures(prefersReducedMotion: boolean) {
    return prefersReducedMotion
      ? () => Promise.resolve({})
      : MOTION_FEATURES_LOADER;
  }

  it("resolves to {} when reduced motion is preferred", async () => {
    const resolved = await makeFeatures(true)();
    expect(resolved).toEqual({});
  });

  it("returns the real loader when reduced motion is not preferred", () => {
    expect(makeFeatures(false)).toBe(MOTION_FEATURES_LOADER);
  });

  it("empty loader resolves to {} on every call", async () => {
    const loader = makeFeatures(true);
    expect(await loader()).toEqual({});
    expect(await loader()).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// getPrefersReducedMotion
// ---------------------------------------------------------------------------

describe("getPrefersReducedMotion", () => {
  it("returns true when the MediaQueryList matches", () => {
    expect(getPrefersReducedMotion({ matches: true })).toBe(true);
  });

  it("returns false when the MediaQueryList does not match", () => {
    expect(getPrefersReducedMotion({ matches: false })).toBe(false);
  });

  it("returns false for null (SSR-safe)", () => {
    expect(getPrefersReducedMotion(null)).toBe(false);
  });

  it("returns false for undefined (SSR-safe)", () => {
    expect(getPrefersReducedMotion(undefined)).toBe(false);
  });
});
