/**
 * Errors for network-aware contract loading and validation,
 * plus Soroban ContractError code → friendly UI mapping.
 *
 * Codes match stellar-wrap-contract `ContractError` / ERRORS.md:
 * Error(Contract, #N)
 */

export class ContractConfigurationError extends Error {
  constructor(
    message: string,
    public readonly network?: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ContractConfigurationError";
    Object.setPrototypeOf(this, ContractConfigurationError.prototype);
  }
}

export class InvalidContractAddressError extends ContractConfigurationError {
  constructor(address: string, network?: string) {
    super(
      `Invalid contract address${network ? ` for ${network}` : ""}: must be 56 characters, C-prefix, base32.`,
      network
    );
    this.name = "InvalidContractAddressError";
  }
}

/**
 * Thrown when the configured address is the CAAAAA… placeholder.
 * Includes a user-safe message and a developer configuration hint.
 */
export class PlaceholderContractError extends ContractConfigurationError {
  readonly userMessage: string;
  readonly developerHint: string;

  constructor(network: string) {
    const envVar = `NEXT_PUBLIC_CONTRACT_ADDRESS_${network.toUpperCase()}`;
    const userMessage =
      "This network is not ready for minting yet. Contract configuration is missing.";
    const developerHint = `Set ${envVar} (or NEXT_PUBLIC_CONTRACT_ADDRESS) to a real Soroban contract ID. Placeholder CAAAAA… addresses are rejected before wallet signing.`;
    super(`${userMessage} ${developerHint}`, network);
    this.name = "PlaceholderContractError";
    this.userMessage = userMessage;
    this.developerHint = developerHint;
  }
}

export class ContractNotFoundError extends ContractConfigurationError {
  constructor(network: string, cause?: unknown) {
    super(`Contract not found on ${network}.`, network, cause);
    this.name = "ContractNotFoundError";
  }
}

export class ContractValidationError extends ContractConfigurationError {
  constructor(
    message: string,
    network?: string,
    cause?: unknown
  ) {
    super(message, network, cause);
    this.name = "ContractValidationError";
  }
}

export class NetworkMismatchError extends ContractConfigurationError {
  constructor(expected: string, actual: string) {
    super(`Network mismatch: expected ${expected}, got ${actual}.`);
    this.name = "NetworkMismatchError";
  }
}

/** On-chain ContractError variants (stellar-wrap-contract). */
export enum SorobanContractErrorCode {
  AlreadyInitialized = 1,
  NotInitialized = 2,
  Unauthorized = 3,
  WrapAlreadyExists = 4,
  WrapNotFound = 5,
  InvalidSignature = 6,
  InvalidDataHash = 7,
  UserOptedOut = 8,
}

export type SorobanContractErrorName =
  | "AlreadyInitialized"
  | "NotInitialized"
  | "Unauthorized"
  | "WrapAlreadyExists"
  | "WrapNotFound"
  | "InvalidSignature"
  | "InvalidDataHash"
  | "UserOptedOut"
  | "Unknown";

export interface MappedContractError {
  /** Structured code for frontend branching (e.g. toast actions). */
  code: SorobanContractErrorName;
  /** Numeric on-chain code when known. */
  numericCode?: number;
  /** Concise user-facing message for mint/share UI. */
  userMessage: string;
  /** Raw host / SDK message for logs and diagnostics. */
  raw: string;
}

const CONTRACT_ERROR_PATTERN = /Error\(Contract,\s*#(\d+)\)/i;

const USER_MESSAGES: Record<number, { code: SorobanContractErrorName; userMessage: string }> = {
  [SorobanContractErrorCode.AlreadyInitialized]: {
    code: "AlreadyInitialized",
    userMessage: "This contract is already set up.",
  },
  [SorobanContractErrorCode.NotInitialized]: {
    code: "NotInitialized",
    userMessage: "The wrap contract is not ready yet. Please try again later.",
  },
  [SorobanContractErrorCode.Unauthorized]: {
    code: "Unauthorized",
    userMessage: "You are not authorized to complete this action.",
  },
  [SorobanContractErrorCode.WrapAlreadyExists]: {
    code: "WrapAlreadyExists",
    userMessage: "You already minted a wrap for this period.",
  },
  [SorobanContractErrorCode.WrapNotFound]: {
    code: "WrapNotFound",
    userMessage: "No wrap was found for this period.",
  },
  [SorobanContractErrorCode.InvalidSignature]: {
    code: "InvalidSignature",
    userMessage: "Your wrap signature is invalid. Please regenerate and try again.",
  },
  [SorobanContractErrorCode.InvalidDataHash]: {
    code: "InvalidDataHash",
    userMessage: "Wrap data is invalid. Please refresh your wrap and try again.",
  },
  [SorobanContractErrorCode.UserOptedOut]: {
    code: "UserOptedOut",
    userMessage: "You have opted out of wraps. Opt back in to mint again.",
  },
};

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Extract numeric Soroban contract error code from a host/SDK message.
 */
export function extractContractErrorCode(raw: string): number | undefined {
  const match = raw.match(CONTRACT_ERROR_PATTERN);
  if (!match) return undefined;
  const code = Number.parseInt(match[1], 10);
  return Number.isFinite(code) ? code : undefined;
}

/**
 * Map Soroban / SDK errors to a friendly UI message while keeping raw details.
 */
export function mapContractError(error: unknown): MappedContractError {
  const raw = stringifyError(error);
  const numericCode = extractContractErrorCode(raw);
  const mapped = numericCode !== undefined ? USER_MESSAGES[numericCode] : undefined;

  if (mapped) {
    return {
      code: mapped.code,
      numericCode,
      userMessage: mapped.userMessage,
      raw,
    };
  }

  // Heuristic fallbacks when the host message lacks Error(Contract, #N)
  const lower = raw.toLowerCase();
  if (
    lower.includes("wrapalreadyexists") ||
    (lower.includes("already exists") && lower.includes("wrap")) ||
    lower.includes("duplicate wrap")
  ) {
    return {
      code: "WrapAlreadyExists",
      numericCode: SorobanContractErrorCode.WrapAlreadyExists,
      userMessage: USER_MESSAGES[SorobanContractErrorCode.WrapAlreadyExists].userMessage,
      raw,
    };
  }
  if (
    lower.includes("invalidsignature") ||
    lower.includes("invalid signature") ||
    lower.includes("ed25519")
  ) {
    return {
      code: "InvalidSignature",
      numericCode: SorobanContractErrorCode.InvalidSignature,
      userMessage: USER_MESSAGES[SorobanContractErrorCode.InvalidSignature].userMessage,
      raw,
    };
  }
  if (lower.includes("useroptedout") || lower.includes("opted out")) {
    return {
      code: "UserOptedOut",
      numericCode: SorobanContractErrorCode.UserOptedOut,
      userMessage: USER_MESSAGES[SorobanContractErrorCode.UserOptedOut].userMessage,
      raw,
    };
  }

  return {
    code: "Unknown",
    numericCode,
    userMessage: "Something went wrong with the contract. Please try again.",
    raw,
  };
}

/**
 * Convenience helper for mint/share UI — returns only the friendly message.
 */
export function getContractErrorUserMessage(error: unknown): string {
  return mapContractError(error).userMessage;
}
