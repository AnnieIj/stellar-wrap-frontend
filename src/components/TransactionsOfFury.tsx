"use client";

import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronUp } from "lucide-react";
import { useWrapStore } from "../../app/store/wrapStore";

type TxType = "payment" | "trade" | "account";

export interface VirtualTransaction {
  id: string;
  timestamp: number; // epoch ms
  type: TxType;
  from: string;
  to: string;
  amount: number;
  asset: string;
  fee: number;
  memo?: string;
  details: {
    hash: string;
    operations: number;
    effect: string;
  };
}

function formatCompact(n: number): string {
  try {
    return new Intl.NumberFormat(undefined, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  } catch {
    return String(n);
  }
}

function formatAmount(amount: number): string {
  if (!Number.isFinite(amount)) return "0";
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDateTime(epochMs: number): string {
  const d = new Date(epochMs);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeDeterministicAddress(rng: () => number, idx: number): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const prefix = rng() > 0.5 ? "G" : "R";
  let out = prefix;
  for (let i = 0; i < 20; i++) {
    out += alphabet[Math.floor(rng() * alphabet.length)];
  }
  // keep stable but vary
  return out.slice(0, 5) + String(idx % 97).padStart(2, "0") + out.slice(7);
}

function generateTransactions(count: number): VirtualTransaction[] {
  // Stable dataset for consistent virtual measurements.
  const rng = mulberry32(1337);
  const assets = ["XLM", "USDC", "BTC", "ETH", "WAP", "DAI"];
  const types: TxType[] = ["payment", "trade", "account"];
  const effects = [
    "Balance updated",
    "Asset exchanged",
    "Offer created",
    "Trustline modified",
    "Memo recorded",
  ];

  const now = Date.now();
  const oneHour = 1000 * 60 * 60;

  const txs: VirtualTransaction[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const t = types[Math.floor(rng() * types.length)];
    const asset = assets[Math.floor(rng() * assets.length)];
    const amountBase = rng() * 9000 + 0.5;
    const amount = t === "account" ? amountBase * 0.02 : amountBase;
    const fee = Math.max(0.00001, rng() * 0.2);

    const from = makeDeterministicAddress(rng, i);
    const to = makeDeterministicAddress(rng, i + 999);

    const timestamp = now - i * Math.floor(rng() * 6 + 1) * oneHour;

    const memoChance = rng();
    const memo = memoChance > 0.72 ? `memo-${i}-${Math.floor(rng() * 1000)}` : undefined;

    const operations = 1 + Math.floor(rng() * (t === "trade" ? 6 : 3));

    txs[i] = {
      id: `tx_${i}`,
      timestamp,
      type: t,
      from,
      to,
      amount,
      asset,
      fee,
      memo,
      details: {
        hash: `hash_${i}_${Math.floor(rng() * 1e9).toString(16)}`,
        operations,
        effect: effects[Math.floor(rng() * effects.length)],
      },
    };
  }

  return txs;
}

const TRANSACTIONS_COUNT = 10000;

const Overscan = 5;
const ESTIMATED_ROW_HEIGHT = 56; // collapsed default
const EXPANDED_EXTRA_HEIGHT = 86; // details area approximate

type ScrollPersistedState = {
  scrollTop: number;
};

function getStorageKey(addressOrKey: string | null | undefined) {
  return `stellar-wrap-tx-virtual-scroll:${addressOrKey ?? "anon"}`;
}

const TransactionRow = memo(function TransactionRow({
  tx,
  expanded,
  onToggle,
  style,
}: {
  tx: VirtualTransaction;
  expanded: boolean;
  onToggle: () => void;
  style: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className="px-3 py-1"
      role="row"
      aria-expanded={expanded}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={
          "w-full text-left rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
        }
      >
        <div className="flex items-start justify-between gap-3 px-3 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-emerald-300/90">
                {tx.type}
              </span>
              <span className="text-[11px] text-white/50">{tx.asset}</span>
            </div>
            <div className="text-sm font-semibold text-white mt-1 truncate">
              {formatAmount(tx.amount)} {tx.asset}
            </div>
            <div className="text-[12px] text-white/55 mt-1 truncate">
              {tx.from} → {tx.to}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-[12px] text-white/65">{formatDateTime(tx.timestamp)}</div>
            <div className="text-[12px] text-white/45">fee {formatCompact(tx.fee)} XLM</div>
          </div>
        </div>

        <div
          className={
            expanded
              ? "px-3 pb-3 text-[12px] text-white/70"
              : "px-3 pb-0 text-[12px] text-white/70 overflow-hidden"
          }
          style={{
            maxHeight: expanded ? 200 : 0,
            transition: "max-height 180ms ease",
          }}
        >
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <div>
              <div className="text-white/45">hash</div>
              <div className="font-mono break-all">{tx.details.hash}</div>
            </div>
            <div>
              <div className="text-white/45">ops</div>
              <div>{tx.details.operations}</div>
            </div>
            <div className="col-span-2">
              <div className="text-white/45">effect</div>
              <div>{tx.details.effect}</div>
            </div>
            {tx.memo ? (
              <div className="col-span-2">
                <div className="text-white/45">memo</div>
                <div>{tx.memo}</div>
              </div>
            ) : null}
          </div>
        </div>
      </button>
    </div>
  );
});

export default function TransactionsOfFury() {
  // In the current repo, this “Fury” view doesn’t exist yet as a list.
  // We keep wrapStore consumption for ZUSTAND integration.
  const { result, address } = useWrapStore();
  const totalTransactionsFromStore = result?.totalTransactions ?? 0;

  // Mock transaction dataset sized for 10,000+ records.
  const transactions = useMemo(
    () => generateTransactions(Math.max(TRANSACTIONS_COUNT, totalTransactionsFromStore || TRANSACTIONS_COUNT)),
    [totalTransactionsFromStore],
  );

  const total = transactions.length;

  // Expanded rows stored as a Set for O(1) toggles.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const scrollKey = useMemo(() => getStorageKey(address ?? null), [address]);

  const parentRef = useRef<HTMLDivElement | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Scroll persistence: capture/restore scrollTop when remounting.
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(scrollKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ScrollPersistedState;
      if (typeof parsed?.scrollTop === "number" && parentRef.current) {
        parentRef.current.scrollTop = parsed.scrollTop;
      }
    } catch {
      // ignore
    }
    // parentRef is a React ref object; refs are stable and intentionally excluded from deps
  }, [scrollKey]);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;

    const onScroll = () => {
      setShowScrollTop(el.scrollTop > ESTIMATED_ROW_HEIGHT * 50);
      try {
        window.localStorage.setItem(scrollKey, JSON.stringify({ scrollTop: el.scrollTop }));
      } catch {
        // ignore
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollKey]);

  const virtualizer = useVirtualizer({
    count: total,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (ESTIMATED_ROW_HEIGHT),
    overscan: Overscan,
    // Variable heights support: rows measure themselves when
    // expanded/collapsed. Omitting measureElement uses
    // @tanstack/react-virtual's own default implementation (real
    // getBoundingClientRect-based measurement) rather than a custom no-op —
    // this is what "measurement happens automatically" actually requires.
  });

  // Because we’re using measureElement in a generic way, we provide an explicit ref per row.
  // This is the key to supporting variable heights with expanded rows.
  useEffect(() => {
    // Ensure virtualizer recomputes after expansions (variable height changes).
    virtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `virtualizer` is recreated each render by useVirtualizer; adding it to deps would cause an infinite loop
  }, [expandedIds]);

  const [visibleRange, setVisibleRange] = useState({
    from: 0,
    to: 0,
  });

  useEffect(() => {
    const update = () => {
      const items = virtualizer.getVirtualItems();
      if (!items.length) {
        setVisibleRange({ from: 0, to: 0 });
        return;
      }
      const from = items[0]!.index;
      const to = items[items.length - 1]!.index;
      setVisibleRange({ from, to });
    };
    update();
    // virtualizer triggers updates internally; poll on rAF for smoothness.
    let raf = 0;
    const loop = () => {
      update();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [virtualizer]);

  const scrollToTop = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className="relative w-full min-h-[70vh]">
      {/* Top tracker */}
      <div className="sticky top-0 z-20 bg-[#030b0a]/80 backdrop-blur border-b border-white/10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-white/70">
            Showing{" "}
            <span className="text-white font-semibold">
              {total === 0 ? 0 : visibleRange.from + 1}
              {"-"}
              {total === 0 ? 0 : visibleRange.to + 1}
            </span>{" "}
            of{" "}
            <span className="text-white font-semibold">{total}</span>
            {" "}transactions
          </div>
          <div className="text-xs text-white/45">variable height rows supported</div>
        </div>
      </div>

      {/* Virtualized scroll container */}
      <div ref={parentRef} className="h-[65vh] overflow-auto" aria-label="Transactions list">
        <div
          className="relative"
          style={{
            height: virtualizer.getTotalSize(),
            width: "100%",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const tx = transactions[virtualRow.index]!
            const expanded = expandedIds.has(tx.id);

            return (
              <div
                key={tx.id}
                ref={(node) => {
                  virtualizer.measureElement(node);
                }}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <TransactionRow
                  tx={tx}
                  expanded={expanded}
                  onToggle={() => toggleExpanded(tx.id)}
                  style={{}}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Scroll to Top */}
      {showScrollTop ? (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-30 p-3 rounded-full bg-emerald-500/15 border border-emerald-500/40 hover:bg-emerald-500/25 transition-colors"
          aria-label="Scroll to top"
        >
          <ChevronUp className="w-5 h-5 text-emerald-300" />
        </button>
      ) : null}
    </div>
  );
}

