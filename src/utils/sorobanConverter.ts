/**
 * Soroban ScVal Conversion Utilities
 *
 * Converts JavaScript values to Soroban-compatible ScVal types for use
 * as contract invocation arguments. All Soroban contract calls require
 * arguments in ScVal format - passing raw JS values will cause failures.
 *
 * Supported conversions:
 *   - Numbers  → ScVal.scvU32 / ScVal.scvU64
 *   - Strings  → ScVal.scvString / ScVal.scvSymbol
 *   - Booleans → ScVal.scvBool
 *   - Addresses→ ScVal.scvAddress (via Address.fromString)
 *   - Objects  → ScVal.scvMap (key-value pairs)
 *   - Arrays   → ScVal.scvVec
 *
 * @module sorobanConverter
 */

import {
  xdr,
  Address,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  StrKey,
  SorobanRpc,
  Transaction,
  TransactionBuilder,
  Operation,
} from "stellar-sdk";

// ─── Constants ──────────────────────────────────────────────────────────────

/** Maximum value for a 32-bit unsigned integer */
export const U32_MAX = 2 ** 32 - 1; // 4_294_967_295

/** Maximum value for a 64-bit unsigned integer (BigInt) */
export const U64_MAX = BigInt("18446744073709551615"); // 2^64 - 1

/** Maximum value for a 32-bit signed integer */
export const I32_MAX = 2 ** 31 - 1; // 2_147_483_647

/** Minimum value for a 32-bit signed integer */
export const I32_MIN = -(2 ** 31); // -2_147_483_648

/** Maximum byte length for ScVal strings (Soroban limit) */
export const MAX_STRING_LENGTH = 256_000;

/** Maximum symbol length (Soroban symbols are limited to 32 chars) */
export const MAX_SYMBOL_LENGTH = 32;

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Supported ScVal target types for explicit conversion.
 * Used by `toScVal()` when the caller specifies the desired output type.
 */
export type ScValTargetType =
  | "u32"
  | "i32"
  | "u64"
  | "i64"
  | "u128"
  | "i128"
  | "string"
  | "symbol"
  | "bool"
  | "address"
  | "bytes"
  | "vec"
  | "map";

/**
 * Represents the result of a conversion attempt.
 * Uses a discriminated union for safe error handling without exceptions.
 */
export type ConversionSuccess = { success: true; value: xdr.ScVal };
export type ConversionFailure = { success: false; error: string };
export type ConversionResult = ConversionSuccess | ConversionFailure;

/**
 * Type guard to check if a ConversionResult is a failure.
 */
export function isConversionError(r: ConversionResult): r is ConversionFailure {
  return !r.success;
}

/**
 * Indexed stats coming from the frontend/API before conversion.
 */
export interface IndexedStats {
  totalVolume: number;
  mostActiveAsset: string;
  contractCalls: number;
  [key: string]: unknown;
}

// ─── Validation Helpers ─────────────────────────────────────────────────────

/**
 * Validates that a number falls within the u32 range [0, 2^32 - 1].
 */
export function isValidU32(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= U32_MAX;
}

/**
 * Validates that a number falls within the i32 range [-2^31, 2^31 - 1].
 */
export function isValidI32(value: number): boolean {
  return Number.isInteger(value) && value >= I32_MIN && value <= I32_MAX;
}

/**
 * Validates that a bigint falls within the u64 range [0, 2^64 - 1].
 */
export function isValidU64(value: bigint): boolean {
  return value >= BigInt(0) && value <= U64_MAX;
}

/**
 * Validates a Stellar address format.
 * Stellar G-addresses are 56 characters starting with 'G' (base32).
 * Stellar C-addresses (contracts) are 56 characters starting with 'C'.
 */
export function isValidStellarAddress(address: string): boolean {
  if (!address || typeof address !== "string") return false;

  const trimmed = address.trim();

  // Public key (G...) or Contract (C...)
  if (trimmed.startsWith("G") && trimmed.length === 56) {
    return StrKey.isValidEd25519PublicKey(trimmed);
  }

  if (trimmed.startsWith("C") && trimmed.length === 56) {
    return StrKey.isValidContract(trimmed);
  }

  return false;
}

