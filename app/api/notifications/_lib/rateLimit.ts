/**
 * Rate limiting utility for API notification endpoints.
 *
 * Tracks request counts per key in KV storage with sliding/fixed window support.
 */

import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet } from "./kv";

export interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

// Default rate limits
export const SUBSCRIBE_IP_LIMIT = 5; // 5 requests
export const SUBSCRIBE_IP_WINDOW = 60; // per 60 seconds

export const SUBSCRIBE_EMAIL_IP_LIMIT = 5; // 5 requests
export const SUBSCRIBE_EMAIL_IP_WINDOW = 60; // per 60 seconds

export const SUBSCRIBE_EMAIL_TARGET_LIMIT = 3; // 3 requests
export const SUBSCRIBE_EMAIL_TARGET_WINDOW = 60; // per 60 seconds

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
