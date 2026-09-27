/**
 * API route for wrapped data
 * Handles fetching indexed transaction data with caching
 */

import { NextRequest, NextResponse } from "next/server";
import { indexAccount } from "@/app/services/indexerServer";
import { WrapPeriod, PERIODS } from "@/app/utils/indexer";
import { validateStellarAddress } from "@/src/utils/validateStellarAddress";
import { logger } from "@/app/utils/logger";

const log = logger.child("api:wrapped");

/** Structured codes the frontend can branch on without reading raw internals. */
export type WrappedApiErrorCode =
  | "MISSING_ACCOUNT_ID"
  | "INVALID_ACCOUNT_ID"
  | "INVALID_NETWORK"
  | "INVALID_PERIOD"
  | "ACCOUNT_NOT_FOUND"
  | "RATE_LIMITED"
  | "HORIZON_ERROR"
  | "BAD_REQUEST"
  | "WRAPPED_FETCH_FAILED";

function errorResponse(
  status: number,
  error: string,
  code: WrappedApiErrorCode,
  details?: string,
) {
  return NextResponse.json(
    {
      error,
      code,
      ...(details !== undefined && { details }),
    },
    { status },
  );
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitConfig = getRateLimitConfig();

    // 1. Enforce per-IP rate limit
    const clientIp = getClientIp(request);
    const ipRateLimit = await checkRateLimit(`rl:ip:${clientIp}`, {
      windowSeconds: rateLimitConfig.windowSeconds,
      maxRequests: rateLimitConfig.ipMax,
    });

    if (!ipRateLimit.allowed) {
      return rateLimitResponse(
        "IP rate limit exceeded. Please try again later.",
        ipRateLimit.retryAfterSeconds,
        ipRateLimit.limit,
        ipRateLimit.remaining,
        ipRateLimit.resetTime,
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const accountId = searchParams.get("accountId");
    const network =
      (searchParams.get("network") as Network) || "mainnet";
    const rawPeriod = searchParams.get("period");
    const period = (rawPeriod ? rawPeriod.toLowerCase() : "monthly") as WrapPeriod;

    // 2. Validate inputs
    if (!accountId) {
      return errorResponse(
        400,
        "Missing accountId parameter",
        "MISSING_ACCOUNT_ID",
      );
    }

    const validationResult = validateStellarAddress(accountId, network);
    if (!validationResult.isValid) {
      return errorResponse(
        400,
        validationResult.error || "Invalid account ID format",
        "INVALID_ACCOUNT_ID",
      );
    }

    if (!["mainnet", "testnet"].includes(network)) {
      return errorResponse(400, "Invalid network", "INVALID_NETWORK");
    }

    if (!PERIODS[period]) {
      return errorResponse(
        400,
        "Invalid period",
        "INVALID_PERIOD",
        "Valid periods: weekly, monthly, yearly",
      );
    }

    // 3. Enforce per-account rate limit
    const accountRateLimit = await checkRateLimit(`rl:account:${accountId}`, {
      windowSeconds: rateLimitConfig.windowSeconds,
      maxRequests: rateLimitConfig.accountMax,
    });

    if (!accountRateLimit.allowed) {
      return rateLimitResponse(
        "Account rate limit exceeded. Please try again later.",
        accountRateLimit.retryAfterSeconds,
        accountRateLimit.limit,
        accountRateLimit.remaining,
        accountRateLimit.resetTime,
      );
    }

    // Server-safe indexer (no IndexedDB) — returns live Horizon data
    const response = await indexAccount(accountId, network, period);

    return NextResponse.json({
      ...response.result,
      cached: response.fromCache,
      cacheTimestamp: response.cacheTimestamp,
      refreshingInBackground: response.refreshingInBackground,
    });
  } catch (error: unknown) {
    // Detailed errors stay server-side only — never leak to clients
    log.error("Internal error fetching wrapped data:", error);

    // Handle specific error cases
    const err = error as Record<string, unknown>;
    const message = (err?.message as string) || "";
    const statusCode = (err?.statusCode ?? err?.status) as number | undefined;

    // Check for NotFoundError (account doesn't exist on this network)
    if (
      message.includes("Not Found") ||
      message.includes("not found") ||
      statusCode === 404
    ) {
      return errorResponse(
        404,
        "Account not found on this network. Make sure you selected the correct network (mainnet/testnet) where the account exists.",
        "ACCOUNT_NOT_FOUND",
      );
    }

    // Check for rate limiting
    if (statusCode === 429) {
      return errorResponse(
        429,
        "Rate limited. Please try again later.",
        "RATE_LIMITED",
      );
    }

    // Check for timeout errors
    if (
      statusCode === 408 ||
      message.toLowerCase().includes("timeout") ||
      message.toLowerCase().includes("timed out")
    ) {
      return errorResponse(
        408,
        "Network timed out. Please try again later.",
        "HORIZON_ERROR",
      );
    }

    // Check for Horizon server errors
    if (statusCode === 500) {
      return errorResponse(500, "Horizon server error", "HORIZON_ERROR");
    }

    // Check for Bad Request (pagination or other API issues)
    if (message.includes("Bad Request") || statusCode === 400) {
      return errorResponse(400, "Bad request to Horizon API", "BAD_REQUEST");
    }

    return errorResponse(
      500,
      "Failed to fetch wrapped data. Please try again later.",
      "WRAPPED_FETCH_FAILED",
      message,
    );
  }
}

