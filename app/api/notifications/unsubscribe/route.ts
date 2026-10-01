/**
 * POST /api/notifications/unsubscribe
 *
 * Allows a user to unsubscribe from a specific notification channel.
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  SECURITY NOTE (fixes #608)                                     ║
 * ║                                                                  ║
 * ║  The previous implementation accepted a bare walletAddress +    ║
 * ║  channel pair with no authentication, letting any caller        ║
 * ║  silently unsubscribe any other user.                           ║
 * ║                                                                  ║
 * ║  This version removes that path entirely.  Only two mechanisms  ║
 * ║  are accepted:                                                   ║
 * ║                                                                  ║
 * ║  1. Token path (used in email/SMS "unsubscribe" links):         ║
 * ║     { token, channel }                                           ║
 * ║     The token must exist in the token store, must not be        ║
 * ║     expired, must match the requested channel, and is           ║
 * ║     deleted immediately on first use (single-use).              ║
 * ║                                                                  ║
 * ║  2. Proof-of-address path (used in the authenticated UI):       ║
 * ║     { walletAddress, signature, nonce, channel }                 ║
 * ║     Same Ed25519 challenge/response used by the preferences     ║
 * ║     route.  If you only need one path, use the token path.      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Request body – token path (for email/SMS unsubscribe links):
 *   {
 *     "token":   "<single-use token>",
 *     "channel": "email" | "sms" | "push"
 *   }
 *
 * Request body – proof-of-address path (authenticated UI):
 *   {
 *     "walletAddress": "G…",
 *     "signature":     "<base64-encoded Ed25519 sig>",
 *     "nonce":         "<random nonce embedded in signed message>",
 *     "channel":       "email" | "sms" | "push"
 *   }
 *
 * Responses:
 *   200 { success: true, walletAddress, channel }
 *   400 Missing / invalid fields
 *   401 Invalid token, expired token, wrong channel, or bad signature
 *   405 Method not allowed (bare walletAddress path rejected)
 */

import { NextRequest, NextResponse } from "next/server";
import { Keypair, StrKey } from "stellar-sdk";
import { kvGet, kvSet, kvSRem, SUB_KEY, PERIOD_KEY } from "../_lib/kv";
import type { SubscriptionRecord } from "@/app/types/notifications";
import { logger } from "@/app/utils/logger";
import { apiError, internalApiError } from "@/app/api/_lib/apiError";
import {
  getClientIp,
  checkRateLimit,
  rateLimitDenialResponse,
  UNSUBSCRIBE_IP_LIMIT,
  UNSUBSCRIBE_IP_WINDOW,
  UNSUBSCRIBE_TARGET_LIMIT,
  UNSUBSCRIBE_TARGET_WINDOW,
} from "../_lib/rateLimit";
import { consumeToken, type Channel } from "@/app/api/notifications/tokenStore";

const VALID_PERIODS = ["weekly", "monthly", "yearly"] as const;
const VALID_CHANNELS = new Set<Channel>(["email", "sms", "push"]);
const CHALLENGE_PREFIX = "stellar-wrap-notifications-unsubscribe:";
const NONCE_RE = /^[A-Za-z0-9_\-]{1,128}$/;
const usedNonces = new Set<string>();

/** Remove email-specific period indexes if push is not subscribed to those periods. */
async function removeEmailPeriodIndexes(walletAddress: string, record: SubscriptionRecord) {
  const emailPeriods = record.email?.periods;
  const pushPeriods = record.push?.periods;
  if (!emailPeriods) return;

  const ops = VALID_PERIODS.map((period) => {
    if (emailPeriods[period] && !pushPeriods?.[period]) {
      return kvSRem(PERIOD_KEY(period), walletAddress);
    }
    return Promise.resolve();
  });
  await Promise.all(ops);
}

/** Remove push-specific period indexes if email is not subscribed to those periods. */
async function removePushPeriodIndexes(walletAddress: string, record: SubscriptionRecord) {
  const pushPeriods = record.push?.periods;
  const emailPeriods = record.email?.periods;
  if (!pushPeriods) return;

  const ops = VALID_PERIODS.map((period) => {
    if (pushPeriods[period] && !emailPeriods?.[period]) {
      return kvSRem(PERIOD_KEY(period), walletAddress);
    }
    return Promise.resolve();
  });
  await Promise.all(ops);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // IP-based rate limiting
    const ipDenial = rateLimitDenialResponse(
      await checkRateLimit(
        `ratelimit:ip:unsubscribe:${getClientIp(request)}`,
        UNSUBSCRIBE_IP_LIMIT,
        UNSUBSCRIBE_IP_WINDOW,
      ),
    );
    if (ipDenial) return ipDenial;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError("INVALID_JSON", "Invalid JSON body", 400);
    }

    const fields = (body ?? {}) as Record<string, unknown>;

    // Target-based rate limiting (prevents brute force of tokens / wallet addresses)
    const target = fields.token ?? fields.walletAddress ?? "";
    if (target) {
      const targetDenial = rateLimitDenialResponse(
        await checkRateLimit(
          `ratelimit:target:unsubscribe:${target}`,
          UNSUBSCRIBE_TARGET_LIMIT,
          UNSUBSCRIBE_TARGET_WINDOW,
        ),
      );
      if (targetDenial) return targetDenial;
    }

    // ── Guard: reject bare walletAddress path (the original insecure path) ───
    if (fields.walletAddress && !fields.token && !fields.signature) {
      return apiError(
        "UNAUTHENTICATED",
        "Unauthenticated unsubscribe is not allowed. " +
          "Provide either a single-use token (token + channel) " +
          "or proof-of-address (walletAddress + signature + nonce + channel).",
        401,
      );
    }

    // ── Route to the appropriate authentication path ─────────────────────────
    if (typeof fields.token === "string" && fields.token.trim().length > 0) {
      return handleTokenPath(fields);
    }

    if (
      typeof fields.walletAddress === "string" &&
      typeof fields.signature === "string" &&
      typeof fields.nonce === "string"
    ) {
      return handleProofOfAddressPath(fields);
    }

    return apiError(
      "INVALID_REQUEST",
      "Request must include either { token, channel } " +
        "or { walletAddress, signature, nonce, channel }",
      400,
    );
  } catch (err) {
    return internalApiError(logger, err);
  }
}

