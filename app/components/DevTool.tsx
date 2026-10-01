"use client";

import { useWrapperStore } from "@/src/store/useWrapperStore";
import { useWrapStore } from "@/app/store/wrapStore";
import { isPlaceholderContractAddress } from "@/config/contracts";

/**
 * DevTool — floating developer panel (dev-only, never rendered in production).
 *
 * Surfaces:
 * - Mock-mode toggle
 * - Active network label
 * - Configured contract address for the selected network, with clear
 *   "unconfigured / placeholder" messaging when no real address is set.
 *   Reacts automatically whenever the user switches networks.
 */
export function DevTool() {
  const { isMock, toggleMockMode } = useWrapperStore();
  const { network, currentContractAddress } = useWrapStore();

  // Only render in development to avoid exposing dev controls in production
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const isPlaceholder =
    !currentContractAddress ||
    isPlaceholderContractAddress(currentContractAddress);

  /**
   * Shorten a full 56-char contract address to "CABC…XYZ" for display.
   * Leaves placeholder/null values untouched.
   */
  function truncateAddress(addr: string | null): string {
    if (!addr) return "—";
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }

  return (
    <div
      data-testid="dev-tool"
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 min-w-[220px]"
    >
      {/* ── Contract address badge ───────────────────────────────────── */}
      <div
        data-testid="contract-address-panel"
        className={`rounded-xl px-3 py-2 text-xs font-mono shadow-lg border ${
          isPlaceholder
            ? "bg-yellow-900/80 border-yellow-600/60 text-yellow-300"
            : "bg-gray-900/90 border-gray-700/60 text-gray-300"
        }`}
      >
        {/* Network label */}
        <div className="flex items-center justify-between mb-1">
          <span className="font-sans font-semibold uppercase tracking-widest text-[10px] text-gray-400">
            Network
          </span>
          <span
            data-testid="network-label"
            className={`font-sans font-bold text-[10px] uppercase px-1.5 py-0.5 rounded ${
              network === "mainnet"
                ? "bg-blue-800/70 text-blue-200"
                : "bg-purple-800/70 text-purple-200"
            }`}
          >
            {network}
          </span>
        </div>

        {/* Contract address row */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-sans text-[10px] text-gray-400 shrink-0">
            Contract
          </span>
          {isPlaceholder ? (
            <span
              data-testid="contract-address-unconfigured"
              className="text-yellow-400 font-sans italic text-[10px]"
              title={`Set NEXT_PUBLIC_CONTRACT_ADDRESS_${network.toUpperCase()} to enable minting`}
            >
              ⚠ Not configured
            </span>
          ) : (
            <span
              data-testid="contract-address-value"
              title={currentContractAddress ?? ""}
              className="text-green-400 cursor-help"
            >
              {truncateAddress(currentContractAddress)}
            </span>
          )}
        </div>

        {/* Hint line shown only when placeholder */}
        {isPlaceholder && (
          <p
            data-testid="contract-address-hint"
            className="mt-1 font-sans text-[9px] text-yellow-500/80 leading-tight"
          >
            {`Set NEXT_PUBLIC_CONTRACT_ADDRESS_${network.toUpperCase()}`}
          </p>
        )}
      </div>

      {/* ── Mock-mode toggle ─────────────────────────────────────────── */}
      <button
        data-testid="mock-mode-toggle"
        onClick={toggleMockMode}
        className={`px-4 py-2 rounded-full font-bold text-sm shadow-lg transition-all active:scale-95 ${
          isMock
            ? "bg-green-500 text-white"
            : "bg-gray-800 text-gray-300 hover:bg-gray-700"
        }`}
      >
        {isMock ? "Mock Mode: ON" : "Mock Mode: OFF"}
      </button>
    </div>
  );
}
