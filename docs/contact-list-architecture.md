# Contact List Architecture

> Closes #479  
> Last updated: 2026-09-24

---

## Overview

The **Contact List** feature provides a persisted, client-side address book of
Stellar public keys. It allows users to save frequently used addresses (e.g.
friend wallets, project accounts) and recall them in one tap when connecting or
sending via the Stellar Wrap interface.

---

## Module Map

```
app/
  store/
    walletStore.ts          ← Active session (single connected address)
  hooks/
    useHydrateWallet.ts     ← Re-validates the persisted session on load
  utils/
    walletConnect.ts        ← Provider connection helpers + address validation
    walletConnectManager.ts ← WalletConnect protocol bridge
  [locale]/connect/
    page.tsx                ← Connect flow; reads/writes lastUsedStellarAddress
src/
  utils/
    validateStellarAddress.ts ← Address format + checksum validation
```

> **Note:** There is currently no standalone `ContactList` component file.
> The "contact list" behaviour is distributed across the modules above.
> This document describes the architecture so future contributors can locate,
> extend, or extract it into a dedicated component.

---

## Data Flow

```
User enters / selects an address
          │
          ▼
ConnectPage (app/[locale]/connect/page.tsx)
          │  1. Validates format via useStellarAddressValidation
          │  2. On success → writes to localStorage["lastUsedStellarAddress"]
          │  3. Calls connectWalletSession() → persists to walletStore
          ▼
walletStore (Zustand + zustand/middleware/persist)
          │  Persists to localStorage["stellar-wrap-wallet"]:
          │    { address, provider, isConnected, networkLabel,
          │      connectedAt, needsReconnect }
          ▼
useHydrateWallet (app/hooks/useHydrateWallet.ts)
          │  On app load, re-validates the persisted session against
          │  the live wallet extension (network match, availability).
          │  Sets needsReconnect if the session is stale.
          ▼
ConnectPage "last-used address" shortcut
          Reads localStorage["lastUsedStellarAddress"] to pre-fill the address
          input, offering a one-tap reconnect to returning users.
```

---

## State Schema

### `walletStore` (persisted slice)

| Field | Type | Description |
|-------|------|-------------|
| `address` | `string \| null` | Active Stellar public key (56-char G…) |
| `provider` | `WalletProvider \| null` | How the address was obtained |
| `isConnected` | `boolean` | Live session flag |
| `networkLabel` | `string \| null` | `"mainnet"` or `"testnet"` |
| `connectedAt` | `number \| null` | `Date.now()` at connection time |
| `needsReconnect` | `boolean` | Session is stale; prompt user to re-connect |
| `isDisconnecting` | `boolean` | Optimistic disconnect in progress (transient, not persisted) |

### `WalletProvider` values

| Value | Meaning |
|-------|---------|
| `"freighter"` | Freighter browser extension |
| `"albedo"` | Albedo browser extension |
| `"xbull"` | xBull browser extension |
| `"walletconnect"` | WalletConnect mobile/QR flow |
| `"manual"` | Address typed manually (no signing capability) |
| `"demo"` | Demo mode — mock address, no real wallet |

---

## Address Validation

All addresses are validated in two stages:

1. **Format check** (`isValidStellarAddress` in `walletConnect.ts`):
   - Must start with `G`
   - Must be exactly 56 characters
   - Must match base-32 alphabet (`[A-Z2-7]`)

2. **Async validation** (`useStellarAddressValidation` hook):
   - Optionally queries Horizon to confirm the account exists on the selected
     network before proceeding to the loading screen.
   - Exposes `validationState: 'idle' | 'validating' | 'valid' | 'invalid'`
     so the UI can show a spinner during network checks.

---

## Session Persistence & Re-validation

Wallet sessions survive page refreshes via Zustand's `persist` middleware
writing to `localStorage["stellar-wrap-wallet"]`.

On every app load `useHydrateWallet` runs a non-interactive probe:

- **Freighter**: checks extension availability + network passphrase match.
- **Albedo / xBull**: checks extension availability.
- **WalletConnect**: treated as still-connected (no non-interactive probe).
- **manual / demo**: treated as still-connected (no live wallet to check).

If the probe fails, `markNeedsReconnect()` is called and the UI shows a
"Reconnect" prompt instead of treating the session as live.

---

## Optimistic Disconnect

Disconnect is **optimistic** (see `walletStore.optimisticDisconnect`):

1. Connection state is cleared immediately → UI reflects disconnection at once.
2. Async cleanup runs (cache wipe, `localStorage` removal).
3. On failure the snapshot is restored and `error` is set, so the user is
   informed and can retry.

See `app/components/Navbar.tsx` for the reference implementation.

---

## How to Extend: Saved Address Book

To build a multi-address contact list on top of this foundation:

1. Create `app/store/contactListStore.ts` with a `contacts: ContactEntry[]`
   slice, persisted to `localStorage["stellar-wrap-contacts"]`.
   ```ts
   interface ContactEntry {
     id: string;           // uuid
     address: string;      // Stellar public key
     label: string;        // user-visible name
     network: "mainnet" | "testnet";
     addedAt: number;      // Date.now()
   }
   ```
2. Add CRUD actions: `addContact`, `removeContact`, `updateLabel`.
3. In `ConnectPage`, render a `<ContactListPicker>` component above the manual
   input that maps over `contacts` and calls `handleRawAddressChange` on
   selection — reusing all existing validation and connect logic.
4. After a successful connection, offer "Save this address?" to append it to the
   contact list (only if not already saved).

---

## Maintenance Notes

- **Single active session.** `walletStore` holds one address at a time; it is
  not a multi-account store.
- **No server-side storage.** All persistence is via `localStorage`; clearing
  browser storage will remove saved addresses.
- **TypeScript strictness.** `WalletProvider` is a closed union — adding a new
  provider requires updating the `validateWalletConnection` switch statement in
  `walletConnect.ts` to avoid the exhaustiveness fallback.
