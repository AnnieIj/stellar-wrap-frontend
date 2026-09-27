"use client";

import { useState, useCallback } from "react";
import { Download, Wallet, AlertCircle, ExternalLink } from "lucide-react";
import { useWrapStore } from "../store/wrapStore";
import { useAssetListStore } from "../store/assetListStore";
import { connectForCsvExport, checkFreighterAvailability, type ConnectionError, getFreighterInstallUrl } from "../services/csvWalletConnection";
import { exportWalletToCsv, type CsvExportData } from "../services/csvExportService";
import { Network } from "../../src/config";

interface CsvExportButtonProps {
  className?: string;
}

export function CsvExportButton({ className = "" }: CsvExportButtonProps) {
  const { address, network, result, topDapps } = useWrapStore();
  const { assets } = useAssetListStore();
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<ConnectionError | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  const handleConnectAndExport = useCallback(async () => {
    setError(null);
    setIsConnecting(true);

    try {
      // Check if Freighter is installed
      const isInstalled = await checkFreighterAvailability();
      if (!isInstalled) {
        setShowInstallPrompt(true);
        setIsConnecting(false);
        return;
      }

      // Connect to Freighter
      const connectionResult = await connectForCsvExport(network as Network);
      
      // Prepare CSV data
      const csvData: CsvExportData = {
        publicKey: connectionResult.publicKey,
        network: connectionResult.network,
        assets,
        dapps: topDapps,
        transactions: result?.totalTransactions,
        persona: result?.persona,
        topVibe: result?.topVibe?.type,
        vibePercentage: result?.topVibe?.percentage,
      };

      // Export to CSV
      setIsExporting(true);
      exportWalletToCsv(csvData);
      
      // Reset states
      setIsConnecting(false);
      setIsExporting(false);
    } catch (err) {
      setIsConnecting(false);
      setIsExporting(false);
      setError(err as ConnectionError);
    }
  }, [network, assets, topDapps, result]);

  const handleRetry = useCallback(() => {
    setError(null);
    setShowInstallPrompt(false);
    handleConnectAndExport();
  }, [handleConnectAndExport]);

  const handleCancel = useCallback(() => {
    setError(null);
    setShowInstallPrompt(false);
    setIsConnecting(false);
  }, []);

  // If already connected via wrapStore, show export button directly
  if (address && !error && !showInstallPrompt) {
    return (
      <button
        onClick={() => {
          const csvData: CsvExportData = {
            publicKey: address,
            network: network as Network,
            assets,
            dapps: topDapps,
            transactions: result?.totalTransactions,
            persona: result?.persona,
            topVibe: result?.topVibe?.type,
            vibePercentage: result?.topVibe?.percentage,
          };
          exportWalletToCsv(csvData);
        }}
        disabled={isExporting}
        className={`flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-theme-primary ${className}`}
        aria-label="Export wallet data to CSV"
      >
        <Download className="w-4 h-4" />
        <span className="text-sm font-medium">
          {isExporting ? "Exporting..." : "Export CSV"}
        </span>
      </button>
    );
  }

  // Show install prompt if Freighter is not installed
  if (showInstallPrompt) {
    return (
      <div className={`p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg ${className}`}>
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-yellow-400 mb-2">
              Freighter Wallet Required
            </p>
            <p className="text-xs text-white/70 mb-3">
              To export your wallet data, you need to install the Freighter browser extension.
            </p>
            <div className="flex items-center gap-2">
              <a
                href={getFreighterInstallUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-yellow-400 hover:text-yellow-300 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Install Freighter
              </a>
              <button
                onClick={handleRetry}
                className="text-xs font-medium text-white/70 hover:text-white transition-colors"
              >
                Retry
              </button>
              <button
                onClick={handleCancel}
                className="text-xs font-medium text-white/70 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className={`p-4 bg-red-500/10 border border-red-500/30 rounded-lg ${className}`}>
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-400 mb-2">
              Connection Error
            </p>
            <p className="text-xs text-white/70 mb-3">
              {error.message}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRetry}
                className="text-xs font-medium text-white/70 hover:text-white transition-colors"
              >
                Retry
              </button>
              <button
                onClick={handleCancel}
                className="text-xs font-medium text-white/70 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show connect button
  return (
    <button
      onClick={handleConnectAndExport}
      disabled={isConnecting}
      className={`flex items-center gap-2 px-4 py-2 bg-theme-primary hover:bg-theme-primary/80 text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-theme-primary ${className}`}
      aria-label="Connect wallet and export CSV"
    >
      <Wallet className="w-4 h-4" />
      <span className="text-sm font-medium">
        {isConnecting ? "Connecting..." : "Connect & Export CSV"}
      </span>
    </button>
  );
}

export default CsvExportButton;
