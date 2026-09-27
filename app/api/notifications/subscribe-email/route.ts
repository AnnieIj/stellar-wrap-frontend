/**
 * POST /api/notifications/subscribe-email
 *
 * Validates an email address, writes a pending subscription to KV,
 * and sends a confirmation email.
 */

import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet, SUB_KEY } from "../_lib/kv";
import { sendEmail } from "../_lib/email";
import { logger } from "@/app/utils/logger";

const log = logger.child("api:subscribe-email");
import {
  getClientIp,
  checkRateLimit,
  rateLimitResponse,
  SUBSCRIBE_EMAIL_IP_LIMIT,
  SUBSCRIBE_EMAIL_IP_WINDOW,
  SUBSCRIBE_EMAIL_TARGET_LIMIT,
  SUBSCRIBE_EMAIL_TARGET_WINDOW,
} from "../_lib/rateLimit";
import { isValidEmail } from "@/app/utils/notifications/emailValidator";
import { generateUnsubscribeToken } from "@/app/utils/notifications/unsubscribeToken";
import type { SubscriptionRecord, PeriodPrefs } from "@/app/types/notifications";
import { apiError, internalApiError } from "@/app/api/_lib/apiError";

function isValidWallet(address: string): boolean {
  return typeof address === "string" && address.startsWith("G") && address.length === 56;
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const ipLimitResult = await checkRateLimit(
      `ratelimit:ip:subscribe-email:${ip}`,
      SUBSCRIBE_EMAIL_IP_LIMIT,
      SUBSCRIBE_EMAIL_IP_WINDOW
    );

    if (!ipLimitResult.allowed) {
      return rateLimitResponse(ipLimitResult.resetInSeconds);
    }

    const body = await request.json();
    const { walletAddress, email, periods } = body as {
      walletAddress: string;
      email: string;
      periods: PeriodPrefs;
    };

    if (!isValidWallet(walletAddress)) {
      return apiError("INVALID_WALLET", "Invalid wallet address", 400);
    }

    if (!isValidEmail(email)) {
      return apiError("INVALID_EMAIL", "Invalid email address", 400);
    }

    const normalizedEmail = email.trim().toLowerCase();

    const emailLimitResult = await checkRateLimit(
      `ratelimit:email:subscribe-email:${normalizedEmail}`,
      SUBSCRIBE_EMAIL_TARGET_LIMIT,
      SUBSCRIBE_EMAIL_TARGET_WINDOW
    );

    if (!emailLimitResult.allowed) {
      return rateLimitResponse(
        emailLimitResult.resetInSeconds,
        "Too many requests for this email address. Please try again later."
      );
    }

    const existing = (await kvGet<SubscriptionRecord>(SUB_KEY(walletAddress))) ?? {
      walletAddress,
      consentGiven: true,
      consentTimestamp: new Date().toISOString(),
    };

    const isSameEmail = existing.email?.address?.trim().toLowerCase() === normalizedEmail;
    const isAlreadyActive = isSameEmail && existing.email?.status === "active";

    const confirmationToken =
      isSameEmail && existing.email?.confirmationToken
        ? existing.email.confirmationToken
        : generateUnsubscribeToken();

    const unsubscribeToken =
      isSameEmail && existing.email?.unsubscribeToken
        ? existing.email.unsubscribeToken
        : generateUnsubscribeToken();

    const status = isAlreadyActive ? "active" : "pending";

    const updated: SubscriptionRecord = {
      ...existing,
      email: {
        address: normalizedEmail,
        status,
        confirmationToken,
        unsubscribeToken,
        periods: periods ?? { weekly: false, monthly: false, yearly: false },
        createdAt:
          isSameEmail && existing.email?.createdAt
            ? existing.email.createdAt
            : new Date().toISOString(),
      },
    };

    await kvSet(SUB_KEY(walletAddress), updated);

    if (!isAlreadyActive) {
      const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
      const confirmUrl = `${baseUrl}/api/notifications/confirm-email?token=${confirmationToken}&wallet=${walletAddress}`;

      await sendEmail({
        to: normalizedEmail,
        subject: "Confirm your Stellar Wrapped notifications",
        html: `
          <p>Click the link below to confirm your email subscription to Stellar Wrapped notifications:</p>
          <p><a href="${confirmUrl}">Confirm subscription</a></p>
          <p>If you did not request this, you can ignore this email.</p>
        `,
      });
    }

    return NextResponse.json({ ok: true, status }, { status: 200 });
  } catch (err) {
    return internalApiError(log, err);
  }
}
