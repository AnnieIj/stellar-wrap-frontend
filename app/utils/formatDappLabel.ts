const STELLAR_ADDRESS_PATTERN = /^[GCM][A-Z2-7]{55}$/;

/**
 * Returns a human-readable dApp label. Unknown contracts fall back to a shortened address.
 */
export function formatDappDisplayName(name: string): string {
  const trimmed = name.trim();
  if (STELLAR_ADDRESS_PATTERN.test(trimmed)) {
    return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
  }
  return trimmed;
}

/** Alias used across charts, cards, and share surfaces. */
export const formatDappLabel = formatDappDisplayName;
