import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet, kvSAdd, kvSRem, SUB_KEY, PERIOD_KEY } from "../_lib/kv";
import { logger } from "@/app/utils/logger";
import {
  getClientIp,
  checkRateLimit,
  rateLimitResponse,
  SUBSCRIBE_IP_LIMIT,
  SUBSCRIBE_IP_WINDOW,
} from "../_lib/rateLimit";
import type { SubscriptionRecord, PeriodPrefs } from "@/app/types/notifications";
import { apiError, internalApiError } from "@/app/api/_lib/apiError";

const VALID_PERIODS = ["weekly", "monthly", "yearly"] as const;

function isValidWallet(address: string): boolean {
  return typeof address === "string" && address.startsWith("G") && address.length === 56;
}

async function syncPeriodIndex(
  walletAddress: string,
  previousPeriods: PeriodPrefs | undefined,
  currentPeriods: PeriodPrefs
) {
  const ops = VALID_PERIODS.map((period) => {
    const key = PERIOD_KEY(period);
    const enabled = !!currentPeriods[period];
    const wasEnabled = !!previousPeriods?.[period];

    if (enabled) {
      return kvSAdd(key, walletAddress);
    }
    if (wasEnabled) {
      return kvSRem(key, walletAddress);
    }
    return Promise.resolve();
  });

  await Promise.all(ops);
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const ipLimitResult = await checkRateLimit(
      `ratelimit:ip:subscribe:${ip}`,
      SUBSCRIBE_IP_LIMIT,
      SUBSCRIBE_IP_WINDOW
    );

    if (!ipLimitResult.allowed) {
      return rateLimitResponse(ipLimitResult.resetInSeconds);
    }

    const body = await request.json();
    const { walletAddress, subscription, periods } = body as {
      walletAddress: string;
      subscription: PushSubscriptionJSON;
      periods: PeriodPrefs;
    };

    if (!isValidWallet(walletAddress)) {
      return apiError("INVALID_WALLET", "Invalid wallet address", 400);
    }

    if (!subscription?.endpoint) {
      return apiError("INVALID_PUSH_SUBSCRIPTION", "Invalid push subscription", 400);
    }

    const existing = (await kvGet<SubscriptionRecord>(SUB_KEY(walletAddress))) ?? {
      walletAddress,
      consentGiven: true,
      consentTimestamp: new Date().toISOString(),
    };

    const previousPeriods = existing.push?.periods;

    const normalizedPeriods: PeriodPrefs = periods ?? {
      weekly: false,
      monthly: false,
      yearly: false,
    };

    const updated: SubscriptionRecord = {
      ...existing,
      push: {
        subscription,
        periods: periods ?? { weekly: false, monthly: false, yearly: false },
        createdAt: existing.push?.createdAt ?? new Date().toISOString(),
      },
    };

    await kvSet(SUB_KEY(walletAddress), updated);

    await syncPeriodIndex(walletAddress, previousPeriods, normalizedPeriods);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    return internalApiError(logger, err);
  }
}