/**
 * Validates that a string is within the Soroban string length limit.
 */
export function isValidScString(value: string): boolean {
  return (
    typeof value === "string" &&
    Buffer.byteLength(value, "utf8") <= MAX_STRING_LENGTH
  );
}

/**
 * Validates that a string is a valid Soroban symbol
 * (alphanumeric + underscore, max 32 chars).
 */
export function isValidSymbol(value: string): boolean {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > MAX_SYMBOL_LENGTH) return false;
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);
}

// ─── Number Conversions ─────────────────────────────────────────────────────

/**
 * Converts a JavaScript number to an ScVal u32.
 *
 * @param value - Non-negative integer in range [0, 2^32 - 1]
 * @returns ConversionResult with the ScVal or an error message
 *
 * @example
 * ```ts
 * const result = numberToScValU32(42);
 * if (result.success) {
 *   // result.value is xdr.ScVal (scvU32)
 * }
 * ```
 */
export function numberToScValU32(value: number): ConversionResult {
  try {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return { success: false, error: `Invalid number value: ${value}` };
    }
    if (!isValidU32(value)) {
      return {
        success: false,
        error: `Value ${value} is out of u32 range [0, ${U32_MAX}]`,
      };
    }
    return { success: true, value: xdr.ScVal.scvU32(value) };
  } catch (err) {
    return {
      success: false,
      error: `Failed to convert ${value} to ScVal u32: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Converts a JavaScript number to an ScVal i32.
 *
 * @param value - Integer in range [-2^31, 2^31 - 1]
 * @returns ConversionResult with the ScVal or an error message
 */
export function numberToScValI32(value: number): ConversionResult {
  try {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return { success: false, error: `Invalid number value: ${value}` };
    }
    if (!isValidI32(value)) {
      return {
        success: false,
        error: `Value ${value} is out of i32 range [${I32_MIN}, ${I32_MAX}]`,
      };
    }
    return { success: true, value: xdr.ScVal.scvI32(value) };
  } catch (err) {
    return {
      success: false,
      error: `Failed to convert ${value} to ScVal i32: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Converts a JavaScript number or bigint to an ScVal u64.
 *
 * Internally uses `nativeToScVal` with type hint 'u64' for correct
 * BigInt handling through the SDK's XdrLargeInt machinery.
 *
 * @param value - Non-negative number or bigint in range [0, 2^64 - 1]
 * @returns ConversionResult with the ScVal or an error message
 *
 * @example
 * ```ts
 * const result = numberToScValU64(1_000_000);
 * const resultBig = numberToScValU64(BigInt("9999999999999999999"));
 * ```
 */
export function numberToScValU64(value: number | bigint): ConversionResult {
  try {
    const bigVal =
      typeof value === "bigint" ? value : BigInt(Math.floor(value as number));

    if (bigVal < BigInt(0)) {
      return {
        success: false,
        error: `Value ${value} is negative; u64 requires non-negative values`,
      };
    }
    if (!isValidU64(bigVal)) {
      return {
        success: false,
        error: `Value ${value} exceeds u64 max (${U64_MAX})`,
      };
    }

    // Use nativeToScVal with explicit type for proper 64-bit handling
    const scVal = nativeToScVal(bigVal, { type: "u64" });
    return { success: true, value: scVal };
  } catch (err) {
    return {
      success: false,
      error: `Failed to convert ${value} to ScVal u64: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Converts a JavaScript number or bigint to an ScVal i64.
 *
 * @param value - Number or bigint in range [-2^63, 2^63 - 1]
 * @returns ConversionResult with the ScVal or an error message
 */
export function numberToScValI64(value: number | bigint): ConversionResult {
  try {
    const bigVal =
      typeof value === "bigint" ? value : BigInt(Math.floor(value as number));

    const I64_MIN = BigInt("-9223372036854775808");
    const I64_MAX = BigInt("9223372036854775807");

    if (bigVal < I64_MIN || bigVal > I64_MAX) {
      return {
        success: false,
        error: `Value ${value} is out of i64 range [${I64_MIN}, ${I64_MAX}]`,
      };
    }

    const scVal = nativeToScVal(bigVal, { type: "i64" });
    return { success: true, value: scVal };
  } catch (err) {
    return {
      success: false,
      error: `Failed to convert ${value} to ScVal i64: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Converts a number or bigint to ScVal u128.
 */
export function numberToScValU128(value: number | bigint): ConversionResult {
  try {
    const bigVal =
      typeof value === "bigint" ? value : BigInt(Math.floor(value as number));
    if (bigVal < BigInt(0)) {
      return {
        success: false,
        error: `Value ${value} is negative; u128 requires non-negative values`,
      };
    }
    const scVal = nativeToScVal(bigVal, { type: "u128" });
    return { success: true, value: scVal };
  } catch (err) {
    return {
      success: false,
      error: `Failed to convert ${value} to ScVal u128: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Converts a number or bigint to ScVal i128.
 */
export function numberToScValI128(value: number | bigint): ConversionResult {
  try {
    const bigVal =
      typeof value === "bigint" ? value : BigInt(Math.floor(value as number));
    const scVal = nativeToScVal(bigVal, { type: "i128" });
    return { success: true, value: scVal };
  } catch (err) {
    return {
      success: false,
      error: `Failed to convert ${value} to ScVal i128: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── String Conversions ─────────────────────────────────────────────────────

/**
 * Converts a JavaScript string to an ScVal string.
 *
 * @param value - The string to convert
 * @returns ConversionResult with the ScVal or an error message
 *
 * @example
 * ```ts
 * const result = stringToScVal("XLM");
 * // result.value → xdr.ScVal.scvString("XLM")
 * ```
 */
export function stringToScVal(value: string): ConversionResult {
  try {
    if (typeof value !== "string") {
      return {
        success: false,
        error: `Expected string but received ${typeof value}`,
      };
    }
    if (!isValidScString(value)) {
      return {
        success: false,
        error: `String exceeds maximum length of ${MAX_STRING_LENGTH} bytes`,
      };
    }
    return { success: true, value: xdr.ScVal.scvString(value) };
  } catch (err) {
    return {
      success: false,
      error: `Failed to convert string to ScVal: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Converts a JavaScript string to an ScVal symbol.
 * Symbols are limited to 32 characters and must be alphanumeric + underscore.
 *
 * @param value - The symbol string to convert
 * @returns ConversionResult with the ScVal or an error message
 */
export function stringToScValSymbol(value: string): ConversionResult {
  try {
    if (typeof value !== "string") {
      return {
        success: false,
        error: `Expected string but received ${typeof value}`,
      };
    }
    if (!isValidSymbol(value)) {
      return {
        success: false,
        error: `Invalid symbol "${value}": must be 1-${MAX_SYMBOL_LENGTH} chars, alphanumeric/underscore, starting with letter or underscore`,
      };
    }
    return { success: true, value: xdr.ScVal.scvSymbol(value) };
  } catch (err) {
    return {
      success: false,
      error: `Failed to convert symbol to ScVal: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Boolean Conversion ─────────────────────────────────────────────────────

/**
 * Converts a JavaScript boolean to an ScVal bool.
 */
export function boolToScVal(value: boolean): ConversionResult {
  try {
    if (typeof value !== "boolean") {
      return {
        success: false,
        error: `Expected boolean but received ${typeof value}`,
      };
    }
    return { success: true, value: xdr.ScVal.scvBool(value) };
  } catch (err) {
    return {
      success: false,
      error: `Failed to convert boolean to ScVal: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Address Conversion ─────────────────────────────────────────────────────

/**
 * Converts a Stellar address string (G... or C...) to an ScVal address.
 *
 * Uses `Address.fromString()` internally, which handles both account
 * addresses (G...) and contract addresses (C...).
 *
 * @param address - A valid 56-character Stellar address
 * @returns ConversionResult with the ScVal or an error message
 *
 * @example
 * ```ts
 * const result = addressToScVal("GABC...XYZ");
 * // result.value → xdr.ScVal.scvAddress(...)
 * ```
 */
export function addressToScVal(address: string): ConversionResult {
  try {
    if (typeof address !== "string") {
      return {
        success: false,
        error: `Expected string address but received ${typeof address}`,
      };
    }

    const trimmed = address.trim();

    if (!isValidStellarAddress(trimmed)) {
      return {
        success: false,
        error: `Invalid Stellar address: "${trimmed}". Must be a 56-character G... (account) or C... (contract) address`,
      };
    }

    const addr = Address.fromString(trimmed);
    return { success: true, value: addr.toScVal() };
  } catch (err) {
    return {
      success: false,
      error: `Failed to convert address "${address}" to ScVal: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Map / Object Conversion ────────────────────────────────────────────────

/**
 * Converts a JavaScript object to an ScVal map.
 *
 * Keys are converted to ScVal symbols, values are recursively converted
 * using `toScVal()` with optional type hints.
 *
 * @param obj - Plain object to convert
 * @param valueTypes - Optional type hints for individual keys
 * @returns ConversionResult with the ScVal or an error message
 *
 * @example
 * ```ts
 * const result = objectToScValMap(
 *   { count: 42, name: "test" },
 *   { count: 'u32', name: 'string' }
 * );
 * ```
 */
export function objectToScValMap(
  obj: Record<string, unknown>,
  valueTypes?: Record<string, ScValTargetType>,
): ConversionResult {
  try {
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
      return {
        success: false,
        error: `Expected plain object but received ${Array.isArray(obj) ? "array" : typeof obj}`,
      };
    }

    const entries = Object.entries(obj);
    const mapEntries: xdr.ScMapEntry[] = [];

    for (const [key, value] of entries) {
      // Keys are always symbols
      const keyResult = stringToScValSymbol(key);
      if (isConversionError(keyResult)) {
        return {
          success: false,
          error: `Failed to convert map key "${key}": ${keyResult.error}`,
        };
      }

      // Get the type hint for this key, or infer it
      const typeHint = valueTypes?.[key];
      const valResult = toScVal(value, typeHint);
      if (isConversionError(valResult)) {
        return {
          success: false,
          error: `Failed to convert map value for key "${key}": ${valResult.error}`,
        };
      }

      mapEntries.push(
        new xdr.ScMapEntry({
          key: keyResult.value,
          val: valResult.value,
        }),
      );
    }

    return { success: true, value: xdr.ScVal.scvMap(mapEntries) };
  } catch (err) {
    return {
      success: false,
      error: `Failed to convert object to ScVal map: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Array / Vector Conversion ──────────────────────────────────────────────

/**
 * Converts a JavaScript array to an ScVal vector.
 *
 * Each element is recursively converted using `toScVal()`.
 *
 * @param arr - Array of values to convert
 * @param elementType - Optional type hint applied to all elements
 * @returns ConversionResult with the ScVal or an error message
 */
export function arrayToScValVec(
  arr: unknown[],
  elementType?: ScValTargetType,
): ConversionResult {
  try {
    if (!Array.isArray(arr)) {
      return {
        success: false,
        error: `Expected array but received ${typeof arr}`,
      };
    }

    const elements: xdr.ScVal[] = [];
    for (let i = 0; i < arr.length; i++) {
      const elResult = toScVal(arr[i], elementType);
      if (isConversionError(elResult)) {
        return {
          success: false,
          error: `Failed to convert array element at index ${i}: ${elResult.error}`,
        };
      }
      elements.push(elResult.value);
    }

    return { success: true, value: xdr.ScVal.scvVec(elements) };
  } catch (err) {
    return {
      success: false,
      error: `Failed to convert array to ScVal vec: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Unified Converter ─────────────────────────────────────────────────────

/**
 * Universal converter from JavaScript values to Soroban ScVal types.
 *
 * When `type` is specified, performs an explicit conversion to the given
 * ScVal type with full validation. When `type` is omitted, infers the
 * target type from the JavaScript value:
 *
 * | JS Type   | Inferred ScVal Type        |
 * |-----------|---------------------------|
 * | number    | scvU32 (≤ u32 max) or scvU64 |
 * | bigint    | scvU64                    |
 * | string    | scvString                 |
 * | boolean   | scvBool                   |
 * | array     | scvVec                    |
 * | object    | scvMap                    |
 *
 * @param value - The JavaScript value to convert
 * @param type  - Optional explicit target ScVal type
 * @returns ConversionResult with the ScVal or an error message
 *
 * @example
 * ```ts
 * // Explicit type
 * toScVal(42, 'u32');          // → ScVal.scvU32(42)
 * toScVal(1000000, 'u64');     // → ScVal.scvU64(1000000n)
 * toScVal("hello", 'string');  // → ScVal.scvString("hello")
 *
 * // Inferred type
 * toScVal(42);                 // → ScVal.scvU32(42)
 * toScVal("hello");            // → ScVal.scvString("hello")
 * toScVal(true);               // → ScVal.scvBool(true)
 * ```
 */
export function toScVal(
  value: unknown,
  type?: ScValTargetType,
): ConversionResult {
  try {
    // Explicit type conversion
    if (type) {
      switch (type) {
        case "u32":
          return numberToScValU32(value as number);
        case "i32":
          return numberToScValI32(value as number);
        case "u64":
          return numberToScValU64(value as number | bigint);
        case "i64":
          return numberToScValI64(value as number | bigint);
        case "u128":
          return numberToScValU128(value as number | bigint);
        case "i128":
          return numberToScValI128(value as number | bigint);
        case "string":
          return stringToScVal(value as string);
        case "symbol":
          return stringToScValSymbol(value as string);
        case "bool":
          return boolToScVal(value as boolean);
        case "address":
          return addressToScVal(value as string);
        case "bytes":
          return bytesToScVal(value as Buffer | Uint8Array);
        case "vec":
          return arrayToScValVec(value as unknown[]);
        case "map":
          return objectToScValMap(value as Record<string, unknown>);
        default: {
          const _exhaustive: never = type;
          return {
            success: false,
            error: `Unsupported ScVal type: ${_exhaustive}`,
          };
        }
      }
    }

    // Type inference
    if (value === null || value === undefined) {
      return { success: true, value: xdr.ScVal.scvVoid() };
    }

    if (typeof value === "boolean") {
      return boolToScVal(value);
    }

    if (typeof value === "number") {
      // Use u32 for small non-negative integers, u64 for larger ones
      if (Number.isInteger(value) && value >= 0 && value <= U32_MAX) {
        return numberToScValU32(value);
      }
      return numberToScValU64(value);
    }

    if (typeof value === "bigint") {
      return numberToScValU64(value);
    }

    if (typeof value === "string") {
      return stringToScVal(value);
    }

    if (Array.isArray(value)) {
      return arrayToScValVec(value);
    }

    if (typeof value === "object" && !Buffer.isBuffer(value)) {
      return objectToScValMap(value as Record<string, unknown>);
    }

    if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
      return bytesToScVal(value);
    }

    return {
      success: false,
      error: `Cannot infer ScVal type for value of type ${typeof value}`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Unexpected error in toScVal: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Bytes Conversion ───────────────────────────────────────────────────────

/**
 * Converts a Buffer or Uint8Array to an ScVal bytes.
 */
export function bytesToScVal(value: Buffer | Uint8Array): ConversionResult {
  try {
    const buf = Buffer.isBuffer(value) ? value : Buffer.from(value);
    return { success: true, value: xdr.ScVal.scvBytes(buf) };
  } catch (err) {
    return {
      success: false,
      error: `Failed to convert bytes to ScVal: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── ScVal → Native ─────────────────────────────────────────────────────────

/**
 * Converts an ScVal back to its native JavaScript representation.
 * Wrapper around the SDK's `scValToNative` with error handling.
 *
 * @param scVal - The ScVal to convert back to native JS
 * @returns The native JS value or null on error
 */
export function fromScVal(scVal: xdr.ScVal): unknown {
  try {
    return scValToNative(scVal);
  } catch (err) {
    console.error(
      "Failed to convert ScVal to native:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

// ─── Stellar Amount Helpers ─────────────────────────────────────────────────

/**
 * Number of stroops in one lumen. Stroops are the smallest unit (1e-7).
 */
export const STROOPS_PER_LUMEN = 10_000_000n;

/**
 * Converts a lumen amount (as a string or number) to stroops as a BigInt.
 *
 * @param amount - Lumen amount, e.g. "123.4567890" or 100.5
 * @returns BigInt stroops, or null when the amount is not valid.
 */
export function lumensToStroops(amount: string | number): bigint | null {
  try {
    const normalized =
      typeof amount === "number" ? amount.toFixed(7) : amount.trim();
    if (normalized.length === 0) return null;

    const negative = normalized.startsWith("-");
    const unsigned = negative ? normalized.slice(1) : normalized;
    const [wholePart, fractionPart = ""] = unsigned.split(".");

    if (!/^\d+$/.test(wholePart) || !/^\d*$/.test(fractionPart)) {
      return null;
    }

    if (fractionPart.length > 7) {
      return null;
    }

    const paddedFraction = fractionPart.padEnd(7, "0");
    const stroops =
      BigInt(wholePart) * STROOPS_PER_LUMEN + BigInt(paddedFraction || "0");
    return negative ? -stroops : stroops;
  } catch {
    return null;
  }
}

/**
 * Converts stroops to a lumen amount string with up to 7 decimal places.
 *
 * @param stroops - Stroop value as bigint, number, or numeric string
 * @returns Decimal lumen string, or null for invalid input.
 */
export function stroopsToLumens(
  stroops: bigint | number | string,
): string | null {
  try {
    const value = BigInt(stroops);
    const sign = value < 0n ? "-" : "";
    const abs = value < 0n ? -value : value;
    const whole = abs / STROOPS_PER_LUMEN;
    const fraction = abs % STROOPS_PER_LUMEN;

    if (fraction === 0n) {
      return `${sign}${whole.toString()}`;
    }

    const fractionStr = fraction.toString().padStart(7, "0").replace(/0+$/, "");
    return `${sign}${whole.toString()}.${fractionStr}`;
  } catch {
    return null;
  }
}

// ─── Soroban RPC Helpers ────────────────────────────────────────────────────

export type SimulateTransactionResponse = Awaited<
  ReturnType<typeof SorobanRpc.Server.prototype.simulateTransaction>
>;

type SendTransactionResponse = Awaited<
  ReturnType<typeof SorobanRpc.Server.prototype.sendTransaction>
>;

type GetTransactionResponse = Awaited<
  ReturnType<typeof SorobanRpc.Server.prototype.getTransaction>
>;

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

const sorobanServers = new Map<string, SorobanRpc.Server>();

function getSorobanServer(rpcUrl: string): SorobanRpc.Server {
  const cachedServer = sorobanServers.get(rpcUrl);
  if (cachedServer) {
    return cachedServer;
  }

  const server = new SorobanRpc.Server(rpcUrl, { allowHttp: true });
  sorobanServers.set(rpcUrl, server);
  return server;
}

const inFlightSimulationRequests = new Map<
  string,
  Promise<SimulateSorobanTransactionResult>
>();

export function clearSorobanSimulationRequestCache(): void {
  inFlightSimulationRequests.clear();
}

export interface SorobanTransactionContext {
  rpcUrl: string;
  networkPassphrase: string;
  sourceAddress: string;
  contractId: string;
  method: string;
  args?: unknown[];
  argTypes?: ScValTargetType[];
}

export interface SimulateSorobanTransactionOptions {
  fee?: string | number;
  timeoutInSeconds?: number;
  requestTimeoutMs?: number;
}

export interface SimulateSorobanTransactionResult {
  transaction: Transaction;
  preparedTransaction: Transaction;
  simulation: SimulateTransactionResponse;
}

export async function simulateSorobanTransaction(
  context: SorobanTransactionContext,
  options: SimulateSorobanTransactionOptions = {},
): Promise<SimulateSorobanTransactionResult> {
  const scVals: xdr.ScVal[] = [];
  if (context.args) {
    for (let i = 0; i < context.args.length; i++) {
      const converted = toScVal(context.args[i], context.argTypes?.[i]);
      if (isConversionError(converted)) {
        throw new Error(
          `Invalid ScVal argument at index ${i}: ${converted.error}`,
        );
      }
      scVals.push(converted.value);
    }
  }

  const argsKey = scVals.map((scVal) => scVal.toXDR("base64")).join(",");
  const cacheKey = [
    context.rpcUrl,
    context.networkPassphrase,
    context.sourceAddress,
    context.contractId,
    context.method,
    options.fee !== undefined ? String(options.fee) : "",
    options.timeoutInSeconds !== undefined ? String(options.timeoutInSeconds) : "",
    argsKey,
  ].join("|");

  const cached = inFlightSimulationRequests.get(cacheKey);
  if (cached) {
    return cached;
  }

  const simulationPromise = performSorobanSimulation(
    context,
    options,
    scVals,
  );

  inFlightSimulationRequests.set(cacheKey, simulationPromise);
  try {
    return await simulationPromise;
  } finally {
    inFlightSimulationRequests.delete(cacheKey);
  }
}

async function performSorobanSimulation(
  context: SorobanTransactionContext,
  options: SimulateSorobanTransactionOptions,
  scVals: xdr.ScVal[],
): Promise<SimulateSorobanTransactionResult> {
  const server = getSorobanServer(context.rpcUrl);

  const sourceAccount = await withTimeout(
    server.getAccount(context.sourceAddress),
    options.requestTimeoutMs ?? 10_000,
    "Soroban account request timed out",
  );

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: options.fee !== undefined ? String(options.fee) : BASE_FEE,
    networkPassphrase: context.networkPassphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contractId: context.contractId,
        function: context.method,
        args: scVals,
      }),
    )
    .setTimeout(options.timeoutInSeconds ?? 0)
    .build();

  const simulation = await withTimeout(
    server.simulateTransaction(transaction),
    options.requestTimeoutMs ?? 10_000,
    "Soroban simulation timed out",
  );

  if ("error" in simulation && typeof simulation.error === "string") {
    throw new Error(`Soroban simulation error: ${simulation.error}`);
  }

  const preparedTransaction = SorobanRpc.assembleTransaction(
    transaction,
    simulation,
  ).build();

  return { transaction, preparedTransaction, simulation };
}

// ─── Soroban Transaction Signing/Submission ─────────────────────────────────

interface FreighterSigner {
  signTransaction(
    transactionXdr: string,
    options: { networkPassphrase: string },
  ): Promise<string>;
  isConnected?: () => Promise<boolean>;
  getPublicKey?: () => Promise<string>;
  requestAccess?: () => Promise<boolean>;
}

function getFreighterSigner(): FreighterSigner | null {
  const globalRef = globalThis as unknown as { freighter?: FreighterSigner };
  return globalRef.freighter ?? null;
}

function isFreighterConnected(connected: boolean): boolean {
  return connected === true;
}

export async function ensureFreighterConnected(): Promise<void> {
  const freighter = getFreighterSigner();
  if (!freighter) {
    throw new Error(
      "Freighter wallet is not available. Please install Freighter.",
    );
  }

  if (typeof freighter.isConnected === "function") {
    const connected = await freighter.isConnected();
    if (isFreighterConnected(connected)) {
      return;
    }
  }

  if (typeof freighter.requestAccess === "function") {
    const granted = await freighter.requestAccess();
    if (!isFreighterConnected(granted)) {
      throw new Error(
        "Freighter connection was not granted. Please approve the connection.",
      );
    }
    return;
  }

  throw new Error(
    "Freighter is not connected and cannot request access automatically.",
  );
}

export async function getFreighterPublicKey(): Promise<string> {
  const freighter = getFreighterSigner();
  if (!freighter) {
    throw new Error(
      "Freighter wallet is not available. Please install Freighter.",
    );
  }

  await ensureFreighterConnected();

  if (typeof freighter.getPublicKey !== "function") {
    throw new Error("Freighter does not expose getPublicKey().");
  }

  try {
    return await freighter.getPublicKey();
  } catch (err) {
    throw new Error(
      `Failed to read Freighter public key: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function isUserRejection(error: unknown): boolean {
  let message = "";
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  } else if (typeof error === "object" && error !== null) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string") {
      message = maybeMessage;
    }
  }

  return /user rejected|user denied|reject|declined|cancel/i.test(message);
}

export async function signSorobanTransaction(
  transaction: Transaction,
  networkPassphrase: string,
): Promise<Transaction> {
  const freighter = getFreighterSigner();
  if (!freighter) {
    throw new Error(
      "Freighter wallet is not available. Please install Freighter.",
    );
  }

  await ensureFreighterConnected();

  try {
    const signedXdr = await freighter.signTransaction(transaction.toXDR(), {
      networkPassphrase,
    });
    return TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
  } catch (err) {
    if (isUserRejection(err)) {
      throw new Error("Transaction signature was rejected by the user.");
    }
    throw err;
  }
}

export interface SorobanSendOptions {
  requestTimeoutMs?: number;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
  backoffFactor?: number;
  maxPollIntervalMs?: number;
}

export async function sendSorobanTransaction(
  rpcUrl: string,
  signedTransaction: Transaction,
  options: SorobanSendOptions = {},
): Promise<string> {
  const server = getSorobanServer(rpcUrl);

  const sendResponse = await withTimeout(
    server.sendTransaction(signedTransaction),
    options.requestTimeoutMs ?? 15_000,
    "Soroban send transaction timed out",
  );

  if (sendResponse.status === "ERROR") {
    const errorResult = (sendResponse as SendTransactionResponse & {
      errorResult?: unknown;
    }).errorResult;

    throw new Error(
      errorResult !== undefined
        ? `Soroban submission rejected: ${String(errorResult)}`
        : "Soroban transaction submission failed",
    );
  }

  const transactionHash = sendResponse.hash;

  if (sendResponse.status === "DUPLICATE") {
    return transactionHash;
  }

  const pollIntervalMs = options.pollIntervalMs ?? 1_000;
  const maxPollAttempts = options.maxPollAttempts ?? 30;
  const backoffFactor = options.backoffFactor ?? 1.5;
  const maxPollIntervalMs = options.maxPollIntervalMs ?? 5_000;
  let currentPollIntervalMs = pollIntervalMs;

  for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
    await new Promise<void>((resolve) =>
      setTimeout(resolve, currentPollIntervalMs),
    );
    const getResponse = await withTimeout(
      server.getTransaction(transactionHash),
      options.requestTimeoutMs ?? 10_000,
      "Soroban getTransaction timed out",
    );

    if (getResponse.status === "SUCCESS") {
      return transactionHash;
    }

    if (getResponse.status === "FAILED") {
      throw new Error(
        `Soroban transaction ${transactionHash} failed on-chain`,
      );
    }

    currentPollIntervalMs = Math.min(
      maxPollIntervalMs,
      currentPollIntervalMs * backoffFactor,
    );
  }

  throw new Error(
    `Timed out waiting for Soroban transaction ${transactionHash} to confirm`,
  );
}

export interface SorobanInvokeOptions {
  rpcUrl: string;
  networkPassphrase: string;
  sourceAddress?: string;
  contractId: string;
  method: string;
  args?: unknown[];
  argTypes?: ScValTargetType[];
  fee?: string | number;
  timeoutInSeconds?: number;
  simulationTimeoutMs?: number;
  sendTimeoutMs?: number;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
  backoffFactor?: number;
  maxPollIntervalMs?: number;
}

export interface SorobanInvokeResult {
  transactionHash: string;
  simulation: SimulateTransactionResponse;
}

export async function invokeSorobanContract(
  options: SorobanInvokeOptions,
): Promise<SorobanInvokeResult> {
  const sourceAddress =
    options.sourceAddress ?? (await getFreighterPublicKey());

  const { preparedTransaction, simulation } =
    await simulateSorobanTransaction(
      {
        rpcUrl: options.rpcUrl,
        networkPassphrase: options.networkPassphrase,
        sourceAddress,
        contractId: options.contractId,
        method: options.method,
        args: options.args,
        argTypes: options.argTypes,
      },
      {
        fee: options.fee,
        timeoutInSeconds: options.timeoutInSeconds,
        requestTimeoutMs: options.simulationTimeoutMs,
      },
    );

  const signedTransaction = await signSorobanTransaction(
    preparedTransaction,
    options.networkPassphrase,
  );

  const transactionHash = await sendSorobanTransaction(
    options.rpcUrl,
    signedTransaction,
    {
      requestTimeoutMs: options.sendTimeoutMs,
      pollIntervalMs: options.pollIntervalMs,
      maxPollAttempts: options.maxPollAttempts,
      backoffFactor: options.backoffFactor,
      maxPollIntervalMs: options.maxPollIntervalMs,
    },
  );

  return { transactionHash, simulation };
}