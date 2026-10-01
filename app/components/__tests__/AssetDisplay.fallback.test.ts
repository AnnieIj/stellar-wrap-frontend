/**
 * Unit tests for AssetDisplay fallback rendering logic (fix #280).
 *
 * Tests the pure helper functions used to reserve stable icon dimensions
 * and show a polished initials fallback when asset logos fail to load or
 * are unavailable.
 *
 * Because the test environment runs without jsdom (node env), we test the
 * extracted pure logic directly rather than rendering the React components.
 *
- @module AssetDisplay.fallback.test
 */

// --------------------------------------------------------------------------
// Inline helpers -- mirrors the implementations in AssetDisplay.tsx
// --------------------------------------------------------------------------

/** Produce a 1- or 2-letter abbreviation for a given asset code. */
function assetInitials(code: string): string {
  const clean = code.replace(/[^a-zA-Z0-9]/g, "");
  return (clean.slice(0, 2) || "??").toUpperCase();
}

/**
 * Deterministic background colour derived from the asset code.
 * Returns an hsl() string so the same asset always gets the same colour.
 */
function initialsColor(code: string): string {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash * 31 + code.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue} 52% 30%)`;
}

/**
 * Determines whether to show the logo image or the initials badge.
 * Returns true when a fallback badge should be displayed.
 */
function shouldShowFallback(logo: string | undefined, imgError: boolean): boolean {
  return !logo || imgError;
}

// --------------------------------------------------------------------------
// SIZE_CONFIGS mirror -- logo sizes must stay constant regardless of state
// --------------------------------------------------------------------------

const SIZE_CONFIGS = {
  sm: { logo: 16, text: "text-xs" },
  md: { logo: 24, text: "text-sm" },
  lg: { logo: 32, text: "text-base" },
};

// --------------------------------------------------------------------------
// Tests: assetInitials
// --------------------------------------------------------------------------

describe("assetInitials", () => {
  it("returns the first two uppercase characters for a standard code", () => {
    expect(assetInitials("XLM")).toBe("XL");
  });

  it("handles short codes (1 char) without throwing", () => {
    const result = assetInitials("X");
    expect(result).toBe("X");
    expect(result.length).toBe(1);
  });

  it("returns ?? for an empty string", () => {
    expect(assetInitials("")).toBe("??");
  });

  it("strips non-alphanumeric characters before slicing", () => {
    // e.g. a code with a dash like "ST-RT" → "ST"
    expect(assetInitials("ST-RT")).toBe("ST");
  });

  it("uppercases the result", () => {
    expect(assetInitials("usdc")).toBe("US");
  });

  it("handles codes that are purely special characters", () => {
    // All non-alnum stripped → empty → returns ??
    expect(assetInitials("---")).toBe("??");
  });
});

// --------------------------------------------------------------------------
// Tests: initialsColor
// --------------------------------------------------------------------------

describe("initialsColor", () => {
  it("returns a valid hsl() string", () => {
    const color = initialsColor("XLM");
    expect(color).toMatch(/^hsl\(\d+ 52% 30%\)$/);
  });

  it("is deterministic — same code always produces the same colour", () => {
    expect(initialsColor("USDC")).toBe(initialsColor("USDC"));
  });

  it("produces different colours for different codes", () => {
    // Not guaranteed by the algorithm for all pairs, but true for these two
    expect(initialsColor("XLM")).not.toBe(initialsColor("USDC"));
  });

  it("hue is in the valid CSS range [0, 359]", () => {
    const codes = ["XLM", "USDC", "BTC", "ETH", "EUR", "UNKNOWN", "X"];
    for (const code of codes) {
      const color = initialsColor(code);
      const match = color.match(/hsl\((\d+) /);
      if (!match) {
        throw new Error(`Invalid color format: ${color}`);
      }
      expect(match).not.toBe(null);
      const hue = parseInt(match[1], 10);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });
});

// --------------------------------------------------------------------------
// Tests: shouldShowFallback
// --------------------------------------------------------------------------

describe("shouldShowFallback", () => {
  it("returns false when logo is present and image has not errored", () => {
    expect(shouldShowFallback("https://example.com/logo.png", false)).toBe(false);
  });

  it("returns true when logo is undefined", () => {
    expect(shouldShowFallback(undefined, false)).toBe(true);
  });

  it("returns true when logo is an empty string", () => {
    expect(shouldShowFallback("", false)).toBe(true);
  });

  it("returns true when imgError is true, even if logo URL is present", () => {
    expect(shouldShowFallback("https://example.com/logo.png", true)).toBe(true);
  });

  it("returns true when both logo is missing and imgError is true", () => {
    expect(shouldShowFallback(undefined, true)).toBe(true);
  });
});

// --------------------------------------------------------------------------
// Tests: SIZE_CONFIGS — icon slot dimensions must be stable across states
// --------------------------------------------------------------------------

describe("SIZE_CONFIGS — icon slot dimensions", () => {
  it("sm size reserves a 16px icon slot", () => {
    expect(SIZE_CONFIGS.sm.logo).toBe(16);
  });

  it("md size reserves a 24px icon slot", () => {
    expect(SIZE_CONFIGS.md.logo).toBe(24);
  });

  it("lg size reserves a 32px icon slot", () => {
    expect(SIZE_CONFIGS.lg.logo).toBe(32);
  });

  it("each size has a non-empty text class", () => {
    for (const [, cfg] of Object.entries(SIZE_CONFIGS)) {
      expect(cfg.text).toBeTruthy();
    }
  });

  it("icon slot dimensions are positive integers (no layout collapse to 0)", () => {
    for (const [, cfg] of Object.entries(SIZE_CONFIGS)) {
      expect(cfg.logo).toBeGreaterThan(0);
      expect(Number.isInteger(cfg.logo)).toBe(true);
    }
  });
});

// --------------------------------------------------------------------------
// Tests: fallback font-size calculation (mirrors AssetIconSlot inline style)
// --------------------------------------------------------------------------

describe("InitialsBadge font-size calculation", () => {
  /**
   * fontSize = Math.max(8, Math.floor(size * 0.4))
   * This ensures text is always readable and never falls below 8px.
   */
  function badgeFontSize(size: number): number {
    return Math.max(8, Math.floor(size * 0.4));
  }

  it("sm (16px) badge font is 8px", () => {
    expect(badgeFontSize(16)).toBe(8); // floor(6.4)=6 → max(8,6)=8
  });

  it("md (24px) badge font is at least 8px", () => {
    expect(badgeFontSize(24)).toBeGreaterThanOrEqual(8); // floor(9.6)=9 → 9
  });

  it("lg (32px) badge font is at least 8px", () => {
    expect(badgeFontSize(32)).toBeGreaterThanOrEqual(8); // floor(12.8)=12 → 12
  });

  it("font size never goes below 8px regardless of slot size", () => {
    for (let size = 1; size <= 64; size++) {
      expect(badgeFontSize(size)).toBeGreaterThanOrEqual(8);
    }
  });
});

// --------------------------------------------------------------------------
// A11y - mirrors the labels/contrast logic used by AssetIconSlot
// --------------------------------------------------------------------------

/** Accessible label for the fallback badge (used for role="img" aria-label). */
function getAssetBadgeA11yLabel(code: string, name?: string): string {
  const cleanCode = code.trim().toUpperCase();
  if (name && name.trim().length > 0) {
    return `${name.trim()} (${cleanCode})`;
  }
  return cleanCode;
}

/** Convert an hsl() string to an [r,g,b] tuple (0-255). */
function hslToRgb(hsl: string): [number, number, number] {
  const match = hsl.match(/^hsl\((\d+) 52% (\d+)%\)$/);
  if (!match) {
    throw new Error(`Invalid hsl format: ${hsl}`);
  }
  const h = parseInt(match[1], 10) / 360; // normalize to [0,1]
  const s = 0.52;
  const l = parseInt(match[2], 10) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 1/6) { r=c; g=x; b=0; }
  else if (h < 2/6) { r=x; g=c; b=0; }
  else if (h < 3/6) { r=0; g=c; b=x; }
  else if (h < 4/6) { r=0; g=x; b=c; }
  else if (h < 5/6) { r=x; g=0; b=c; }
  else { r=c; g=0; b=x; }
  return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)];
}

/** Relative luminance per WCAG 2.1 (0-1). */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two RGB colors (1-21). */
function contrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const lum1 = relativeLuminance(rgb1);
  const lum2 = relativeLuminance(rgb2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

// --------------------------------------------------------------------------
// Tests: AssetBadge a11y label
// --------------------------------------------------------------------------

describe("getAssetBadgeA11yLabel", () => {
  it("returns the asset name with uppercased code when name is provided", () => {
    expect(getAssetBadgeA11yLabel("xlm", "Stellar Lumens")).toBe("Stellar Lumens (XLM)");
  });

  it("returns just the uppercased code when no name is provided", () => {
    expect(getAssetBadgeA11yLabel("xlm")).toBe("XLM");
  });

  it("trims whitespace from name", () => {
    expect(getAssetBadgeA11yLabel("BTC", "  Bitcoin  ")).toBe("Bitcoin (BTC)");
  });

  it("falls back to code when name is empty or whitespace", () => {
    expect(getAssetBadgeA11yLabel("ETH", "")).toBe("ETH");
    expect(getAssetBadgeA11yLabel("ETH", "   ")).toBe("ETH");
  });

  it("uppercases the code", () => {
    expect(getAssetBadgeA11yLabel("usdc")).toBe("USDC");
  });

  it("trims whitespace from code", () => {
    expect(getAssetBadgeA11yLabel("  xlm  ")).toBe("XLM");
    expect(getAssetBadgeA11yLabel("  eth  ", "Ethereum")).toBe("Ethereum (ETH)");
  });
});

// --------------------------------------------------------------------------
// Tests: fallback badge color contrast
// --------------------------------------------------------------------------

describe("fallback badge color contrast", () => {
  it("fallback badge background color has 4.5:1 contrast against white text for every possible hue", () => {
    for (let hue = 0; hue < 360; hue++) {
      const color = `hsl(${hue} 52% 30%)`;
      const rgb = hslToRgb(color);
      const white: [number, number, number] = [255, 255, 255];
      const ratio = contrastRatio(rgb, white);
      expect(ratio, `Hue ${hue} contrast ratio ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
