/**
 * Notification system type definitions
 * Core types shared across the wrap-period notification feature.
 */

import type { WrapPeriod } from "@/app/store/wrapStore";

// Re-export so consumers can import WrapPeriod from this module
export type { WrapPeriod };

// ─── Period preferences ──────────────────────────────────────────────────────

export interface PeriodPrefs {
  weekly: boolean;
  monthly: boolean;
  yearly: boolean;
}

// ─── Push notification payload (shared with service worker) ──────────────────

export interface PushPayload {
  title: string;
  body: string;
  icon: string;
  actionUrl: string;
}

// ─── Email template data ─────────────────────────────────────────────────────

export interface EmailTemplateData {
  period: WrapPeriod;
  /** Human-readable label, e.g. "Monthly" */
  periodLabel: string;
  /** Full CTA URL, e.g. "https://stellarwrapped.app/connect?period=monthly" */
  ctaUrl: string;
  /** Full unsubscribe URL containing the token */
  unsubscribeUrl: string;
  /** Physical mailing address for CAN-SPAM compliance */
  physicalAddress: string;
}

// ─── Subscription record (stored in KV at notif:sub:{walletAddress}) ─────────

export interface SubscriptionRecord {
  walletAddress: string;
  push?: {
    subscription: PushSubscriptionJSON;
    periods: PeriodPrefs;
    createdAt: string; // ISO-8601
  };
  email?: {
    address: string;
    status: "pending" | "active";
    /** Set on pending, cleared on confirm */
    confirmationToken: string;
    /** Persistent, rotated on re-subscribe */
    unsubscribeToken: string;
    periods: PeriodPrefs;
    createdAt: string; // ISO-8601
  };
  consentGiven: boolean;
  consentTimestamp: string; // ISO-8601
  /** Present when user has requested data deletion */
  deletionRequested?: string; // ISO-8601
}

// ─── Dispatch log entry (stored in KV at notif:log:{wallet}:{channel}:{period}:{periodKey}) ──

export interface DispatchLogEntry {
  walletAddress: string;
  channel: "push" | "email";
  period: WrapPeriod;
  /** e.g. "2025-W03", "2025-01", "2025" */
  periodKey: string;
  sentAt: string; // ISO-8601
  status: "sent" | "failed";
  attempts: number;
}

// ─── Notification preferences (Zustand store shape) ──────────────────────────

export interface NotificationPreferences {
  walletAddress: string | null;
  pushEnabled: boolean;
  emailEnabled: boolean;
  email: string | null;
  emailStatus: "inactive" | "pending" | "active";
  periods: {
    push: PeriodPrefs;
    email: PeriodPrefs;
  };
  /** localStorage flag indicating push permission was explicitly denied */
  permissionDenied: boolean;
  /** GDPR consent flag */
  consentGiven: boolean;
  syncStatus: "idle" | "syncing" | "error" | "synced";
  lastKnownRemoteState: Partial<NotificationPreferences> | null;
}
