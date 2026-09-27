import {
  Contract,
  TransactionBuilder,
  Address,
  xdr,
  Account,
  nativeToScVal,
} from "stellar-sdk";
import { Server, Api } from "stellar-sdk/rpc";
import { Network, NETWORK_PASSPHRASES, SOROBAN_RPC_URLS } from "@/src/config";
import { getContractAddress } from "@/config/contracts";

export interface WrapRecord {
  period: string;
  periodLabel: string;
  archetype: string;
  transactionCount: number;
  totalVolume?: number;
  mintedAt?: number;
}

/** Generate monthly period keys for the last N months (e.g. "2026-01") */
export function generateMonthlyPeriods(count = 12): { key: string; label: string }[] {
  const periods: { key: string; label: string }[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const key = `${year}-${month}`;
    const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    periods.push({ key, label });
  }

  return periods.reverse();
}

const STANDARD_PERIODS = [
  { key: "weekly", label: "This Week" },
  { key: "monthly", label: "This Month" },
  { key: "yearly", label: "This Year" },
];

function parseWrapResult(val: xdr.ScVal): Partial<WrapRecord> | null {
  try {
    if (val.switch().name === "scvVoid") return null;

    if (val.switch().name === "scvMap") {
      const entries = val.map();
      const record: Record<string, unknown> = {};
      if (entries) {
        entries.forEach((entry) => {
          const k = entry.key().str?.().toString() ?? entry.key().sym?.().toString() ?? "";
          const v = entry.val();
          if (v.switch().name === "scvString") record[k] = v.str().toString();
          else if (v.switch().name === "scvU32") record[k] = v.u32();
          else if (v.switch().name === "scvU64") record[k] = Number(v.u64());
          else if (v.switch().name === "scvI64") record[k] = Number(v.i64());
        });
      }
      return {

        archetype: (record.archetype as string) ?? (record.persona as string),
        transactionCount: (record.transaction_count as number) ?? (record.tx_count as number) ?? 0,
        totalVolume: record.total_volume as number | undefined,
      };
    }

    if (val.switch().name === "scvVec") {
      const vec = val.vec();
      if (vec && vec.length >= 2) {
        const archetype = vec[0].switch().name === "scvString" ? vec[0].str().toString() : undefined;
        const txCount = vec[1].switch().name === "scvU32" ? vec[1].u32() : undefined;
        return { archetype, transactionCount: txCount ?? 0 };
      }
    }
  } catch {
    return null;
  }
  return null;
}

async function queryGetWrap(
  userAddress: string,
  period: string,
  network: Network,
): Promise<Partial<WrapRecord> | null> {
  try {
    const contractAddress = getContractAddress(network);
    const contract = new Contract(contractAddress);
    const server = new Server(SOROBAN_RPC_URLS[network], {
      allowHttp: SOROBAN_RPC_URLS[network].startsWith("http://"),
    });

    const sourceAccount = new Account(userAddress, "0");
    const tx = new TransactionBuilder(sourceAccount, {
      fee: "100",
      networkPassphrase: NETWORK_PASSPHRASES[network],
    })
      .addOperation(
        contract.call(
          "get_wrap",
          new Address(userAddress).toScVal(),
          nativeToScVal(period, { type: "string" }),
        ),
      )
      .setTimeout(30)
      .build();

    const simulation = await server.simulateTransaction(tx);
    if (Api.isSimulationError(simulation)) return null;

    const result = simulation.result?.retval;
    if (!result) return null;

    return parseWrapResult(result);
  } catch {
    return null;
  }
}

/**
 * Query the contract for wraps across known periods.
 * Falls back to current session data when contract reads fail.
 */
export async function fetchUserWrapHistory(
  userAddress: string,
  network: Network,
  currentArchetype?: string,
  currentTxCount?: number,
): Promise<WrapRecord[]> {
  const allPeriods = [...STANDARD_PERIODS, ...generateMonthlyPeriods(12)];

  const results: WrapRecord[] = [];

  for (const { key, label } of allPeriods) {
    const data = await queryGetWrap(userAddress, key, network);
    if (data?.archetype) {
      results.push({
        period: key,
        periodLabel: label,
        archetype: data.archetype,
        transactionCount: data.transactionCount ?? 0,
        totalVolume: data.totalVolume,
      });
    }
  }

  if (currentArchetype && !results.some((r) => r.archetype === currentArchetype)) {
    const currentPeriod = allPeriods[allPeriods.length - 1];
    results.push({
      period: currentPeriod?.key ?? "current",
      periodLabel: currentPeriod?.label ?? "Current",
      archetype: currentArchetype,
      transactionCount: currentTxCount ?? 0,
    });
  }

  if (results.length === 0 && currentArchetype) {
    return [
      {
        period: "current",
        periodLabel: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        archetype: currentArchetype,
        transactionCount: currentTxCount ?? 0,
      },
    ];
  }

  return results;
}

/** Demo wraps for showcasing timeline with multiple periods */
export function getDemoWrapHistory(currentArchetype: string, txCount: number): WrapRecord[] {
  const months = generateMonthlyPeriods(3);
  const archetypes = ["The Explorer", currentArchetype, "The Wizard"];
  return months.map((m, i) => ({
    period: m.key,
    periodLabel: m.label,
    archetype: archetypes[i] ?? currentArchetype,
    transactionCount: Math.round(txCount * (0.5 + i * 0.25)),
  }));
}
