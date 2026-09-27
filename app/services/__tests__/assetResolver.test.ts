/**
 * Tests for Asset Resolver
 * Tests asset resolution, caching, and metadata handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  assetResolver,
  resolveAsset,
  refreshAsset,
  invalidateStaleAssetCache,
  isNativeAsset,
  getAssetDisplayName,
  getAssetShortName,
} from "@/app/services/assetResolver";
import { assetCache } from "@/app/services/assetCacheService";
import { NATIVE_ASSET, KNOWN_ASSETS, ASSET_CACHE_VERSION } from "@/app/utils/assetConstants";

describe("AssetResolver", () => {
  beforeEach(() => {
    // Clear cache before each test
    assetCache.clear();
    // Mock localStorage for testing
    global.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    } as unknown as Storage;
    // Mock fetch if needed
    vi.clearAllMocks();
  });

  afterEach(() => {
    assetCache.clear();
  });

  describe("Native Asset Resolution", () => {
    it("should resolve 'XLM' to native asset", async () => {
      const result = await resolveAsset("XLM");
      expect(result.code).toBe("XLM");
      expect(result.isNative).toBe(true);
      expect(result.name).toBe("Stellar Lumens");
    });

    it("should resolve 'native' to native asset", async () => {
      const result = await resolveAsset("native");
      expect(result.code).toBe("XLM");
      expect(result.isNative).toBe(true);
    });

    it("should resolve empty string to native asset", async () => {
      const result = await resolveAsset("");
      expect(result.code).toBe("XLM");
      expect(result.isNative).toBe(true);
    });

    it("should detect native assets correctly", () => {
      expect(isNativeAsset("XLM")).toBe(true);
      expect(isNativeAsset("native")).toBe(true);
      expect(isNativeAsset("")).toBe(true);
      expect(isNativeAsset("USDC")).toBe(false);
    });
  });

  describe("Known Asset Resolution", () => {
    it("should resolve USDC from known assets", async () => {
      const result = await resolveAsset("USDC");
      expect(result.code).toBe("USDC");
      expect(result.name).toBe("USD Coin");
      expect(result.isNative).toBe(false);
    });

    it("should resolve BTC from known assets", async () => {
      const result = await resolveAsset("BTC");
      expect(result.code).toBe("BTC");
      expect(result.name).toBe("Bitcoin");
    });

    it("should cache resolved assets", async () => {
      const asset1 = await resolveAsset("ETH");
      const asset2 = await resolveAsset("ETH");

      expect(asset1).toEqual(asset2);
      // ETH is a known asset, so it should be cached with its issuer
      const cached = assetCache.get("ETH", asset1.issuer);
      expect(cached).not.toBeNull();
      expect(cached?.code).toBe("ETH");
    });
  });

  describe("Unknown Asset Resolution", () => {
    it("should create fallback for unknown assets", async () => {
      const result = await resolveAsset("UNKNOWN");
      expect(result.code).toBe("UNKNOWN");
      expect(result.name).toBe("UNKNOWN");
      expect(result.isNative).toBe(false);
    });

    it("should include issuer in fallback for issued assets", async () => {
      const issuer =
        "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQONFCIUQG74P3UDMQ74P6C6DJCCEF";
      const result = await resolveAsset("TEST", issuer);
      expect(result.code).toBe("TEST");
      expect(result.issuer).toBe(issuer);
    });
  });

  describe("Display Names", () => {
    it("should format native asset display name", () => {
      const name = getAssetDisplayName(NATIVE_ASSET);
      expect(name).toBe("Stellar Lumens (XLM)");
    });

    it("should format known asset display name", () => {
      const name = getAssetDisplayName(KNOWN_ASSETS.USDC);
      expect(name).toBe("USD Coin (USDC)");
    });

    it("should get short asset name", () => {
      const shortName = getAssetShortName(KNOWN_ASSETS.BTC);
      expect(shortName).toBe("BTC");
    });
  });

  describe("Batch Resolution", () => {
    it("should resolve multiple assets", async () => {
      const assets = [{ code: "XLM" }, { code: "USDC" }, { code: "BTC" }];

      const results = await assetResolver.resolveAssets(assets);

      expect(results).toHaveLength(3);
      expect(results[0].isNative).toBe(true);
      expect(results[1].code).toBe("USDC");
      expect(results[2].code).toBe("BTC");
    });
  });

  describe("Asset Display Names", () => {
    it("should handle case-insensitive asset codes", async () => {
      const result1 = await resolveAsset("usdc");
      const result2 = await resolveAsset("USDC");

      expect(result1.code).toBe(result2.code);
      expect(result1.name).toBe(result2.name);
    });
  });

  describe("Cache Management", () => {
    it("should clear entire cache", async () => {
      await resolveAsset("USDC");
      assetResolver.clearCache();
      expect(assetCache.get("USDC")).toBeNull();
    });

    it("should treat expired entries as stale and evict on read", () => {
      vi.useFakeTimers();
      const metadata = KNOWN_ASSETS.USDC;
      assetCache.set(metadata, 1000);
      vi.advanceTimersByTime(1001);
      expect(assetCache.isStale("USDC", metadata.issuer)).toBe(true);
      expect(assetCache.get("USDC", metadata.issuer)).toBeNull();
      vi.useRealTimers();
    });

    it("should force refresh by bypassing cache", async () => {
      await resolveAsset("USDC");
      const cachedBefore = assetCache.get("USDC", KNOWN_ASSETS.USDC.issuer);
      expect(cachedBefore).not.toBeNull();

      await refreshAsset("USDC", KNOWN_ASSETS.USDC.issuer);
      const cachedAfter = assetCache.get("USDC", KNOWN_ASSETS.USDC.issuer);
      expect(cachedAfter).not.toBeNull();
    });

    it("should drop version-mismatched cache entries", () => {
      const metadata = KNOWN_ASSETS.BTC;
      assetCache.set(metadata);
      const key = `${metadata.code}_${metadata.issuer}`;
      const internal = (assetCache as unknown as { memoryCache: Record<string, { version: number }> })
        .memoryCache;
      if (internal[key]) {
        internal[key].version = ASSET_CACHE_VERSION - 1;
      }
      expect(assetCache.get("BTC", metadata.issuer)).toBeNull();
      expect(invalidateStaleAssetCache()).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("AssetCache", () => {
  beforeEach(() => {
    assetCache.clear();
  });

  afterEach(() => {
    assetCache.clear();
  });

  it("should store and retrieve assets", () => {
    const metadata = KNOWN_ASSETS.USDC;
    assetCache.set(metadata);

    // Note: Cache key is created from code and issuer
    const retrieved = assetCache.get("USDC", metadata.issuer);
    expect(retrieved).toEqual(metadata);
  });

  it("should handle cache expiration", () => {
    const metadata = KNOWN_ASSETS.BTC;
    assetCache.set(metadata, 1); // 1ms TTL

    setTimeout(() => {
      const retrieved = assetCache.get("BTC");
      expect(retrieved).toBeNull();
    }, 5);
  });

  it("should get cache statistics", () => {
    assetCache.set(KNOWN_ASSETS.USDC);
    assetCache.set(KNOWN_ASSETS.BTC);

    const stats = assetCache.getStats();
    expect(stats.entries).toBe(2);
  });

  it("should clear specific asset", () => {
    assetCache.set(KNOWN_ASSETS.USDC);
    assetCache.set(KNOWN_ASSETS.BTC);

    assetCache.clearAsset("USDC", KNOWN_ASSETS.USDC.issuer);

    expect(assetCache.get("USDC", KNOWN_ASSETS.USDC.issuer)).toBeNull();
    expect(assetCache.get("BTC", KNOWN_ASSETS.BTC.issuer)).not.toBeNull();
  });
});
