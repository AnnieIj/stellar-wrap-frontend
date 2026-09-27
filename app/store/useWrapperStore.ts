import { create } from "zustand";
import { persist } from "zustand/middleware";

interface DappData {
  name: string;
  logo?: string;
  interactions: number;
  isFanFavorite?: boolean;
}

interface WrapperStore {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  data: {
    topDapps: DappData[];
  };
  setAddress: (address: string) => void;
  setConnecting: (isConnecting: boolean) => void;
  setError: (error: string | null) => void;
  setTopDapps: (dapps: DappData[]) => void;
  disconnect: () => void;
}

export const useWrapperStore = create<WrapperStore>()(
  persist(
    (set) => ({
      address: null,
      isConnected: false,
      isConnecting: false,
      error: null,
      data: {
        topDapps: [
          { name: "Mercurius", interactions: 187, isFanFavorite: true },
          { name: "Phoenix", interactions: 142 },
          { name: "Blend", interactions: 91 },
        ],
      },
      setAddress: (address: string) =>
        set({ address, isConnected: true, isConnecting: false, error: null }),
      setConnecting: (isConnecting: boolean) => set({ isConnecting, error: null }),
      setError: (error: string | null) => set({ error, isConnecting: false }),
      setTopDapps: (topDapps: DappData[]) =>
        set((state) => ({ data: { ...state.data, topDapps } })),
      disconnect: () => set({ address: null, isConnected: false, error: null }),
    }),
    {
      name: "wrapper-store",
      partialize: (state: WrapperStore) => ({
        address: state.address,
        isConnected: state.isConnected,
        data: state.data,
      }),
    }
  )
);
