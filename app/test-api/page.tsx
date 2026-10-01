"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AssetDisplay } from "@/app/components/AssetDisplay";
import { formatDappDisplayName } from "@/app/utils/formatDappLabel";

export default function TestAPIPage() {
  type Dapp = {
    name: string;
    transactionCount: number;
    volume: number;
  };

  type Vibe = {
    tag: string;
    count: number;
  };

  type APIResult = {
    totalTransactions: number;
    totalVolume: number;
    mostActiveAsset: string;
    contractCalls: number;
    dapps: Dapp[];
    vibes: Vibe[];
    cached?: boolean;
  };

  const [accountId, setAccountId] = useState(
    "GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTQAJS2Y47TCM7QUIE2DBNHJQ",
  );
  const [network, setNetwork] = useState<"mainnet" | "testnet">("testnet");
  const [period, setPeriod] = useState<
    "weekly" | "biweekly" | "monthly" | "yearly"
  >("monthly");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<APIResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(
        `/api/wrapped?accountId=${encodeURIComponent(accountId)}&network=${network}&period=${period}`,
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-theme-background p-8">
      <motion.div
        className="max-w-2xl mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl font-bold text-white mb-8">Test Horizon API</h1>

        <div className="space-y-6 bg-black/50 p-6 rounded-xl border border-white/10">
          {/* Account ID Input */}
          <div>
            <label className="block text-sm font-semibold text-white/80 mb-2">
              Stellar Account ID
            </label>
            <input
              type="text"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/40"
              placeholder="GBXXXXXXX..."
            />
            <p className="text-xs text-white/40 mt-2">
              Default: A testnet account with transactions
            </p>
          </div>

          {/* Network Select */}
          <div>
            <label className="block text-sm font-semibold text-white/80 mb-2">
              Network
            </label>
            <div className="flex gap-4">
              {(["mainnet", "testnet"] as const).map((net) => (
                <button
                  key={net}
                  onClick={() => setNetwork(net)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    network === net
                      ? "bg-blue-500 text-white"
                      : "bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  {net.charAt(0).toUpperCase() + net.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Period Select */}
          <div>
            <label className="block text-sm font-semibold text-white/80 mb-2">
              Period
            </label>
            <div className="flex gap-4">
              {(["weekly", "biweekly", "monthly", "yearly"] as const).map(
                (p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                      period === p
                        ? "bg-blue-500 text-white"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ),
              )}
            </div>
          </div>

          {/* Test Button */}
          <button
            onClick={handleTest}
            disabled={loading}
            className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white font-bold rounded-lg transition-all"
          >
            {loading ? "Testing..." : "Test API"}
          </button>

          {/* Error Display */}
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg"
            >
              <p className="text-red-400 font-semibold">Error:</p>
              <p className="text-red-400/80 text-sm">{error}</p>
            </motion.div>
          )}

          {/* Result Display */}
          {result && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg"
            >
              <p className="text-green-400 font-semibold mb-3">✓ Success!</p>
              <div className="space-y-2 text-sm text-green-400/80 font-mono">
                <p>
                  <span className="font-semibold">Total Transactions:</span>{" "}
                  {result.totalTransactions}
                </p>
                <p>
                  <span className="font-semibold">Total Volume:</span>{" "}
                  {result.totalVolume.toFixed(2)} XLM
                </p>
                <div className="flex items-center gap-2 text-sm text-green-400/80 font-mono">
                  <span className="font-semibold">Most Active Asset:</span>{" "}
                  {/* {result.mostActiveAsset} */}
                  <AssetDisplay
                    code={result.mostActiveAsset}
                    showLogo={true}
                    showCode={true}
                    showFullName={true}
                    size="sm"
                  />
                </div>
                <p>
                  <span className="font-semibold">Contract Calls:</span>{" "}
                  {result.contractCalls}
                </p>
                <p>
                  <span className="font-semibold">Dapps Found:</span>{" "}
                  {result.dapps.length}
                </p>
                {result.dapps.length > 0 && (
                  <div className="mt-3">
                    <p className="font-semibold mb-2">Dapps:</p>
                    <ul className="space-y-1 ml-4">
                      {result.dapps.map((dapp: Dapp) => (
                        <li key={dapp.name}>
                          • {formatDappDisplayName(dapp.name)}: {dapp.transactionCount} tx,{" "}
                          {dapp.volume.toFixed(2)} XLM
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p>
                  <span className="font-semibold">Vibes:</span>{" "}
                  {result.vibes.length} detected
                </p>
                {result.vibes.length > 0 && (
                  <ul className="space-y-1 ml-4">
                    {result.vibes.map((vibe: Vibe) => (
                      <li key={vibe.tag}>
                        • {vibe.tag} ({vibe.count})
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs mt-3 text-white/40">
                  Cached: {result.cached ? "Yes" : "No"}
                </p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Instructions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 p-6 bg-blue-500/10 border border-blue-500/30 rounded-xl"
        >
          <h2 className="text-lg font-semibold text-white mb-3">
            Instructions
          </h2>
          <ul className="text-white/70 space-y-2 text-sm">
            <li>
              • Enter a valid Stellar account ID (starts with &apos;G&apos;, 56
              characters)
            </li>
            <li>• Select mainnet or testnet network</li>
            <li>• Select a wrap period (7, 30, or 365 days)</li>
            <li>
              • Click &quot;Test API&quot; to fetch real blockchain data from
              Horizon
            </li>
            <li>
              • Results will show transaction metrics, dapps, and vibes detected
            </li>
          </ul>
        </motion.div>

        {/* Example Accounts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6 p-6 bg-white/5 border border-white/10 rounded-xl"
        >
          <h2 className="text-lg font-semibold text-white mb-3">
            Example Testnet Accounts
          </h2>
          <p className="text-white/60 text-sm mb-4">
            If you don&apos;t have a testnet account, you can use these:
          </p>
          <div className="space-y-2">
            <button
              onClick={() =>
                setAccountId(
                  "GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTQAJS2Y47TCM7QUIE2DBNHJQ",
                )
              }
              className="w-full text-left p-3 bg-white/5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-all truncate text-xs font-mono"
            >
              GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTQAJS2Y47TCM7QUIE2DBNHJQ
            </button>
          </div>
          <p className="text-white/40 text-xs mt-3">
            These accounts have transaction history on Stellar testnet.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
