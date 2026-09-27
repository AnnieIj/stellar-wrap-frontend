import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet } from "./kv";

export interface RateLimitConfig {
  windowSeconds: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number; // Unix timestamp in milliseconds
  retryAfterSeconds: number;
}

export interface RateLimitEnvConfig {
  windowSeconds: number;
  ipMax: number;
  accountMax: number;
}

interface RateLimitRecord {
  timestamps: number[];
}

/**
 * Parses environment variables for rate limiting configurations with safe fallbacks.
 */
export function getRateLimitConfig(): RateLimitEnvConfig {
  const envWindow = Number(process.env.RATE_LIMIT_WINDOW_SECONDS);
  const envIpMax = Number(process.env.RATE_LIMIT_IP_MAX);
  const envAccountMax = Number(process.env.RATE_LIMIT_ACCOUNT_MAX);

  return {
    windowSeconds:
      Number.isFinite(envWindow) && envWindow > 0 ? envWindow : 60,
    ipMax: Number.isFinite(envIpMax) && envIpMax > 0 ? envIpMax : 30,
    accountMax:
      Number.isFinite(envAccountMax) && envAccountMax > 0 ? envAccountMax : 10,
  };
}

/**
 * Extracts the client IP from standard proxy headers or Next.js request attributes.
 */
export function getClientIp(request: NextRequest): string {
  const headers = request?.headers;
  if (headers && typeof headers.get === "function") {
    const xForwardedFor = headers.get("x-forwarded-for");
    if (xForwardedFor) {
      const firstIp = xForwardedFor.split(",")[0]?.trim();
      if (firstIp) return firstIp;
    }

    const xRealIp = headers.get("x-real-ip");
    if (xRealIp?.trim()) return xRealIp.trim();

    const cfConnectingIp = headers.get("cf-connecting-ip");
    if (cfConnectingIp?.trim()) return cfConnectingIp.trim();
  }

  const requestIp = (request as unknown as { ip?: string })?.ip;
  if (typeof requestIp === "string" && requestIp.trim()) {
    return requestIp.trim();
  }

  return "127.0.0.1";
}


/**
 * Checks and records a request against a sliding-window rate limit stored in KV.
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig,
  now = Date.now(),
): Promise<RateLimitResult> {
  const windowMs = config.windowSeconds * 1000;
  const cutoff = now - windowMs;

  const record = await kvGet<RateLimitRecord>(key);
  const existingTimestamps = Array.isArray(record?.timestamps)
    ? record.timestamps
    : [];

  // Filter out timestamps outside the sliding window
  const validTimestamps = existingTimestamps.filter(
    (t): t is number => typeof t === "number" && t > cutoff,
  );

  if (validTimestamps.length >= config.maxRequests) {
    const oldestTimestamp = validTimestamps[0] ?? now;
    const resetTime = oldestTimestamp + windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetTime - now) / 1000));

    return {
      allowed: false,
      limit: config.maxRequests,
      remaining: 0,
      resetTime,
      retryAfterSeconds,
    };
  }

  // Under limit: record new timestamp
  validTimestamps.push(now);
  await kvSet(key, { timestamps: validTimestamps });

  const oldestTimestamp = validTimestamps[0] ?? now;
  const resetTime = oldestTimestamp + windowMs;
  const remaining = Math.max(0, config.maxRequests - validTimestamps.length);

  return {
    allowed: true,
    limit: config.maxRequests,
    remaining,
    resetTime,
    retryAfterSeconds: 0,
  };
}

/**
 * Formats a 429 Too Many Requests response with standard Retry-After and rate limit headers.
 */
export function rateLimitResponse(
  message: string,
  retryAfterSeconds: number,
  limit?: number,
  remaining?: number,
  resetTime?: number,
): NextResponse {
  const headers = new Headers();
  headers.set("Retry-After", String(retryAfterSeconds));
  if (limit !== undefined) {
    headers.set("X-RateLimit-Limit", String(limit));
  }
  if (remaining !== undefined) {
    headers.set("X-RateLimit-Remaining", String(remaining));
  }
  if (resetTime !== undefined) {
    headers.set("X-RateLimit-Reset", String(Math.ceil(resetTime / 1000)));
  }

  return NextResponse.json(
    {
      error: message,
      code: "RATE_LIMITED" as const,
      retryAfter: retryAfterSeconds,
    },
    {
      status: 429,
      headers,
    },
  );
}
