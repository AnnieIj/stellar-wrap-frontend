/**
 * DELETE /api/notifications/data/:wallet
 *
 * GDPR data deletion request.
 * Immediately removes push/email data; marks the record with a deletion timestamp.
 * Dispatch logs are cleared asynchronously (within 30 days per policy).
 */

import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet, kvDel, kvKeys, SUB_KEY } from "../../_lib/kv";
import { sendEmail } from "../../_lib/email";
import { logger, maskAddress } from "@/app/utils/logger";
import type { SubscriptionRecord } from "@/app/types/notifications";
import { apiError, internalApiError } from "@/app/api/_lib/apiError";

const log = logger.child("api:data-delete");

interface RouteParams {
  params: Promise<{ wallet: string }>;
}

function isValidWallet(address: string): boolean {
  return typeof address === "string" && address.startsWith("G") && address.length === 56;
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { wallet } = await params;

    if (!isValidWallet(wallet)) {
      return apiError("INVALID_WALLET", "Invalid wallet address", 400);
    }

    const record = await kvGet<SubscriptionRecord>(SUB_KEY(wallet));

    // Capture email before deletion for confirmation
    const emailAddress = record?.email?.address ?? null;

    // Immediately purge push and email PII
    const purged: SubscriptionRecord = {
      walletAddress: wallet,
      consentGiven: false,
      consentTimestamp: record?.consentTimestamp ?? new Date().toISOString(),
      deletionRequested: new Date().toISOString(),
    };

    await kvSet(SUB_KEY(wallet), purged);

    // Remove dispatch logs for this wallet
    const logPattern = `notif:log:${wallet}:*`;
    const logKeys = await kvKeys(logPattern);
    await Promise.all(logKeys.map((k) => kvDel(k)));

    // Send deletion confirmation email if we had one
    if (emailAddress) {
      await sendEmail({
        to: emailAddress,
        subject: "Your Stellar Wrapped data has been deleted",
        html: `
          <p>Your notification preferences and personal data have been removed from Stellar Wrapped.</p>
          <p>If you did not request this, please contact us.</p>
        `,
      }).catch((err) => {
        // Non-fatal — log and continue
        log.warn(`Confirmation email failed for wallet ${maskAddress(wallet)}:`, err);
      });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    return internalApiError(log, err);
  }
}
