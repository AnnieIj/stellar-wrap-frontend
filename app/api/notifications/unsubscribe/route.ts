import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet, kvKeys, kvSRem, SUB_KEY, PERIOD_KEY } from "../_lib/kv";
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

const VALID_PERIODS = ["weekly", "monthly", "yearly"] as const;

function isActive(record: SubscriptionRecord): boolean {
  return !!(record.push || record.email);
}

async function removeFromPeriodIndexes(walletAddress: string) {
  const ops = VALID_PERIODS.map((period) => kvSRem(PERIOD_KEY(period), walletAddress));
  await Promise.all(ops);
}

async function removeEmailPeriodIndexes(walletAddress: string, record: SubscriptionRecord) {
  // Only remove from period index if push is not subscribed to those periods
  const emailPeriods = record.email?.periods;
  const pushPeriods = record.push?.periods;
  
  if (!emailPeriods) return;
  
  const ops = VALID_PERIODS.map((period) => {
    // Only remove if email was subscribed but push is not
    if (emailPeriods[period] && !pushPeriods?.[period]) {
      return kvSRem(PERIOD_KEY(period), walletAddress);
    }
    return Promise.resolve();
  });
  
  await Promise.all(ops);
}

export async function POST(request: NextRequest) {
  try {
    const ipDenial = rateLimitDenialResponse(
      await checkRateLimit(
        `ratelimit:ip:unsubscribe:${getClientIp(request)}`,
        UNSUBSCRIBE_IP_LIMIT,
        UNSUBSCRIBE_IP_WINDOW
      )
    );

    if (ipDenial) {
      return ipDenial;
    }

    const body = (await request.json()) as {
      token?: string;
      walletAddress?: string;
      channel?: "push" | "email";
    };

    // Throttled per target as well as per IP: the token path scans every
    // subscription key, so unrestrained token guessing is also a KV cost
    // problem, and a wallet must not be unsubscribable by a distributed burst.
    const target = body.token ?? body.walletAddress ?? "";
    if (target) {
      const targetDenial = rateLimitDenialResponse(
        await checkRateLimit(
          `ratelimit:target:unsubscribe:${target}`,
          UNSUBSCRIBE_TARGET_LIMIT,
          UNSUBSCRIBE_TARGET_WINDOW
        )
      );

      if (targetDenial) {
        return targetDenial;
      }
    }

    if (body.token) {
      const keys = await kvKeys("notif:sub:*");
      for (const key of keys) {
        const record = await kvGet<SubscriptionRecord>(key);
        if (record?.email?.unsubscribeToken === body.token) {
          const walletAddress = record.walletAddress;
          
          // Remove email period indexes before updating record
          await removeEmailPeriodIndexes(walletAddress, record);
          
          const updated: SubscriptionRecord = { ...record, email: undefined };
          await kvSet(key, updated);
          return NextResponse.json({ ok: true }, { status: 200 });
        }
      }
      return apiError("INVALID_UNSUBSCRIBE_TOKEN", "Token not found", 401);
    }

    if (body.walletAddress && body.channel) {
      const record = await kvGet<SubscriptionRecord>(SUB_KEY(body.walletAddress));
      if (!record) {
        return apiError("NOT_FOUND", "No subscription found", 404);
      }

      if (body.channel === "push") {
        // Remove push-specific period indexes
        const pushPeriods = record.push?.periods;
        const emailPeriods = record.email?.periods;
        
        if (pushPeriods) {
          const ops = VALID_PERIODS.map((period) => {
            // Only remove if push was subscribed but email is not
            if (pushPeriods[period] && !emailPeriods?.[period]) {
              return kvSRem(PERIOD_KEY(period), body.walletAddress!);
            }
            return Promise.resolve();
          });
          await Promise.all(ops);
        }
        
        const updated: SubscriptionRecord = { ...record, push: undefined };
        await kvSet(SUB_KEY(body.walletAddress), updated);
      } else {
        // Remove email-specific period indexes
        await removeEmailPeriodIndexes(body.walletAddress, record);
        
        const updated: SubscriptionRecord = { ...record, email: undefined };
        await kvSet(SUB_KEY(body.walletAddress), updated);
      }

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    return apiError("INVALID_REQUEST", "Provide either token or walletAddress and channel", 400);
  } catch (err) {
    return internalApiError(logger, err);
  }
}