// ─── Token path ─────────────────────────────────────────────────────────────

async function handleTokenPath(fields: Record<string, unknown>): Promise<NextResponse> {
  const { token, channel } = fields;

  if (typeof token !== "string" || token.trim() === "") {
    return apiError("INVALID_TOKEN", "token must be a non-empty string", 400);
  }

  if (!VALID_CHANNELS.has(channel as Channel)) {
    return apiError(
      "INVALID_CHANNEL",
      `channel must be one of: ${[...VALID_CHANNELS].join(", ")}`,
      400,
    );
  }

  const tokenRecord = consumeToken(token.trim(), channel as Channel);
  if (!tokenRecord) {
    return apiError(
      "INVALID_TOKEN",
      "Token is invalid, expired, or was already used. Request a new unsubscribe link.",
      401,
    );
  }

  // Fetch the subscription record for the wallet address stored in the token
  const subscriptionKey = SUB_KEY(tokenRecord.walletAddress);
  const subscription = await kvGet<SubscriptionRecord>(subscriptionKey);
  if (!subscription) {
    return apiError("NOT_FOUND", "No subscription found for this token", 404);
  }

  // Update the record: remove the channel field
  const updated: SubscriptionRecord = { ...subscription };
  if (channel === "email") {
    updated.email = undefined;
    await removeEmailPeriodIndexes(tokenRecord.walletAddress, subscription);
  } else if (channel === "push") {
    updated.push = undefined;
    await removePushPeriodIndexes(tokenRecord.walletAddress, subscription);
  } else if (channel === "sms") {
    // SMS has no period indexing; just remove the field
    // (Assuming SubscriptionRecord has an `sms` field; if not, adjust as needed)
    (updated as Record<string, unknown>).sms = undefined;
  }

  await kvSet(subscriptionKey, updated);

  return NextResponse.json(
    {
      success: true,
      walletAddress: tokenRecord.walletAddress,
      channel,
    },
    { status: 200 },
  );
}

// ─── Proof-of-address path ───────────────────────────────────────────────────

async function handleProofOfAddressPath(fields: Record<string, unknown>): Promise<NextResponse> {
  const { walletAddress, signature, nonce, channel } = fields;

  // Validate wallet address
  let isValidAddress = false;
  try {
    isValidAddress =
      typeof walletAddress === "string" &&
      StrKey.isValidEd25519PublicKey(walletAddress) &&
      walletAddress.startsWith("G") &&
      walletAddress.length === 56;
  } catch {
    isValidAddress = false;
  }

  if (!isValidAddress) {
    return apiError(
      "INVALID_WALLET_ADDRESS",
      "Invalid walletAddress: must be a valid Stellar G-address",
      400,
    );
  }

  // Validate channel
  if (!VALID_CHANNELS.has(channel as Channel)) {
    return apiError(
      "INVALID_CHANNEL",
      `channel must be one of: ${[...VALID_CHANNELS].join(", ")}`,
      400,
    );
  }

  // Validate nonce shape
  if (typeof nonce !== "string" || !NONCE_RE.test(nonce)) {
    return apiError(
      "INVALID_NONCE",
      "Invalid nonce: must be 1–128 alphanumeric/hyphen/underscore characters",
      400,
    );
  }

  // Replay protection
  if (usedNonces.has(nonce)) {
    return apiError("NONCE_USED", "Nonce has already been used", 401);
  }

  // Verify signature
  const message = `${CHALLENGE_PREFIX}${nonce}`;
  const messageBytes = Buffer.from(message, "utf8");

  let signatureBytes: Buffer;
  try {
    signatureBytes = Buffer.from(signature as string, "base64");
  } catch {
    return apiError("INVALID_SIGNATURE", "signature must be a valid base64 string", 400);
  }

  let signatureValid = false;
  try {
    const keypair = Keypair.fromPublicKey(walletAddress as string);
    signatureValid = keypair.verify(messageBytes, signatureBytes);
  } catch {
    signatureValid = false;
  }

  if (!signatureValid) {
    return apiError("SIGNATURE_FAILED", "Signature verification failed", 401);
  }

  usedNonces.add(nonce as string);

  // Fetch the subscription record
  const subscriptionKey = SUB_KEY(walletAddress as string);
  const subscription = await kvGet<SubscriptionRecord>(subscriptionKey);
  if (!subscription) {
    return apiError("NOT_FOUND", "No subscription found", 404);
  }

  // Update the record: remove the channel field
  const updated: SubscriptionRecord = { ...subscription };
  if (channel === "email") {
    updated.email = undefined;
    await removeEmailPeriodIndexes(walletAddress as string, subscription);
  } else if (channel === "push") {
    updated.push = undefined;
    await removePushPeriodIndexes(walletAddress as string, subscription);
  } else if (channel === "sms") {
    (updated as Record<string, unknown>).sms = undefined;
  }

  await kvSet(subscriptionKey, updated);

  return NextResponse.json(
    {
      success: true,
      walletAddress,
      channel,
    },
    { status: 200 },
  );
}
