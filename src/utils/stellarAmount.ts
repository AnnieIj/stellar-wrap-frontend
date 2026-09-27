/**
 * Utilities for formatting and parsing Stellar asset amounts with 7 decimal precision (Stroops).
 *
 * 1 XLM = 10,000,000 Stroops (10^7).
 * Stellar limits and balances use a signed 64-bit integer internally.
 * Maximum valid amount: 922,337,203,685.4775807 (i64 max: 9223372036854775807 stroops).
 */

export const STROOPS_PER_UNIT = 10_000_000n;
export const MAX_STROOPS = 9223372036854775807n;
export const MAX_STELLAR_LIMIT = "922337203685.4775807";

/**
 * Validates whether a given string is a valid positive Stellar decimal amount
 * with at most 7 decimal places.
 */
export function isValidStellarAmount(amount: string): boolean {
  if (!amount || typeof amount !== "string") {
    return false;
  }
  const trimmed = amount.trim();
  if (trimmed === "" || trimmed.startsWith("-")) {
    return false;
  }

  // Regex matching positive numbers with up to 7 decimal digits
  const regex = /^\d+(\.\d{1,7})?$/;
  if (!regex.test(trimmed)) {
    return false;
  }

  try {
    const stroops = toStroops(trimmed);
    return stroops > 0n && stroops <= MAX_STROOPS;
  } catch {
    return false;
  }
}

/**
 * Converts a decimal Stellar amount string or number to integer Stroops (bigint).
 * Prevents JavaScript IEEE-754 floating point precision inaccuracies.
 *
 * @param amount - Decimal string or number, e.g. "12.3456789"
 * @returns bigint representing the amount in Stroops
 * @throws Error if amount is invalid or negative or exceeds 7 decimals
 */
export function toStroops(amount: string | number): bigint {
  const str = typeof amount === "number" ? amount.toString() : amount.trim();
  if (!str) {
    throw new Error("Amount cannot be empty");
  }

  if (str.startsWith("-")) {
    throw new Error("Negative amounts are not allowed");
  }

  const parts = str.split(".");
  if (parts.length > 2) {
    throw new Error(`Invalid amount format: "${str}"`);
  }

  const wholePart = parts[0] || "0";
  const decimalPart = parts[1] || "";

  if (decimalPart.length > 7) {
    throw new Error(`Amount "${str}" exceeds maximum 7 decimal places for Stellar`);
  }

  if (!/^\d+$/.test(wholePart) || (decimalPart.length > 0 && !/^\d+$/.test(decimalPart))) {
    throw new Error(`Invalid numeric characters in amount: "${str}"`);
  }

  // Pad decimal part to 7 places
  const paddedDecimal = decimalPart.padEnd(7, "0");
  const stroops = BigInt(wholePart) * STROOPS_PER_UNIT + BigInt(paddedDecimal);

  if (stroops > MAX_STROOPS) {
    throw new Error(`Amount "${str}" exceeds maximum Stellar 64-bit integer limit`);
  }

  return stroops;
}

/**
 * Converts an amount in Stroops (bigint or numeric string) to a human-readable
 * 7-decimal Stellar string without trailing unnecessary zeroes if trimTrailingZeroes is true.
 *
 * @param stroops - Integer Stroops as bigint or string
 * @param trimTrailingZeroes - Whether to remove trailing zeroes after decimal point (default: false)
 * @returns Decimal string representation
 */
export function fromStroops(
  stroops: bigint | string | number,
  trimTrailingZeroes = false
): string {
  const value = typeof stroops === "bigint" ? stroops : BigInt(String(stroops).trim());
  if (value < 0n) {
    throw new Error("Stroops cannot be negative");
  }

  const whole = value / STROOPS_PER_UNIT;
  const fraction = value % STROOPS_PER_UNIT;

  let fractionStr = fraction.toString().padStart(7, "0");

  if (trimTrailingZeroes) {
    fractionStr = fractionStr.replace(/0+$/, "");
    if (fractionStr === "") {
      return whole.toString();
    }
  }

  return `${whole.toString()}.${fractionStr}`;
}

/**
 * Formats a Stellar decimal amount for user display.
 *
 * @param amount - Decimal string or number
 * @param maxDecimals - Maximum decimal places to display (defaults to 7)
 */
export function formatStellarAmount(
  amount: string | number | undefined | null,
  maxDecimals = 7
): string {
  if (amount === undefined || amount === null || amount === "") {
    return "0";
  }

  const str = String(amount).trim();
  if (!isValidStellarAmount(str)) {
    return str;
  }

  try {
    const stroops = toStroops(str);
    const fullDecimal = fromStroops(stroops, true);
    const parts = fullDecimal.split(".");
    if (parts.length === 1) {
      return parts[0];
    }
    const dec = parts[1].slice(0, maxDecimals);
    return dec.length > 0 ? `${parts[0]}.${dec}` : parts[0];
  } catch {
    return str;
  }
}
