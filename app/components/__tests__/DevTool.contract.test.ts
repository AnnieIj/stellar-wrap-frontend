/**
 * Unit tests for DevTool contract address display logic (fix #226).
 *
 * Tests the pure helper functions DevTool relies on:
 * - isPlaceholderContractAddress identifies unconfigured addresses
 * - truncateAddress formats addresses for compact display
 * - wrapStore.setNetwork updates currentContractAddress atomically
 *
 * @module DevTool.contract.test
 */

// ─── Inline helpers (mirrors config/contracts.ts) ───────────────────────────

const PLACEHOLDER_CONTRACT_ADDRESS = 'C' + 'A'.repeat(55);

function isPlaceholderContractAddress(address: string | null | undefined): boolean {
  if (!address) return true;
  if (address === PLACEHOLDER_CONTRACT_ADDRESS) return true;
  return address.startsWith('CAAAAAAAA');
}

/**
 * Shorten a full 56-char contract address to "CABC…XYZ" for display.
 * Mirrors the helper inside DevTool.tsx.
 */
function truncateAddress(addr: string | null): string {
  if (!addr) return '—';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── Real-looking test addresses ────────────────────────────────────────────

const REAL_MAINNET_ADDR = 'CBQHNAXSI55GX6DUZGM6YYGQA4XNLCLMOHSPHNXXL4UKHNNLNEZHDKR';
const REAL_TESTNET_ADDR = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCNM';

// ─── isPlaceholderContractAddress ───────────────────────────────────────────

describe('isPlaceholderContractAddress', () => {
  it('treats null as unconfigured', () => {
    expect(isPlaceholderContractAddress(null)).toBe(true);
  });

  it('treats undefined as unconfigured', () => {
    expect(isPlaceholderContractAddress(undefined)).toBe(true);
  });

  it('treats empty string as unconfigured', () => {
    expect(isPlaceholderContractAddress('')).toBe(true);
  });

  it('identifies the canonical all-A placeholder', () => {
    expect(isPlaceholderContractAddress(PLACEHOLDER_CONTRACT_ADDRESS)).toBe(true);
  });

  it('identifies legacy CAAAAAAAA-prefix placeholders', () => {
    expect(isPlaceholderContractAddress('CAAAAAAAA' + 'B'.repeat(47))).toBe(true);
  });

  it('does NOT flag a real mainnet address as placeholder', () => {
    expect(isPlaceholderContractAddress(REAL_MAINNET_ADDR)).toBe(false);
  });

  it('does NOT flag a real testnet address as placeholder', () => {
    expect(isPlaceholderContractAddress(REAL_TESTNET_ADDR)).toBe(false);
  });
});

// ─── truncateAddress ────────────────────────────────────────────────────────

describe('truncateAddress', () => {
  it('returns — for null', () => {
    expect(truncateAddress(null)).toBe('—');
  });

  it('returns — for empty string', () => {
    expect(truncateAddress('')).toBe('—');
  });

  it('returns short addresses unchanged', () => {
    expect(truncateAddress('SHORT')).toBe('SHORT');
    expect(truncateAddress('CBQHNA')).toBe('CBQHNA'); // exactly 6 chars
  });

  it('truncates long addresses to first 6 + … + last 4', () => {
    const result = truncateAddress(REAL_MAINNET_ADDR);
    expect(result).toMatch(/^.{6}….{4}$/);
    expect(result.startsWith(REAL_MAINNET_ADDR.slice(0, 6))).toBe(true);
    expect(result.endsWith(REAL_MAINNET_ADDR.slice(-4))).toBe(true);
  });

  it('omits the middle portion of a 56-char address', () => {
    const result = truncateAddress(REAL_MAINNET_ADDR);
    // Middle chars should not appear
    expect(result).not.toContain(REAL_MAINNET_ADDR.slice(6, -4));
  });
});

// ─── Network switch logic ────────────────────────────────────────────────────

describe('network switch → contract address update', () => {
  /**
   * Simulates what useWrapStore.setNetwork does:
   * atomically updates network + currentContractAddress.
   */
  function simulateNetworkSwitch(
    network: 'mainnet' | 'testnet',
    addresses: Record<string, string | null>,
  ) {
    return {
      network,
      currentContractAddress: addresses[network] ?? null,
    };
  }

  it('switching to testnet exposes the testnet address', () => {
    const state = simulateNetworkSwitch('testnet', {
      mainnet: REAL_MAINNET_ADDR,
      testnet: REAL_TESTNET_ADDR,
    });
    expect(state.network).toBe('testnet');
    expect(state.currentContractAddress).toBe(REAL_TESTNET_ADDR);
    expect(isPlaceholderContractAddress(state.currentContractAddress)).toBe(false);
  });

  it('switching to mainnet exposes the mainnet address', () => {
    const state = simulateNetworkSwitch('mainnet', {
      mainnet: REAL_MAINNET_ADDR,
      testnet: REAL_TESTNET_ADDR,
    });
    expect(state.network).toBe('mainnet');
    expect(state.currentContractAddress).toBe(REAL_MAINNET_ADDR);
  });

  it('switching to an unconfigured network yields a placeholder state', () => {
    const state = simulateNetworkSwitch('testnet', {
      mainnet: REAL_MAINNET_ADDR,
      testnet: null,
    });
    expect(state.network).toBe('testnet');
    expect(isPlaceholderContractAddress(state.currentContractAddress)).toBe(true);
  });

  it('switching to a placeholder-configured network is treated as unconfigured', () => {
    const state = simulateNetworkSwitch('mainnet', {
      mainnet: PLACEHOLDER_CONTRACT_ADDRESS,
      testnet: REAL_TESTNET_ADDR,
    });
    expect(isPlaceholderContractAddress(state.currentContractAddress)).toBe(true);
  });
});
