/**
 * GET  /api/notifications/preferences/:wallet  — read subscription record
 * PUT  /api/notifications/preferences/:wallet  — update subscription record
 */

import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet, SUB_KEY } from "../../_lib/kv";
import { logger } from "@/app/utils/logger";
import type { SubscriptionRecord } from "@/app/types/notifications";
import { apiError, internalApiError } from "@/app/api/_lib/apiError";

const log = logger.child("api:preferences");

interface RouteParams {
  params: Promise<{ wallet: string }>;
}

function isValidWallet(address: string): boolean {
  return typeof address === "string" && address.startsWith("G") && address.length === 56;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { wallet } = await params;

    if (!isValidWallet(wallet)) {
      return apiError("INVALID_WALLET", "Invalid wallet address", 400);
    }

    const record = await kvGet<SubscriptionRecord>(SUB_KEY(wallet));

    if (!record) {
      return apiError("NOT_FOUND", "No subscription found", 404);
    }

    return NextResponse.json(record, { status: 200 });
  } catch (err) {
    return internalApiError(log, err);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { wallet } = await params;

    if (!isValidWallet(wallet)) {
      return apiError("INVALID_WALLET", "Invalid wallet address", 400);
    }

    const body = (await request.json()) as Partial<SubscriptionRecord>;

    const existing = await kvGet<SubscriptionRecord>(SUB_KEY(wallet));

    if (!existing) {
      return apiError("NOT_FOUND", "No subscription found", 404);
    }

    // Merge only allowed fields — never overwrite walletAddress
    const updated: SubscriptionRecord = {
      ...existing,
      ...(body.push !== undefined && { push: body.push }),
      ...(body.email !== undefined && { email: body.email }),
      ...(body.consentGiven !== undefined && { consentGiven: body.consentGiven }),
    };

    await kvSet(SUB_KEY(wallet), updated);

    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    return internalApiError(log, err);
  }
}
