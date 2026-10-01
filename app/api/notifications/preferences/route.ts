/**
 * POST /api/notifications/preferences
 *
 * Allows a wallet owner to update their notification preferences.
 *
 * Authentication: proof-of-address challenge/response.
 *   The client must provide:
 *     - walletAddress  – the Stellar G-address that owns the preferences
 *     - signature      – a base64-encoded Ed25519 signature of the canonical
 *                        challenge message (see CHALLENGE_PREFIX below)
 *     - nonce          – the nonce that was embedded in the signed message
 *     - preferences    – object describing the desired channel settings
 *
 * The server:
 *  1. Validates the address format (G…, 56 chars).
 *  2. Reconstructs the canonical message: `<CHALLENGE_PREFIX><nonce>`.
 *  3. Verifies the Ed25519 signature against the address's public key.
 *  4. Rejects re-used nonces (replay protection).
 *  5. Persists the preferences (stubbed here – replace with your DB call).
 *
 * Why no token here?
 * The user is actively signed into the app and has their wallet available to
 * sign.  A token would add no security and would unnecessarily complicate the
 * flow for an authenticated session.
 */

import { NextRequest, NextResponse } from "next/server";
import { Keypair, StrKey } from "stellar-sdk";

/** Prefix that must appear at the start of every signed challenge message. */
export const CHALLENGE_PREFIX =
  "stellar-wrap-notifications-preferences:";

/**
 * In-memory nonce replay store.
 * In production use Redis/DynamoDB with a TTL matching your nonce window.
 */
const usedNonces = new Set<string>();

/** Nonce format: any non-empty alphanumeric/hyphen/underscore string ≤ 128 chars */
const NONCE_RE = /^[A-Za-z0-9_\-]{1,128}$/;

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    walletAddress,
    signature,
    nonce,
    preferences,
  } = (body ?? {}) as Record<string, unknown>;

  // ── 1. Input validation ──────────────────────────────────────────────────

  if (
    typeof walletAddress !== "string" ||
    !walletAddress ||
    typeof signature !== "string" ||
    !signature ||
    typeof nonce !== "string" ||
    !nonce ||
    typeof preferences !== "object" ||
    preferences === null ||
    Array.isArray(preferences)
  ) {
    return NextResponse.json(
      {
        error:
          "Missing or invalid fields: walletAddress, signature, nonce, preferences are all required",
      },
      { status: 400 },
    );
  }

  // Validate Stellar G-address format
  let isValidAddress = false;
  try {
    isValidAddress =
      StrKey.isValidEd25519PublicKey(walletAddress) &&
      walletAddress.startsWith("G") &&
      walletAddress.length === 56;
  } catch {
    isValidAddress = false;
  }

  if (!isValidAddress) {
    return NextResponse.json(
      { error: "Invalid walletAddress: must be a valid Stellar G-address" },
      { status: 400 },
    );
  }

  // Validate nonce shape (prevents injecting arbitrary bytes into the message)
  if (!NONCE_RE.test(nonce)) {
    return NextResponse.json(
      {
        error:
          "Invalid nonce: must be 1–128 alphanumeric/hyphen/underscore characters",
      },
      { status: 400 },
    );
  }

  // ── 2. Replay protection ─────────────────────────────────────────────────

  if (usedNonces.has(nonce)) {
    return NextResponse.json(
      { error: "Nonce has already been used" },
      { status: 401 },
    );
  }

  // ── 3. Signature verification ────────────────────────────────────────────

  const message = `${CHALLENGE_PREFIX}${nonce}`;
  const messageBytes = Buffer.from(message, "utf8");

  let signatureBytes: Buffer;
  try {
    signatureBytes = Buffer.from(signature, "base64");
  } catch {
    return NextResponse.json(
      { error: "signature must be a valid base64 string" },
      { status: 400 },
    );
  }

  let signatureValid = false;
  try {
    const keypair = Keypair.fromPublicKey(walletAddress);
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

  // Mark nonce as used only after successful verification to avoid lock-out
  // from transient errors above
  usedNonces.add(nonce);

  // ── 4. Validate preferences payload ─────────────────────────────────────

  const allowedChannels = new Set(["email", "sms", "push"]);
  const prefs = preferences as Record<string, unknown>;

  for (const key of Object.keys(prefs)) {
    if (!allowedChannels.has(key)) {
      return NextResponse.json(
        {
          error: `Unknown preference channel: "${key}". Allowed: email, sms, push`,
        },
        { status: 400 },
      );
    }
    if (typeof prefs[key] !== "boolean") {
      return NextResponse.json(
        {
          error: `Preference value for "${key}" must be a boolean`,
        },
        { status: 400 },
      );
    }
  }

  // ── 5. Persist preferences ───────────────────────────────────────────────
  //
  // TODO: replace this stub with your actual persistence layer, e.g.:
  //   await db.notificationPreferences.upsert({ walletAddress, ...prefs });
  //
  // For now we simply acknowledge the update so the route is testable.

  return NextResponse.json(
    {
      success: true,
      walletAddress,
      preferences: prefs,
    },
    { status: 200 },
  );
}
