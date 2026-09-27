/**
 * Safe, public-only fields for share / OG preview URLs.
 * Never include wallet addresses, raw transactions, or other private activity.
 */

export interface SharePreviewState {
  username: string;
  transactions: number;
  persona: string;
  topVibe: string;
  vibePercentage: number;
  archetypeImage?: string;
}

export const SHARE_PREVIEW_DEFAULTS: SharePreviewState = {
  username: "StellarUser",
  transactions: 0,
  persona: "Network Pioneer",
  topVibe: "Steady",
  vibePercentage: 0,
};

const MAX_USERNAME_LEN = 40;
const MAX_PERSONA_LEN = 80;
const MAX_VIBE_LEN = 40;
const MAX_ARCHETYPE_PATH_LEN = 120;

const SAFE_TEXT = /^[\w\s.@#+\-/'(),!?&%]+$/u;
const SAFE_ARCHETYPE_PATH = /^\/archetypes\/[\w-]+\.(png|jpg|jpeg|webp)$/i;

type SearchParamInput = URLSearchParams | Record<string, string | string[] | undefined>;

function readParam(
  input: SearchParamInput,
  key: string,
): string | undefined {
  if (input instanceof URLSearchParams) {
    return input.get(key) ?? undefined;
  }
  const raw = input[key];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

function sanitizeText(value: string | undefined, maxLen: number): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().slice(0, maxLen);
  if (!trimmed || !SAFE_TEXT.test(trimmed)) return undefined;
  return trimmed;
}

function parseBoundedInt(value: string | undefined, min: number, max: number): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return undefined;
  return parsed;
}

/**
 * Parse and validate share preview query params. Invalid fields fall back to defaults.
 */
export function parseSharePreviewParams(
  input: SearchParamInput,
): SharePreviewState {
  const username =
    sanitizeText(readParam(input, "username"), MAX_USERNAME_LEN) ??
    SHARE_PREVIEW_DEFAULTS.username;
  const persona =
    sanitizeText(readParam(input, "persona"), MAX_PERSONA_LEN) ??
    SHARE_PREVIEW_DEFAULTS.persona;
  const topVibe =
    sanitizeText(readParam(input, "topVibe"), MAX_VIBE_LEN) ??
    SHARE_PREVIEW_DEFAULTS.topVibe;

  const transactions =
    parseBoundedInt(readParam(input, "transactions"), 0, 10_000_000) ??
    SHARE_PREVIEW_DEFAULTS.transactions;
  const vibePercentage =
    parseBoundedInt(readParam(input, "vibePercentage"), 0, 100) ??
    SHARE_PREVIEW_DEFAULTS.vibePercentage;

  const archetypeRaw = readParam(input, "archetypeImage")?.trim();
  const archetypeImage =
    archetypeRaw &&
    archetypeRaw.length <= MAX_ARCHETYPE_PATH_LEN &&
    SAFE_ARCHETYPE_PATH.test(archetypeRaw)
      ? archetypeRaw
      : undefined;

  return {
    username,
    transactions,
    persona,
    topVibe,
    vibePercentage,
    archetypeImage,
  };
}

export function buildSharePreviewSearchParams(
  preview: SharePreviewState,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("username", preview.username);
  params.set("transactions", String(preview.transactions));
  params.set("persona", preview.persona);
  params.set("topVibe", preview.topVibe);
  params.set("vibePercentage", String(preview.vibePercentage));
  if (preview.archetypeImage) {
    params.set("archetypeImage", preview.archetypeImage);
  }
  return params;
}

export function buildPublicSharePath(
  preview: SharePreviewState,
  locale = "en",
): string {
  const query = buildSharePreviewSearchParams(preview).toString();
  return `/${locale}/share?${query}`;
}

export function hasSharePreviewParams(input: SearchParamInput): boolean {
  const keys = ["username", "transactions", "persona", "topVibe", "vibePercentage", "archetypeImage"];
  return keys.some((key) => {
    const value = readParam(input, key);
    return value !== undefined && value !== "";
  });
}
