import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface UserSession {
  userId: string;
  username?: string;
  preferences?: Record<string, string>;
  lastActive?: number;
}

interface UserSessionState {
  session: UserSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (session: UserSession) => void;
  logout: () => void;
  updateSessionOptimistic: (
    updates: Partial<UserSession>, 
    apiCall: () => Promise<void>
  ) => Promise<void>;
  clearError: () => void;
}

export const useUserSessionStore = create<UserSessionState>()(
  persist(
    (set, get) => ({
      session: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: (session: UserSession) => {
        set({ 
          session, 
          isAuthenticated: true, 
          error: null 
        });
      },

      logout: () => {
        set({ 
          session: null, 
          isAuthenticated: false, 
          error: null 
        });
      },

      updateSessionOptimistic: async (updates: Partial<UserSession>, apiCall: () => Promise<void>) => {
        const previousSession = get().session;
        if (!previousSession) {
          set({ error: "No active session to update" });
          return;
        }

        // Optimistic update
        set({ 
          session: { ...previousSession, ...updates },
          error: null
        });

        try {
          await apiCall();
        } catch (error: unknown) {
          // Rollback on error
          const errorMessage = error instanceof Error ? error.message : "Failed to update session";
          set({ 
            session: previousSession, 
            error: errorMessage 
          });
        }
      },

      clearError: () => {
        set({ error: null });
      }
    }),
    {
      name: 'user-session-storage',
      storage: createJSONStorage(() => {
        if (typeof window !== "undefined") {
          return localStorage;
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
    }
  )
);
