/**
 * Rate limiting utility for API notification endpoints.
 *
 * Tracks request counts per key in KV storage with sliding/fixed window support.
 */

import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet } from "./kv";
import { logger } from "@/app/utils/logger";

const log = logger.child("api:notifications:rateLimit");

export interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
  /**
   * Set when the request was denied because the KV backend could not be
   * reached, not because the caller exceeded the limit. Callers use this to
   * answer 503 (limiter unavailable) instead of 429 (over the limit).
   */
  unavailable?: boolean;
}

// Default rate limits
export const SUBSCRIBE_IP_LIMIT = 5; // 5 requests
export const SUBSCRIBE_IP_WINDOW = 60; // per 60 seconds

export const SUBSCRIBE_EMAIL_IP_LIMIT = 5; // 5 requests
export const SUBSCRIBE_EMAIL_IP_WINDOW = 60; // per 60 seconds

export const SUBSCRIBE_EMAIL_TARGET_LIMIT = 3; // 3 requests
export const SUBSCRIBE_EMAIL_TARGET_WINDOW = 60; // per 60 seconds

// Per-target limit for the push subscribe route, so one wallet cannot be
// pushed at by many different source IPs.
export const SUBSCRIBE_WALLET_LIMIT = 10; // 10 requests
export const SUBSCRIBE_WALLET_WINDOW = 60; // per 60 seconds

// PUT /api/notifications/preferences/:wallet
export const PREFERENCES_IP_LIMIT = 30;
export const PREFERENCES_IP_WINDOW = 60;
export const PREFERENCES_WALLET_LIMIT = 20;
export const PREFERENCES_WALLET_WINDOW = 60;

// POST /api/notifications/unsubscribe
export const UNSUBSCRIBE_IP_LIMIT = 10;
export const UNSUBSCRIBE_IP_WINDOW = 60;
export const UNSUBSCRIBE_TARGET_LIMIT = 5;
export const UNSUBSCRIBE_TARGET_WINDOW = 60;

// GET /api/notifications/confirm-email (state-changing: it activates a
// subscription, so it is throttled like a write).
export const CONFIRM_EMAIL_IP_LIMIT = 20;
export const CONFIRM_EMAIL_IP_WINDOW = 60;
export const CONFIRM_EMAIL_TOKEN_LIMIT = 10;
export const CONFIRM_EMAIL_TOKEN_WINDOW = 60;

/**
 * Retry-After advertised when the limiter itself is unavailable.
 */
export const RATE_LIMIT_UNAVAILABLE_RETRY_SECONDS = 30;

/**
 * Extracts the client's IP address from a NextRequest.
 */
export function getClientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const firstIp = xff.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp?.trim()) {
    return xRealIp.trim();
  }

  if (request.ip?.trim()) {
    return request.ip.trim();
  }

  return "127.0.0.1";
}

/**
 * Checks and updates rate limit counter for a specific key in KV.
 *
 * @param key KV key for rate limiting (e.g. `ratelimit:ip:subscribe:1.2.3.4`)
 * @param limit Maximum allowed requests within the time window
 * @param windowSeconds Time window duration in seconds
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  // Fail closed. If KV cannot be read or written the limiter cannot know how
  // many requests have already been served, so it denies rather than letting
  // an unbounded number of requests through. A read failure that fell back to
  // "no record" would reset every counter and silently disable the limit.
  try {
    return await checkRateLimitUnsafe(key, limit, windowSeconds);
  } catch (err) {
    log.error("rate limit backend unavailable; failing closed", { key, err });
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds: RATE_LIMIT_UNAVAILABLE_RETRY_SECONDS,
      unavailable: true,
    };
  }
}

async function checkRateLimitUnsafe(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const record = await kvGet<RateLimitRecord>(key);

  if (!record || now >= record.resetAt) {
    const resetAt = now + windowSeconds * 1000;
    await kvSet(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: limit - 1,
      resetInSeconds: windowSeconds,
    };
  }

  if (record.count >= limit) {
    const resetInSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds,
    };
  }

  const updatedCount = record.count + 1;
  await kvSet(key, { count: updatedCount, resetAt: record.resetAt });
  return {
    allowed: true,
    remaining: limit - updatedCount,
    resetInSeconds: Math.max(1, Math.ceil((record.resetAt - now) / 1000)),
  };
}

/**
 * Turns a denied result into the right response, or null when allowed.
 *
 * 429 means "you are over the limit"; 503 means "the limiter could not run".
 * Both deny the request, so an unavailable KV can never be used to bypass
 * throttling.
 */
export function rateLimitDenialResponse(
  result: RateLimitResult,
  message?: string,
): NextResponse | null {
  if (result.allowed) {
    return null;
  }
  if (result.unavailable) {
    return rateLimitUnavailableResponse();
  }
  return rateLimitResponse(result.resetInSeconds, message);
}

/**
 * Returns a 503 when the rate limiter's backing store is unavailable. The
 * request is refused, so this is a fail-closed answer, not a fail-open one.
 */
export function rateLimitUnavailableResponse(): NextResponse {
  return NextResponse.json(
    {
      error: "Rate limiting is temporarily unavailable. Please try again later.",
      code: "RATE_LIMIT_UNAVAILABLE",
    },
    {
      status: 503,
      headers: {
        "Retry-After": RATE_LIMIT_UNAVAILABLE_RETRY_SECONDS.toString(),
      },
    },
  );
}

/**
 * Returns a 429 Too Many Requests response with Retry-After header.
 */
export function rateLimitResponse(
  resetInSeconds: number,
  message = "Too many requests. Please try again later.",
): NextResponse {
  return NextResponse.json(
    { error: message },
    {
      status: 429,
      headers: {
        "Retry-After": Math.max(1, resetInSeconds).toString(),
      },
    },
  );
}
