import { describe, it, expect } from "vitest";
import {
  formatDappDisplayName,
  formatDappLabel,
} from "@/app/utils/formatDappLabel";

const CONTRACT =
  "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQONFCIUQG74P3UDMQ74P6C6DJCCEF";

describe("formatDappDisplayName", () => {
  it("shortens Stellar contract addresses", () => {
    expect(formatDappDisplayName(CONTRACT)).toBe(
      `${CONTRACT.slice(0, 4)}...${CONTRACT.slice(-4)}`,
    );
  });

  it("keeps known dapp labels unchanged", () => {
    expect(formatDappDisplayName("StellarX")).toBe("StellarX");
    expect(formatDappDisplayName("  Aqua  ")).toBe("Aqua");
  });

  it("exposes formatDappLabel alias", () => {
    expect(formatDappLabel("StellarX")).toBe("StellarX");
  });
});
