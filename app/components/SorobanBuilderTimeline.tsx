"use client";

import { motion } from "framer-motion";
import { SorobanBuilderSummary } from "@/app/utils/indexer";

interface SorobanBuilderTimelineProps {
  summary?: SorobanBuilderSummary;
}

export function SorobanBuilderTimeline({ summary }: SorobanBuilderTimelineProps) {
  const hasDeployments = summary && summary.deploymentCount > 0;
  const hasCalls = summary && summary.contractCallCount > 0;

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const truncateContractId = (id: string) => {
    if (id.length <= 8) return id;
    return `${id.slice(0, 4)}...${id.slice(-4)}`;
  };

  const truncateTxHash = (hash: string) => {
    if (hash.length <= 12) return hash;
    return `${hash.slice(0, 6)}...${hash.slice(-6)}`;
  };

  const getStellarExpertLink = (hash: string, network: "mainnet" | "testnet" = "mainnet") => {
    return `https://stellar.expert/explorer/${network}/tx/${hash}`;
  };

  const getContractLink = (contractId: string, network: "mainnet" | "testnet" = "mainnet") => {
    return `https://stellar.expert/explorer/${network}/contract/${contractId}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.0 }}
      className="mt-6 sm:mt-8"
    >
      <h3 className="text-xs sm:text-sm font-black tracking-[0.25em] text-white/50 mb-3 sm:mb-4">
        SOROBAN BUILDER TIMELINE
      </h3>
      <div className="relative backdrop-blur-sm p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl border border-white/10">
        <div className="relative space-y-4">
          {hasDeployments ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/70">
                  You deployed {summary.deploymentCount} contract{summary.deploymentCount !== 1 ? "s" : ""} this period
                </span>
                <span className="text-lg font-black text-white">
                  Score: {summary.builderScore}
                </span>
              </div>

              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-white/20" />
                <div className="space-y-6">
                  {summary.deployments.slice().reverse().map((deployment, index) => (
                    <motion.div
                      key={deployment.transactionHash}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1.1 + index * 0.1 }}
                      className="relative flex items-start ml-8"
                    >
                      <div className="absolute -left-6 w-4 h-4 rounded-full bg-theme-primary border-2 border-white shadow-lg" />
                      <div className="flex-1">
                        <div className="flex flex-wrap gap-2 items-center mb-1">
                          <a
                            href={getContractLink(deployment.contractId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-base font-bold text-white hover:text-theme-primary transition-colors"
                          >
                            Contract: {truncateContractId(deployment.contractId)}
                          </a>
                          <span className="text-sm text-white/50">•</span>
                          <span className="text-sm text-white/70">
                            {formatDate(deployment.deploymentDate)}
                          </span>
                        </div>
                        <a
                          href={getStellarExpertLink(deployment.transactionHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-white/50 hover:text-theme-primary transition-colors"
                        >
                          Tx: {truncateTxHash(deployment.transactionHash)}
                        </a>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <p className="text-white/70 mb-2">
                No contracts deployed — but you made {hasCalls ? summary?.contractCallCount : "0"} contract calls!
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
