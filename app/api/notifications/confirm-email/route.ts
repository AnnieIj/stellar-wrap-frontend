/**
 * GET /api/notifications/confirm-email?token=...&wallet=...
 *
 * Activates a pending email subscription by matching the confirmation token.
 * Redirects to /notifications?confirmed=true on success.
 */

import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet, SUB_KEY } from "../_lib/kv";
import { logger } from "@/app/utils/logger";
import type { SubscriptionRecord } from "@/app/types/notifications";
import { apiError, internalApiError } from "@/app/api/_lib/apiError";

const log = logger.child("api:confirm-email");

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const token = searchParams.get("token");
    const wallet = searchParams.get("wallet");

    if (!token || !wallet) {
      return apiError("INVALID_REQUEST", "Missing token or wallet parameter", 400);
    }

    const record = await kvGet<SubscriptionRecord>(SUB_KEY(wallet));

    if (!record?.email) {
      return apiError("NOT_FOUND", "No pending email subscription found", 404);
    }

    if (record.email.confirmationToken !== token) {
      return apiError("INVALID_CONFIRMATION_TOKEN", "Invalid or expired confirmation token", 401);
    }

    if (record.email.status === "active") {
      // Already confirmed — just redirect
      return NextResponse.redirect(new URL("/notifications?confirmed=true", request.url));
    }

    const updated: SubscriptionRecord = {
      ...record,
      email: {
        ...record.email,
        status: "active",
        confirmationToken: "", // clear token after use
      },
    };

    await kvSet(SUB_KEY(wallet), updated);

    return NextResponse.redirect(new URL("/notifications?confirmed=true", request.url));
  } catch (err) {
    return internalApiError(log, err);
  }
}
