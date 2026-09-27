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
import { consumeToken, Channel } from "@/app/api/notifications/tokenStore";

/** Valid notification channels */
const VALID_CHANNELS = new Set<Channel>(["email", "sms", "push"]);

/** Prefix used for the proof-of-address signed message */
const CHALLENGE_PREFIX = "stellar-wrap-notifications-unsubscribe:";

/** In-memory replay guard for proof-of-address nonces */
const usedNonces = new Set<string>();

const NONCE_RE = /^[A-Za-z0-9_\-]{1,128}$/;

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const fields = (body ?? {}) as Record<string, unknown>;

  // ── Guard: reject bare walletAddress path (the original insecure path) ───
  //
  // If the caller only supplied walletAddress + channel (no token and no
  // signature), return 401 immediately.  This is the path that issue #608
  // identified as insecure.  It is intentionally rejected rather than silently
  // ignored so that callers learn the correct API.
  if (
    fields.walletAddress &&
    !fields.token &&
    !fields.signature
  ) {
    return NextResponse.json(
      {
        error:
          "Unauthenticated unsubscribe is not allowed. " +
          "Provide either a single-use token (token + channel) " +
          "or proof-of-address (walletAddress + signature + nonce + channel).",
      },
      { status: 401 },
    );
  }

  // ── Route to the appropriate authentication path ─────────────────────────

  if (typeof fields.token === "string" && fields.token.length > 0) {
    return handleTokenPath(fields);
  }

  if (
    typeof fields.walletAddress === "string" &&
    typeof fields.signature === "string" &&
    typeof fields.nonce === "string"
  ) {
    return handleProofOfAddressPath(fields);
  }

  // Neither a token nor proof-of-address fields were supplied
  return NextResponse.json(
    {
      error:
        "Request must include either { token, channel } " +
        "or { walletAddress, signature, nonce, channel }",
    },
    { status: 400 },
  );
}

// ─── Token path ─────────────────────────────────────────────────────────────

function handleTokenPath(
  fields: Record<string, unknown>,
): NextResponse {
  const { token, channel } = fields;

  if (typeof token !== "string" || token.trim() === "") {
    return NextResponse.json(
      { error: "token must be a non-empty string" },
      { status: 400 },
    );
  }

  if (!VALID_CHANNELS.has(channel as Channel)) {
    return NextResponse.json(
      {
        error: `channel must be one of: ${[...VALID_CHANNELS].join(", ")}`,
      },
      { status: 400 },
    );
  }

  // consumeToken deletes the record on first call (single-use) and validates
  // channel scoping + expiry in one atomic operation
  const record = consumeToken(token.trim(), channel as Channel);

  if (!record) {
    // Deliberately vague to prevent channel probing
    return NextResponse.json(
      {
        error:
          "Token is invalid, expired, or was already used. " +
          "Request a new unsubscribe link.",
      },
      { status: 401 },
    );
  }

  // TODO: persist the unsubscribe to your database, e.g.:
  //   await db.notifications.unsubscribe({ walletAddress: record.walletAddress, channel: record.channel });

  return NextResponse.json(
    {
      success: true,
      walletAddress: record.walletAddress,
      channel: record.channel,
    },
    { status: 200 },
  );
}

// ─── Proof-of-address path ───────────────────────────────────────────────────

function handleProofOfAddressPath(
  fields: Record<string, unknown>,
): NextResponse {
  const { walletAddress, signature, nonce, channel } = fields;

  // Validate address
  let isValidAddress = false;
  try {
    isValidAddress =
      typeof walletAddress === "string" &&
      StrKey.isValidEd25519PublicKey(walletAddress) &&
      (walletAddress as string).startsWith("G") &&
      (walletAddress as string).length === 56;
  } catch {
    isValidAddress = false;
  }

  if (!isValidAddress) {
    return NextResponse.json(
      { error: "Invalid walletAddress: must be a valid Stellar G-address" },
      { status: 400 },
    );
  }

  // Validate channel
  if (!VALID_CHANNELS.has(channel as Channel)) {
    return NextResponse.json(
      {
        error: `channel must be one of: ${[...VALID_CHANNELS].join(", ")}`,
      },
      { status: 400 },
    );
  }

  // Validate nonce shape
  if (typeof nonce !== "string" || !NONCE_RE.test(nonce)) {
    return NextResponse.json(
      {
        error:
          "Invalid nonce: must be 1–128 alphanumeric/hyphen/underscore characters",
      },
      { status: 400 },
    );
  }

  // Replay protection
  if (usedNonces.has(nonce as string)) {
    return NextResponse.json(
      { error: "Nonce has already been used" },
      { status: 401 },
    );
  }

  // Verify signature
  const message = `${CHALLENGE_PREFIX}${nonce}`;
  const messageBytes = Buffer.from(message, "utf8");

  let signatureBytes: Buffer;
  try {
    signatureBytes = Buffer.from(signature as string, "base64");
  } catch {
    return NextResponse.json(
      { error: "signature must be a valid base64 string" },
      { status: 400 },
    );
  }

  let signatureValid = false;
  try {
    const keypair = Keypair.fromPublicKey(walletAddress as string);
    signatureValid = keypair.verify(messageBytes, signatureBytes);
  } catch {
    signatureValid = false;
  }

  if (!signatureValid) {
    return NextResponse.json(
      { error: "Signature verification failed" },
      { status: 401 },
    );
  }

  usedNonces.add(nonce as string);

  // TODO: persist the unsubscribe to your database, e.g.:
  //   await db.notifications.unsubscribe({ walletAddress, channel });

  return NextResponse.json(
    {
      success: true,
      walletAddress,
      channel,
    },
    { status: 200 },
  );
}
