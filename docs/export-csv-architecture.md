# Export CSV Architecture

> Closes #480  
> Last updated: 2026-09-24

---

## Overview

The Export CSV feature lets a connected user download a structured `.csv` snapshot of their Stellar Wrap data — transaction summary, top dApp interactions, and vibe breakdown — directly from the browser without any server round-trip.

---

## Module Map

```
app/
  [locale]/export-csv/
    page.tsx                ← Full-page wallet-connect + export flow
  components/
    CsvExportButton.tsx     ← Embeddable button (uses wrapStore address)
  services/
    csvExportService.ts     ← High-level export orchestrator (asset/dapp CSV)
    csvWalletConnection.ts  ← Freighter connect wrapper for CSV flow
src/
  utils/
    csvExport.ts            ← Low-level CSV formatters & browser download
```

---

## Data Flow

```
User clicks "Export CSV"
        │
        ▼
CsvExportButton / export-csv page
        │   Checks wrapStore for an existing address
        │   If none → calls csvWalletConnection.connectForCsvExport()
        │                  └─ wraps walletConnect.connectFreighter() with
        │                     timeout + AbortSignal + typed error categories
        ▼
csvExportService.generateWalletCsv()
        │   Reads: assets (assetListStore), dapps (wrapStore),
        │          result.totalTransactions, result.persona, result.topVibe
        ▼
csvExportService.downloadCsv()   ─OR─   src/utils/csvExport.exportToCsv()
        │   Creates a Blob → object URL → hidden <a> click → revokeObjectURL
        ▼
Browser downloads "stellar-wrapped-<prefix>-<timestamp>.csv"
```

The full `/export-csv` page additionally surfaces wallet connection states
(`idle | checking | connecting | connected | error | not-installed`) with
rate-limit cooldown and Freighter install prompts.

---

## Amount Precision

Stellar amounts have **7 decimal places** (1 XLM = 10,000,000 stroops).

| Helper | Input | Output |
|--------|-------|--------|
| `formatStroopsToXLM(stroops)` | integer stroops | `"1.2345678"` |
| `formatXlmAmount(xlm)` | float XLM | `"1.2345679"` |
| `formatStellarBalance(balance)` | string balance | `"1.2345678"` |

All three use `.toFixed(7)`.  Never use raw `parseFloat` without clamping to 7 dp.

---

## Connection Error Categories

`csvWalletConnection.ts` maps thrown errors to a typed `ConnectionError`:

| `type` | Cause |
|--------|-------|
| `not_installed` | Freighter extension absent |
| `network_mismatch` | Wallet on wrong Stellar network |
| `user_rejected` | User dismissed the Freighter popup |
| `timeout` | No response within `CONNECTION_TIMEOUT_MS` (30 s) |
| `unknown` | Unexpected error |

The UI maps each `type` to a specific recovery action (install link, network
switch hint, or retry button).

---

## CSV Structure

A generated file contains up to three sections, each with its own header row:

```
Stellar Wrapped 2026 - Wallet Export
Public Key,<address>
Network,<mainnet|testnet>
Export Date,<ISO timestamp>

Summary
Field,Value
Total Transactions,142
Persona,The DeFi Patron
Top Vibe,72% Power User

Assets
Code,Issuer,Balance,Asset Type
XLM,N/A,1000.0000000,native

Top DApps
Name,Interactions,Fan Favorite
Stellar DEX,80,No
```

Fields containing commas, double-quotes, or newlines are RFC-4180 quoted.

---

## How to Add a New Section

1. Add a `buildXxxCsvRows(result: WrapResult): string[][]` function in
   `src/utils/csvExport.ts` (returns a 2D array; first row = headers).
2. Append it to `generateWalletCsv` in `app/services/csvExportService.ts`
   gated behind a new `CsvExportOptions` boolean flag.
3. Expose the flag in `CsvExportButton` and the full export page.

---

## Maintenance Notes

- **No server calls.** The export is entirely client-side; no new API routes
  are needed.
- **No new dependencies.** All CSV serialisation is hand-written; no external
  CSV libraries are used.
- **Stale data:** The export reflects the wrap data already in memory
  (`wrapStore`, `assetListStore`). It does not re-fetch from Horizon.
- **Security:** The Blob URL is revoked after 100 ms to avoid memory leaks.
