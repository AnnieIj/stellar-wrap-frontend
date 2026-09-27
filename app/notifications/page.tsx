"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Mail, Trash2, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useWrapStore } from "@/app/store/wrapStore";
import { useNotificationStore } from "@/app/store/notificationStore";
import { useServiceWorker } from "@/app/hooks/useServiceWorker";
import { useDialogFocusManagement } from "@/app/hooks/useDialogFocusManagement";
import { isValidEmail } from "@/app/utils/notifications/emailValidator";
import type { SubscriptionRecord } from "@/app/types/notifications";

// ─── Period checkbox group ────────────────────────────────────────────────────

interface PeriodCheckboxesProps {
  label: string;
  values: { weekly: boolean; monthly: boolean; yearly: boolean };
  onChange: (key: "weekly" | "monthly" | "yearly", val: boolean) => void;
  disabled?: boolean;
}

function PeriodCheckboxes({ label, values, onChange, disabled }: PeriodCheckboxesProps) {
  return (
    <div className="mt-3">
      <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">{label}</p>
      <div className="flex gap-4">
        {(["weekly", "monthly", "yearly"] as const).map((period) => (
          <label key={period} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={values[period]}
              disabled={disabled}
              onChange={(e) => onChange(period, e.target.checked)}
              className="accent-[var(--color-theme-primary)] w-4 h-4 rounded disabled:opacity-40"
            />
            <span className="text-sm text-white/70 capitalize">{period}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const router = useRouter();
  const { address } = useWrapStore();
  const store = useNotificationStore();
  const sw = useServiceWorker();

  const [emailInput, setEmailInput] = useState(store.email ?? "");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [syncPending, setSyncPending] = useState(false);
  const deleteDialogRef = useRef<HTMLDivElement>(null);

  useDialogFocusManagement(
    showDeleteConfirm,
    () => setShowDeleteConfirm(false),
    deleteDialogRef,
  );

  // Load preferences from server on mount
  useEffect(() => {
    if (!address) return;

    store.setSyncStatus("syncing");

    fetch(`/api/notifications/preferences/${address}`)
      .then((res) => {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error("Failed to fetch preferences");
        return res.json() as Promise<SubscriptionRecord>;
      })
      .then((record) => {
        if (!record) {
          store.setSyncStatus("synced");
          return;
        }
        // Hydrate store from server record
        if (record.push) {
          store.setPushEnabled(true);
          store.setPeriods({
            push: record.push.periods,
            email: record.email?.periods ?? store.periods.email,
          });
        }
        if (record.email) {
          store.setEmailEnabled(record.email.status === "active");
          store.setEmail(record.email.address);
          store.setEmailStatus(record.email.status);
          setEmailInput(record.email.address);
          store.setPeriods({
            push: record.push?.periods ?? store.periods.push,
            email: record.email.periods,
          });
        }
        store.setConsentGiven(record.consentGiven);
        store.setSyncStatus("synced");
      })
      .catch(() => {
        store.setSyncStatus("error");
        setSyncPending(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `store` is a stable Zustand reference; including it would cause infinite re-fetches on every store update
  }, [address]);

  if (!address) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/60">
        <p>Connect your wallet to manage notification preferences.</p>
      </div>
    );
  }

  // ── Save preferences to server ──────────────────────────────────────────────
  async function savePreferences(patch: Partial<SubscriptionRecord>) {
    setIsSaving(true);
    store.setSyncStatus("syncing");
    try {
      const res = await fetch(`/api/notifications/preferences/${address}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Save failed");
      store.setSyncStatus("synced");
      toast.success("Preferences saved");
    } catch {
      store.setSyncStatus("error");
      toast.error("Could not save — your previous settings are shown");
      // Revert to last known state
      if (store.lastKnownRemoteState) {
        if (store.lastKnownRemoteState.pushEnabled !== undefined)
          store.setPushEnabled(store.lastKnownRemoteState.pushEnabled);
        if (store.lastKnownRemoteState.emailEnabled !== undefined)
          store.setEmailEnabled(store.lastKnownRemoteState.emailEnabled);
      }
    } finally {
      setIsSaving(false);
    }
  }

  // ── Push toggle ─────────────────────────────────────────────────────────────
  async function handlePushToggle() {
    if (!sw.isSupported) return;

    store.setLastKnownRemoteState({ pushEnabled: store.pushEnabled });

    if (!store.pushEnabled) {
      await sw.subscribe();
      if (!sw.pushSubscription) return; // permission denied or error

      store.setPushEnabled(true);
      store.setConsentGiven(true);

      // POST subscription to server
      try {
        await fetch("/api/notifications/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: address,
            subscription: sw.pushSubscription.toJSON(),
            periods: store.periods.push,
          }),
        });
        toast.success("Push notifications enabled");
      } catch {
        toast.error("Push subscription could not be saved");
        store.setPushEnabled(false);
      }
    } else {
      await sw.unsubscribe();
      store.setPushEnabled(false);
      await savePreferences({ push: undefined });
    }
  }

  // ── Push period change ──────────────────────────────────────────────────────
  function handlePushPeriodChange(key: "weekly" | "monthly" | "yearly", val: boolean) {
    const updated = { ...store.periods, push: { ...store.periods.push, [key]: val } };
    store.setPeriods(updated);
    savePreferences({ push: { subscription: sw.pushSubscription?.toJSON() ?? {}, periods: updated.push, createdAt: new Date().toISOString() } });
  }

  // ── Email submit ────────────────────────────────────────────────────────────
  async function handleEmailSubmit() {
    if (!isValidEmail(emailInput)) {
      setEmailError("Please enter a valid email address");
      return;
    }
    setEmailError(null);
    setIsSaving(true);

    try {
      const res = await fetch("/api/notifications/subscribe-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          email: emailInput,
          periods: store.periods.email,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to subscribe");
      }
      store.setEmail(emailInput);
      store.setEmailStatus("pending");
      store.setEmailEnabled(false);
      toast.success("Check your inbox to confirm your email");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Email subscription failed");
    } finally {
      setIsSaving(false);
    }
  }

  // ── Email period change ─────────────────────────────────────────────────────
  function handleEmailPeriodChange(key: "weekly" | "monthly" | "yearly", val: boolean) {
    const updated = { ...store.periods, email: { ...store.periods.email, [key]: val } };
    store.setPeriods(updated);
    if (store.emailEnabled && store.email) {
      savePreferences({ email: { address: store.email!, status: store.emailStatus as "pending" | "active", confirmationToken: "", unsubscribeToken: "", periods: updated.email, createdAt: new Date().toISOString() } });
    }
  }

  // ── Email remove ────────────────────────────────────────────────────────────
  async function handleEmailRemove() {
    setIsSaving(true);
    try {
      await fetch("/api/notifications/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address, channel: "email" }),
      });
      store.setEmail(null);
      store.setEmailEnabled(false);
      store.setEmailStatus("inactive");
      setEmailInput("");
      toast.success("Email notifications removed");
    } catch {
      toast.error("Could not remove email");
    } finally {
      setIsSaving(false);
    }
  }

  // ── Data deletion ───────────────────────────────────────────────────────────
  async function handleDataDeletion() {
    setShowDeleteConfirm(false);
    setIsSaving(true);
    try {
      await fetch(`/api/notifications/data/${address}`, { method: "DELETE" });
      store.reset();
      setEmailInput("");
      toast.success("All notification data deleted");
      router.push("/");
    } catch {
      toast.error("Data deletion failed — please try again");
    } finally {
      setIsSaving(false);
    }
  }

  const pushDenied = sw.permissionState === "denied";

  return (
    <main className="min-h-screen bg-[#0a0a1a] text-white pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-black tracking-tight">Notification Preferences</h1>
          <p className="text-white/50 mt-1 text-sm">
            Manage how Stellar Wrapped notifies you when a new period is ready.
          </p>
          {syncPending && (
            <p className="text-yellow-400 text-xs mt-1 flex items-center gap-1">
              <AlertCircle size={12} /> Sync pending — showing last known settings
            </p>
          )}
        </motion.div>

        {/* GDPR consent statement */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/60 space-y-2"
        >
          <p className="font-semibold text-white/80">About your data</p>
          <p>
            We store your wallet address, notification channel preferences, and (if
            provided) your email address. This data is used solely to send you wrap
            period notifications. It is never shared with third parties beyond the email
            delivery service.
          </p>
          <p>
            You can delete all stored data at any time using the button below. Deletion
            is processed within 30 days.
          </p>
        </motion.section>

        {/* Push notifications panel */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell size={20} className="text-[var(--color-theme-primary)]" />
              <div>
                <p className="font-semibold">Push Notifications</p>
                <p className="text-xs text-white/40">
                  {sw.isSupported
                    ? pushDenied
                      ? "Permission denied — use email instead"
                      : "Receive browser notifications when a new wrap is ready"
                    : "Not supported in this browser"}
                </p>
              </div>
            </div>

            <button
              onClick={handlePushToggle}
              disabled={!sw.isSupported || pushDenied || isSaving}
              aria-label={store.pushEnabled ? "Disable push notifications" : "Enable push notifications"}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-theme-primary)] disabled:opacity-40 disabled:cursor-not-allowed ${
                store.pushEnabled ? "bg-[var(--color-theme-primary)]" : "bg-white/20"
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                  store.pushEnabled ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {store.pushEnabled && (
            <PeriodCheckboxes
              label="Notify me for"
              values={store.periods.push}
              onChange={handlePushPeriodChange}
              disabled={isSaving}
            />
          )}
        </motion.section>

        {/* Email notifications panel */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4"
        >
          <div className="flex items-center gap-3">
            <Mail size={20} className="text-[var(--color-theme-primary)]" />
            <div>
              <p className="font-semibold">Email Notifications</p>
              <p className="text-xs text-white/40">
                {pushDenied
                  ? "Recommended — push notifications were denied"
                  : "Optional — receive an email when your wrap is ready"}
              </p>
            </div>
          </div>

          {/* Email status badge */}
          {store.emailStatus === "pending" && (
            <p className="text-yellow-400 text-xs flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" />
              Confirmation email sent — check your inbox
            </p>
          )}
          {store.emailStatus === "active" && (
            <p className="text-green-400 text-xs flex items-center gap-1">
              <CheckCircle size={12} /> Email confirmed and active
            </p>
          )}

          <div className="flex gap-2">
            <input
              type="email"
              value={emailInput}
              onChange={(e) => {
                setEmailInput(e.target.value);
                setEmailError(null);
              }}
              placeholder="your@email.com"
              disabled={store.emailStatus === "active" || isSaving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[var(--color-theme-primary)] disabled:opacity-50"
              aria-invalid={!!emailError}
              aria-describedby={emailError ? "email-error" : undefined}
            />
            {store.emailStatus !== "active" ? (
              <button
                onClick={handleEmailSubmit}
                disabled={isSaving || !emailInput}
                className="px-4 py-2.5 rounded-xl bg-[var(--color-theme-primary)] text-black font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : "Subscribe"}
              </button>
            ) : (
              <button
                onClick={handleEmailRemove}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl bg-red-500/20 text-red-400 font-semibold text-sm disabled:opacity-40 hover:bg-red-500/30 transition-colors"
              >
                Remove
              </button>
            )}
          </div>

          {emailError && (
            <p id="email-error" role="alert" className="text-red-400 text-xs">
              {emailError}
            </p>
          )}

          {store.emailStatus === "active" && (
            <PeriodCheckboxes
              label="Notify me for"
              values={store.periods.email}
              onChange={handleEmailPeriodChange}
              disabled={isSaving}
            />
          )}
        </motion.section>

        {/* Data deletion */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-red-400">Delete all notification data</p>
              <p className="text-xs text-white/40 mt-0.5">
                Removes your preferences, email, and dispatch history within 30 days.
              </p>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isSaving}
              aria-label="Request data deletion"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 text-red-400 text-sm font-semibold hover:bg-red-500/30 transition-colors disabled:opacity-40"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </motion.section>

        {/* Delete confirmation dialog */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-dialog-title"
              aria-describedby="delete-dialog-description"
              ref={deleteDialogRef}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-[#12122a] border border-red-500/30 rounded-2xl p-6 max-w-sm w-full space-y-4"
              >
                <h2 id="delete-dialog-title" className="font-bold text-lg text-red-400">
                  Confirm data deletion
                </h2>
                <p id="delete-dialog-description" className="text-sm text-white/70">
                  This will permanently remove all your notification preferences, email
                  address, and dispatch history. This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/70 hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDataDeletion}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-colors"
                  >
                    Delete everything
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </main>
  );
}
