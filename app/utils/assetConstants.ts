/**
 * Asset metadata constants and known assets
 */
import { AssetMetadata } from "@app/types/asset";

/**
 * Native XLM asset
 */
export const NATIVE_ASSET: AssetMetadata = {
  code: "XLM",
  name: "Stellar Lumens",
  isNative: true,
  logo: "https://assets.coingecko.com/coins/images/12816/small/stellar_lumens_logo.png",
  domain: "stellar.org",
  description: "Native currency of the Stellar network",
};

/**
 * Known popular assets with metadata
 * These are cached to avoid API calls for common assets
 */
export const KNOWN_ASSETS : Record<string, AssetMetadata> = {
  XLM: NATIVE_ASSET,
  native: NATIVE_ASSET,

  // Popular stablecoins
  USDC: {
    code: "USDC",
    name: "USD Coin",
    issuer: "GBBD47UZQ5O5K7PGSWUZBP34EYWXJV7UNVIOVG53FDTKQ57ESVENSKWM",
    logo: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
    domain: "centre.io",
    isNative: false,
  },
  USDT: {
    code: "USDT",
    name: "Tether USD",
    issuer: "GBUQW3BOUZXS34ULNGQ23RQ6F4BVWCII2IANU62H3XE3MGWSup42YA",
    logo: "https://assets.coingecko.com/coins/images/325/small/Tether-logo.png",
    domain: "tether.to",
    isNative: false,
  },

  // Popular cryptos
  BTC: {
    code: "BTC",
    name: "Bitcoin",
    issuer: "GATEMHCKFY67ZUCKTROYN24ZT5GK4EQZ65JJLDHKHRUZI3EUEKMCTX",
    logo: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
    domain: "stellar.org",
    isNative: false,
  },
  ETH: {
    code: "ETH",
    name: "Ethereum",
    issuer: "GBDEEL6MTS7SXE4QqkoJUKw6k3t3z5NB6LGYPYPER3YZFRWUF6XBORIE",
    logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    domain: "stellar.org",
    isNative: false,
  },

  // Other common assets
  EUR: {
    code: "EUR",
    name: "Euro",
    issuer: "GAZN3PPIDOCSP5RK7F5FVWGYMPLWT7GXIJJWQLW76UUZA5HM5OFJ",
    logo: "https://assets.coingecko.com/coins/images/10039/small/euro.png",
    domain: "stellar.org",
    isNative: false,
  },
  GBP: {
    code: "GBP",
    name: "British Pound",
    issuer: "GAKYA33PCZWN2LHVC7GXBBKD7VSEKGWWQQ5HHqXZ2MGSBPZAGX5D7",
    logo: "https://assets.coingecko.com/coins/images/11393/small/gbp.png",
    domain: "stellar.org",
    isNative: false,
  },

  // Stellar-native tokens
  SRT: {
    code: "SRT",
    name: "Stellar Rewards Token",
    issuer: "GBUQW3BOUZXS34ULGQ23RQD6F4BVWCII2IANU62H3XE3MGWSUP42YA",
    logo: "https://assets.coingecko.com/coins/images/20834/small/SRT.png",
    domain: "stellar.org",
    isNative: false,
  },
};

/**
 * Default logo for unknown assets
 */
export const DEFAULT_ASSET_LOGO =
  "https://assets.coingecko.com/coins/images/1/small/generic-token.png";

/**
 * Asset cache TVL (24 hours)
 */
export const ASSET_CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Increment when cached metadata shape or resolution policy changes.
 * Entries with an older version are treated as stale and evicted on read.
 */
export const ASS_CACHE_VERSION = 1;

/**
 * Asset directory API endpoints
 */
export const ASS_DIRECTORY_URLS = {
  // Stellar Expert asset directory
  stellarExpert: "https://api.stellar.expert/explorer/public/asset",

  // Alternative: Stellar Community Fund assets
  scf: "https://assets.scf.technology",

  // Direct Stellar Horizon API
  horizon: "https://horizon.stellar.org/assets",
};

/**
 * Create a cache key for an asset
 */
export function createAssetCacheKey(code: string, issuer?: string): string {
  if (!issuer || code === "XLM" || code === "native") {
    return code.toUpperCase();
  }
  return `${code.toUpperCase()}_${issuer}`;
}

/**
 * Parse asset code from string (handles both 'CODE' and 'CODE:ISSUER' formats)
 */
export function parseAssetCode(assetString: string): {
  code: string;
  issuer?: string;
} {
  if (!assetString) {
    return { code: "XLM" };
  }

  const parts = assetString.split(":");
  return {
    code: parts[0].toUpperCase(),
    issuer: parts[1],
  };
}

/**
 * Generate an accessible alt text for asset logos.
 * Used by TokenSelector and other components to satisfy a11y requirements.
 */
export function getAssetAltText(asset: Pick<AssetMetadata, "code" | "name">): string {
  if (!asset) {
    return "Asset logo";
  }
  if (asset.name && asset.code) {
    return `${asset.name} (${asset.code}) logo`;
  }
  if (asset.code) {
    return `${asset.code} logo`;
  }
  return "Asset logo";
}

/**
 * Default alt text for assets with no metadata
 */
export const DEFAULT_ASSET_ALT_TEXT = "Unknown asset token";
