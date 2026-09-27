import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  NotificationPreferences,
  PeriodPrefs,
} from "@/app/types/notifications";

type SyncStatus = "idle" | "syncing" | "error" | "synced";
type EmailStatus = "inactive" | "pending" | "active";

const defaultPeriodPrefs: PeriodPrefs = {
  weekly: false,
  monthly: false,
  yearly: false,
};

const defaultState: NotificationPreferences = {
  walletAddress: null,
  pushEnabled: false,
  emailEnabled: false,
  email: null,
  emailStatus: "inactive",
  periods: {
    push: { ...defaultPeriodPrefs },
    email: { ...defaultPeriodPrefs },
  },
  permissionDenied: false,
  consentGiven: false,
  syncStatus: "idle",
  lastKnownRemoteState: null,
};

interface NotificationStoreActions {
  setWalletAddress: (address: string | null) => void;
  setConsentGiven: (value: boolean) => void;
  setPermissionDenied: (value: boolean) => void;
  setPushEnabled: (value: boolean) => void;
  setEmailEnabled: (value: boolean) => void;
  setEmail: (email: string | null) => void;
  setEmailStatus: (status: EmailStatus) => void;
  setPeriods: (periods: NotificationPreferences["periods"]) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setLastKnownRemoteState: (
    state: Partial<NotificationPreferences> | null,
  ) => void;
  reset: () => void;
}

export type NotificationStore = NotificationPreferences & NotificationStoreActions;

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set) => ({
      ...defaultState,

      setWalletAddress: (walletAddress) => set({ walletAddress }),
      setConsentGiven: (consentGiven) => set({ consentGiven }),
      setPermissionDenied: (permissionDenied) => set({ permissionDenied }),
      setPushEnabled: (pushEnabled) => set({ pushEnabled }),
      setEmailEnabled: (emailEnabled) => set({ emailEnabled }),
      setEmail: (email) => set({ email }),
      setEmailStatus: (emailStatus) => set({ emailStatus }),
      setPeriods: (periods) => set({ periods }),
      setSyncStatus: (syncStatus) => set({ syncStatus }),
      setLastKnownRemoteState: (lastKnownRemoteState) =>
        set({ lastKnownRemoteState }),
      reset: () => set({ ...defaultState }),
    }),
    {
      name: "stellar-wrap-notifications",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            },
      ),
      partialize: (state) => ({
        walletAddress: state.walletAddress,
        pushEnabled: state.pushEnabled,
        emailEnabled: state.emailEnabled,
        email: state.email,
        emailStatus: state.emailStatus,
        periods: state.periods,
        permissionDenied: state.permissionDenied,
        consentGiven: state.consentGiven,
        lastKnownRemoteState: state.lastKnownRemoteState,
      }),
    },
  ),
);
