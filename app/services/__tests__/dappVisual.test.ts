import { describe, it, expect } from "vitest";
import { resolveDappVisual } from "@/app/services/assetResolver";

const UNKNOWN_CONTRACT =
  "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQONFCIUQG74P3UDMQ74P6C6DJCCEF";

describe("resolveDappVisual", () => {
  it("keeps known dapp emoji icons", () => {
    const visual = resolveDappVisual("StellarX");
    expect(visual).toEqual({ type: "emoji", emoji: "📈" });
  });

  it("uses provided indexer icon for known dapps", () => {
    const visual = resolveDappVisual("StellarX", { icon: "🛰️" });
    expect(visual).toEqual({ type: "emoji", emoji: "🛰️" });
  });

  it("returns deterministic initials for unknown contracts", () => {
    const first = resolveDappVisual(UNKNOWN_CONTRACT);
    const second = resolveDappVisual(UNKNOWN_CONTRACT);
    expect(first.type).toBe("initials");
    if (first.type === "initials" && second.type === "initials") {
      expect(first.initials).toBe("GB");
      expect(first.initials).toBe(second.initials);
      expect(first.backgroundColor).toBe(second.backgroundColor);
    }
  });

  it("prefers logo URL when provided", () => {
    const visual = resolveDappVisual("Custom", {
      logo: "https://example.com/logo.png",
    });
    expect(visual).toEqual({
      type: "logo",
      logoUrl: "https://example.com/logo.png",
    });
  });
});
