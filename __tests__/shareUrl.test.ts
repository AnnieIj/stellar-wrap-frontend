import { describe, it, expect } from "vitest";
import { generatePlatformShareUrl, generateShareText } from "../app/utils/shareUrl";

describe("shareUrl helpers", () => {
  describe("generateShareText", () => {
    it("generates correct share text including persona and vibes", () => {
      const text = generateShareText(150, "DeFi Degen", 85, "Bullish");
      expect(text).toBe(
        "Check out my Stellar Wrapped 2026! 150 transactions, DeFi Degen persona, 85% Bullish! 🎉 #StellarWrapped"
      );
    });
  });

  describe("generatePlatformShareUrl", () => {
    const testUrl = "https://example.com/share?preview=true";
    const testText = "Check out my wrapped & vibes!";

    it("generates correct X (Twitter) URL with encoded text and URL", () => {
      const url = generatePlatformShareUrl("x", testUrl, testText);
      expect(url).toBe(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(testText)}&url=${encodeURIComponent(testUrl)}`
      );
    });

    it("generates correct WhatsApp URL with encoded text and URL", () => {
      const url = generatePlatformShareUrl("whatsapp", testUrl, testText);
      expect(url).toBe(
        `https://wa.me/?text=${encodeURIComponent(testText + " " + testUrl)}`
      );
    });

    it("generates correct Facebook URL with encoded URL", () => {
      const url = generatePlatformShareUrl("facebook", testUrl, testText);
      expect(url).toBe(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(testUrl)}`
      );
    });

    it("generates correct LinkedIn URL with encoded URL", () => {
      const url = generatePlatformShareUrl("linkedin", testUrl, testText);
      expect(url).toBe(
        `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(testUrl)}`
      );
    });

    it("generates correct Telegram URL with encoded text and URL", () => {
      const url = generatePlatformShareUrl("telegram", testUrl, testText);
      expect(url).toBe(
        `https://t.me/share/url?url=${encodeURIComponent(testUrl)}&text=${encodeURIComponent(testText)}`
      );
    });

    it("returns empty string for unknown platform", () => {
      const url = generatePlatformShareUrl("unknown", testUrl, testText);
      expect(url).toBe("");
    });
  });
});
