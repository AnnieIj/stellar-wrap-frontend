import { describe, expect, it, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as confirmEmail } from "../confirm-email/route";
import { GET as getPreferences, PUT as putPreferences } from "../preferences/[wallet]/route";
import { POST as unsubscribe } from "../unsubscribe/route";
import { kvDel, kvGet, kvKeys, kvSet, SUB_KEY } from "../_lib/kv";
import type { SubscriptionRecord } from "@/app/types/notifications";

const wallet = "G" + "A".repeat(55);
const request = (url: string, init?: RequestInit) =>
  new NextRequest(new URL(url, "http://localhost:3000"), init);

describe("notification route contracts", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    for (const key of await kvKeys("notif:sub:*") ) await kvDel(key);
  });

  it("confirms a pending email and clears the token", async () => {
    const record: SubscriptionRecord = {
      walletAddress: wallet,
      consentGiven: true,
      consentTimestamp: new Date().toISOString(),
      email: {
        address: "person@example.com",
        status: "pending",
        confirmationToken: "confirm-token",
        unsubscribeToken: "unsubscribe-token",
        periods: { weekly: true, monthly: false, yearly: false },
        createdAt: new Date().toISOString(),
      },
    };
    await kvSet(SUB_KEY(wallet), record);

    const response = await confirmEmail(
      request(`/api/notifications/confirm-email?wallet=${wallet}&token=confirm-token`),
    );
    expect(response.status).toBe(307);
    expect((await kvGet<SubscriptionRecord>(SUB_KEY(wallet)))?.email?.status).toBe("active");
    expect((await kvGet<SubscriptionRecord>(SUB_KEY(wallet)))?.email?.confirmationToken).toBe("");
  });

  it("returns 404 for an unknown preference record and preserves allowed PUT fields", async () => {
    const missing = await getPreferences(request("/api/notifications/preferences/" + wallet), { params: Promise.resolve({ wallet }) });
    expect(missing.status).toBe(404);

    const record: SubscriptionRecord = { walletAddress: wallet, consentGiven: true, consentTimestamp: new Date().toISOString() };
    await kvSet(SUB_KEY(wallet), record);
    const updated = await putPreferences(
      request("/api/notifications/preferences/" + wallet, { method: "PUT", body: JSON.stringify({ consentGiven: false, walletAddress: "tampered" }) }),
      { params: Promise.resolve({ wallet }) },
    );
    expect(updated.status).toBe(200);
    expect((await updated.json()).walletAddress).toBe(wallet);
    expect((await kvGet<SubscriptionRecord>(SUB_KEY(wallet)))?.consentGiven).toBe(false);
  });

  it("unsubscribes a known channel and rejects an unknown token", async () => {
    await kvSet(SUB_KEY(wallet), { walletAddress: wallet, consentGiven: true, consentTimestamp: new Date().toISOString(), push: { subscription: { endpoint: "https://push.example/sub" }, periods: { weekly: true, monthly: false, yearly: false }, createdAt: new Date().toISOString() } });
    const removed = await unsubscribe(request("/api/notifications/unsubscribe", { method: "POST", body: JSON.stringify({ walletAddress: wallet, channel: "push" }) }));
    expect(removed.status).toBe(200);
    expect((await kvGet<SubscriptionRecord>(SUB_KEY(wallet)))?.push).toBeUndefined();

    const unknown = await unsubscribe(request("/api/notifications/unsubscribe", { method: "POST", body: JSON.stringify({ token: "unknown" }) }));
    expect(unknown.status).toBe(404);
  });
});
