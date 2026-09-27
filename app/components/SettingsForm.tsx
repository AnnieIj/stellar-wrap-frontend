"use client";

import { useState } from "react";
import { Bell, CheckCircle, Loader2, Mail } from "lucide-react";
import type { PeriodPrefs } from "@/app/types/notifications";

export type SettingsFormVariant = "primary" | "secondary";

export type SettingsPeriodChannel = "push" | "email";

export type SettingsEmailStatus = "inactive" | "pending" | "active";

export interface SettingsFormProps {
  /** Visual style for the form's primary action. Defaults to `"primary"`. */
  variant?: SettingsFormVariant;
  /** Disables every interactive control in the form. */
  disabled?: boolean;
  /** Shows a saving state and disables controls while a request is in flight. */
  loading?: boolean;
  /** Whether push notifications are currently enabled. */
  pushEnabled?: boolean;
  /** Whether email notifications are currently enabled. */
  emailEnabled?: boolean;
  /** Current subscription status of the email channel. */
  emailStatus?: SettingsEmailStatus;
  /** Initial value for the email address input. */
  email?: string;
  /** Selected notification periods for each channel. */
  periods?: { push: PeriodPrefs; email: PeriodPrefs };
  /** Called when the push toggle is flipped. */
  onPushToggle?: (enabled: boolean) => void;
  /** Called as the email input value changes. */
  onEmailChange?: (email: string) => void;
  /** Called when the email address is submitted. */
  onEmailSubmit?: (email: string) => void;
  /** Called when a notification period checkbox is toggled. */
  onPeriodChange?: (
    channel: SettingsPeriodChannel,
    period: keyof PeriodPrefs,
    value: boolean,
  ) => void;
}

const PERIOD_KEYS = ["weekly", "monthly", "yearly"] as const;

const defaultPeriodPrefs: PeriodPrefs = {
  weekly: false,
  monthly: false,
  yearly: false,
};

export function SettingsForm({
  variant = "primary",
  disabled = false,
  loading = false,
  pushEnabled = false,
  emailEnabled = false,
  emailStatus = "inactive",
  email = "",
  periods = { push: defaultPeriodPrefs, email: defaultPeriodPrefs },
  onPushToggle,
  onEmailChange,
  onEmailSubmit,
  onPeriodChange,
}: SettingsFormProps) {
  const [emailInput, setEmailInput] = useState(email);

  const isInteractive = !disabled && !loading;
  const actionStyles =
    variant === "secondary"
      ? "border border-white/10 text-white/70 hover:bg-white/5"
      : "bg-[var(--color-theme-primary)] text-black font-semibold hover:opacity-90";
  const controlDisabled = !isInteractive;

  function handleEmailInputChange(value: string) {
    setEmailInput(value);
    onEmailChange?.(value);
  }

  function handleEmailSubmit() {
    if (!controlDisabled) onEmailSubmit?.(emailInput);
  }

  function renderPeriodCheckboxes(channel: SettingsPeriodChannel) {
    return (
      <div className="mt-3">
        <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">
          Notify me for
        </p>
        <div className="flex gap-4">
          {PERIOD_KEYS.map((period) => (
            <label
              key={period}
              className={`flex items-center gap-2 ${controlDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
            >
              <input
                type="checkbox"
                checked={periods[channel][period]}
                disabled={controlDisabled}
                onChange={(e) =>
                  onPeriodChange?.(channel, period, e.target.checked)
                }
                className="accent-[var(--color-theme-primary)] w-4 h-4 rounded disabled:opacity-40"
              />
              <span className="text-sm text-white/70 capitalize">{period}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form
      className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        handleEmailSubmit();
      }}
      aria-busy={loading}
    >
      {/* Push notifications */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell size={20} className="text-[var(--color-theme-primary)]" />
          <div>
            <p className="font-semibold">Push Notifications</p>
            <p className="text-xs text-white/40">
              Receive browser notifications when a new wrap is ready
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onPushToggle?.(!pushEnabled)}
          disabled={controlDisabled}
          aria-label={pushEnabled ? "Disable push notifications" : "Enable push notifications"}
          aria-pressed={pushEnabled}
          className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-theme-primary)] disabled:opacity-40 disabled:cursor-not-allowed ${
            pushEnabled ? "bg-[var(--color-theme-primary)]" : "bg-white/20"
          }`}
        >
          <span
            className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
              pushEnabled ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {pushEnabled && renderPeriodCheckboxes("push")}

      {/* Email notifications */}
      <div className="pt-2">
        <div className="flex items-center gap-3">
          <Mail size={20} className="text-[var(--color-theme-primary)]" />
          <div>
            <p className="font-semibold">Email Notifications</p>
            <p className="text-xs text-white/40">
              Optional — receive an email when your wrap is ready
            </p>
          </div>
        </div>

        {emailStatus === "pending" && (
          <p className="text-yellow-400 text-xs flex items-center gap-1 mt-3">
            <Loader2 size={12} className="animate-spin" />
            Confirmation email sent — check your inbox
          </p>
        )}
        {emailStatus === "active" && (
          <p className="text-green-400 text-xs flex items-center gap-1 mt-3">
            <CheckCircle size={12} /> Email confirmed and active
          </p>
        )}

        <div className="flex gap-2 mt-3">
          <input
            type="email"
            value={emailInput}
            onChange={(e) => handleEmailInputChange(e.target.value)}
            placeholder="your@email.com"
            disabled={controlDisabled || emailStatus === "active"}
            className="flex-1 px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[var(--color-theme-primary)] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={controlDisabled || !emailInput || emailStatus === "active"}
            className={`px-4 py-2.5 rounded-xl text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-opacity ${actionStyles}`}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : emailStatus === "active" ? (
              "Saved"
            ) : (
              "Subscribe"
            )}
          </button>
        </div>

        {emailEnabled && renderPeriodCheckboxes("email")}
      </div>
    </form>
  );
}
