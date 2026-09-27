/**
 * CSV Export Service
 * Exports wallet data to CSV format with proper Stellar amount handling
 */

import type { WalletAsset } from "../store/assetListStore";
import type { DappData } from "../store/wrapStore";

export interface CsvExportData {
  publicKey: string;
  network: string;
  assets: WalletAsset[];
  dapps?: DappData[];
  transactions?: number;
  persona?: string;
  topVibe?: string;
  vibePercentage?: number;
}

export interface CsvExportOptions {
  includeAssets: boolean;
  includeDapps: boolean;
  includeSummary: boolean;
}

/**
 * Formats a Stellar balance string to a human-readable number
 * Handles the 7 decimal precision (stroops) for Stellar
 */
export function formatStellarBalance(balance: string): string {
  const num = parseFloat(balance);
  if (isNaN(num)) return "0";

  // Stellar uses 7 decimal places (stroops)
  return num.toFixed(7);
}

/**
 * Converts a balance string to a number for calculations
 */
export function balanceToNumber(balance: string): number {
  return parseFloat(balance) || 0;
}

/**
 * Escapes a CSV field value
 */
function escapeCsvField(value: string): string {
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/**
 * Generates CSV content from wallet data
 */
export function generateWalletCsv(
  data: CsvExportData,
  options: CsvExportOptions,
): string {
  const lines: string[] = [];

  // Header section
  lines.push("Stellar Wrapped 2026 - Wallet Export");
  lines.push(`Public Key,${escapeCsvField(data.publicKey)}`);
  lines.push(`Network,${escapeCsvField(data.network)}`);
  lines.push(`Export Date,${escapeCsvField(new Date().toISOString())}`);
  lines.push("");

  // Summary section
  if (options.includeSummary) {
    lines.push("Summary");
    lines.push("Field,Value");
    lines.push(`Total Transactions,${data.transactions ?? 0}`);
    lines.push(`Persona,${escapeCsvField(data.persona ?? "N/A")}`);
    if (data.topVibe && data.vibePercentage !== undefined) {
      lines.push(`Top Vibe,${escapeCsvField(`${data.vibePercentage}% ${data.topVibe}`)}`);
    }
    lines.push("");
  }

  // Assets section
  if (options.includeAssets && data.assets.length > 0) {
    lines.push("Assets");
    lines.push("Code,Issuer,Balance,Asset Type");
    
    for (const asset of data.assets) {
      const code = escapeCsvField(asset.code);
      const issuer = escapeCsvField(asset.issuer ?? "N/A");
      const balance = formatStellarBalance(asset.balance);
      const assetType = escapeCsvField(asset.assetType);
      
      lines.push(`${code},${issuer},${balance},${assetType}`);
    }
    lines.push("");
  }

  // DApps section
  if (options.includeDapps && data.dapps && data.dapps.length > 0) {
    lines.push("Top DApps");
    lines.push("Name,Interactions,Fan Favorite");
    
    for (const dapp of data.dapps) {
      const name = escapeCsvField(dapp.name);
      const interactions = dapp.interactions;
      const fanFavorite = dapp.isFanFavorite ? "Yes" : "No";
      
      lines.push(`${name},${interactions},${fanFavorite}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Downloads the CSV file
 */
export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Exports wallet data to CSV with default options
 */
export function exportWalletToCsv(
  data: CsvExportData,
  options: Partial<CsvExportOptions> = {},
): void {
  const defaultOptions: CsvExportOptions = {
    includeAssets: true,
    includeDapps: true,
    includeSummary: true,
  };

  const finalOptions = { ...defaultOptions, ...options };
  const csvContent = generateWalletCsv(data, finalOptions);
  const filename = `stellar-wrapped-${data.publicKey.slice(0, 8)}-${Date.now()}.csv`;
  
  downloadCsv(csvContent, filename);
}
