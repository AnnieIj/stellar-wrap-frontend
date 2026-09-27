import { describe, it, expect } from "vitest";
import {
  parseSharePreviewParams,
  buildSharePreviewSearchParams,
  SHARE_PREVIEW_DEFAULTS,
} from "@/app/utils/sharePreviewParams";

describe("sharePreviewParams", () => {
  it("parses valid preview params", () => {
    const params = new URLSearchParams({
      username: "alice",
      transactions: "42",
      persona: "The Wizard",
      topVibe: "Power User",
      vibePercentage: "72",
      archetypeImage: "/archetypes/wizard.png",
    });

    expect(parseSharePreviewParams(params)).toEqual({
      username: "alice",
      transactions: 42,
      persona: "The Wizard",
      topVibe: "Power User",
      vibePercentage: 72,
      archetypeImage: "/archetypes/wizard.png",
    });
  });

  it("rejects malformed values and uses safe defaults", () => {
    const params = new URLSearchParams({
      username: "<script>",
      transactions: "not-a-number",
      vibePercentage: "500",
      archetypeImage: "https://evil.example/logo.png",
    });

    expect(parseSharePreviewParams(params)).toEqual({
      username: SHARE_PREVIEW_DEFAULTS.username,
      transactions: SHARE_PREVIEW_DEFAULTS.transactions,
      persona: SHARE_PREVIEW_DEFAULTS.persona,
      topVibe: SHARE_PREVIEW_DEFAULTS.topVibe,
      vibePercentage: SHARE_PREVIEW_DEFAULTS.vibePercentage,
      archetypeImage: undefined,
    });
  });

  it("round-trips through buildSharePreviewSearchParams", () => {
    const preview = {
      username: "bob",
      transactions: 10,
      persona: "Explorer",
      topVibe: "Steady",
      vibePercentage: 33,
    };
    const parsed = parseSharePreviewParams(buildSharePreviewSearchParams(preview));
    expect(parsed).toEqual({ ...preview, archetypeImage: undefined });
  });
});
