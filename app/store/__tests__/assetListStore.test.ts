/**
 * Unit Tests for assetListStore (Zustand)
 *
 * Run with: npx tsx app/store/__tests__/assetListStore.test.ts
 *
 * @module assetListStore.test
 */

import { create } from 'zustand';

// ─── Inline types and store (avoids @/ alias issues with npx tsx) ───────────

type AssetSortOption = 'balance-desc' | 'balance-asc' | 'code-asc' | 'code-desc';
type AssetFilterOption = 'all' | 'native' | 'custom';

interface WalletAsset {
    code: string;
    issuer?: string;
    balance: string;
    assetType: 'native' | 'credit_alphanum4' | 'credit_alphanum12';
}

interface AssetListState {
    assets: WalletAsset[];
    isLoading: boolean;
    error: string | null;
    lastFetched: number | null;
    sortBy: AssetSortOption;
    filterBy: AssetFilterOption;
    selectedAssets: Set<string>;
    setAssets: (assets: WalletAsset[]) => void;
    setLoading: (isLoading: boolean) => void;
    setError: (error: string | null) => void;
    setSortBy: (sortBy: AssetSortOption) => void;
    setFilterBy: (filterBy: AssetFilterOption) => void;
    toggleAssetSelection: (assetKey: string) => void;
    clearSelection: () => void;
    reset: () => void;
}

const useAssetListStore = create<AssetListState>((set, get) => ({
    assets: [],
    isLoading: false,
    error: null,
    lastFetched: null,
    sortBy: 'balance-desc',
    filterBy: 'all',
    selectedAssets: new Set<string>(),
    setAssets: (assets) =>
        set({
            assets,
            lastFetched: Date.now(),
            error: null,
        }),
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error, isLoading: false }),
    setSortBy: (sortBy) => set({ sortBy }),
    setFilterBy: (filterBy) => set({ filterBy }),
    toggleAssetSelection: (assetKey) => {
        const selectedAssets = new Set(get().selectedAssets);
        if (selectedAssets.has(assetKey)) {
            selectedAssets.delete(assetKey);
        } else {
            selectedAssets.add(assetKey);
        }
        set({ selectedAssets });
    },
    clearSelection: () => set({ selectedAssets: new Set<string>() }),
    reset: () =>
        set({
            assets: [],
            isLoading: false,
            error: null,
            lastFetched: null,
            sortBy: 'balance-desc',
            filterBy: 'all',
            selectedAssets: new Set<string>(),
        }),
}));

// ─── Test Helpers ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string): void {
    if (condition) { passed++; } else { failed++; failures.push(message); console.error(`  ✗ ${message}`); }
}

function section(name: string): void {
    console.log(`\n▸ ${name}`);
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

const mockAssets: WalletAsset[] = [
    {
        code: 'XLM',
        balance: '100.0000000',
        assetType: 'native',
    },
    {
        code: 'USDC',
        issuer: 'GABCD...',
        balance: '50.0000000',
        assetType: 'credit_alphanum4',
    },
];

// ─── Initial State ──────────────────────────────────────────────────────────

section('Initial state');
{
    const state = useAssetListStore.getState();
    assert(state.assets.length === 0, 'assets starts empty');
    assert(state.isLoading === false, 'isLoading starts false');
    assert(state.error === null, 'error starts null');
    assert(state.lastFetched === null, 'lastFetched starts null');
    assert(state.sortBy === 'balance-desc', 'sortBy defaults to balance-desc');
    assert(state.filterBy === 'all', 'filterBy defaults to all');
    assert(state.selectedAssets.size === 0, 'selectedAssets starts empty');
}

// ─── setAssets ─────────────────────────────────────────────────────────────

section('setAssets');
{
    useAssetListStore.getState().setAssets(mockAssets);
    const state = useAssetListStore.getState();
    assert(state.assets.length === 2, 'setAssets adds assets');
    assert(state.lastFetched !== null, 'setAssets updates lastFetched');
    assert(state.error === null, 'setAssets clears error');
}

// ─── setLoading ────────────────────────────────────────────────────────────

section('setLoading');
{
    useAssetListStore.getState().setLoading(true);
    assert(useAssetListStore.getState().isLoading === true, 'setLoading true');

    useAssetListStore.getState().setLoading(false);
    assert(useAssetListStore.getState().isLoading === false, 'setLoading false');
}

// ─── setError ───────────────────────────────────────────────────────────────

section('setError');
{
    useAssetListStore.getState().setLoading(true);
    useAssetListStore.getState().setError('Failed to fetch');
    const state = useAssetListStore.getState();
    assert(state.error === 'Failed to fetch', 'setError sets error');
    assert(state.isLoading === false, 'setError clears loading');

    useAssetListStore.getState().setError(null);
    assert(useAssetListStore.getState().error === null, 'setError(null) clears error');
}

// ─── setSortBy ──────────────────────────────────────────────────────────────

section('setSortBy');
{
    useAssetListStore.getState().setSortBy('code-asc');
    assert(useAssetListStore.getState().sortBy === 'code-asc', 'setSortBy to code-asc');

    useAssetListStore.getState().setSortBy('balance-asc');
    assert(useAssetListStore.getState().sortBy === 'balance-asc', 'setSortBy to balance-asc');
}

// ─── setFilterBy ────────────────────────────────────────────────────────────

section('setFilterBy');
{
    useAssetListStore.getState().setFilterBy('native');
    assert(useAssetListStore.getState().filterBy === 'native', 'setFilterBy to native');

    useAssetListStore.getState().setFilterBy('custom');
    assert(useAssetListStore.getState().filterBy === 'custom', 'setFilterBy to custom');
}

// ─── toggleAssetSelection ────────────────────────────────────────────────────

section('toggleAssetSelection');
{
    useAssetListStore.getState().toggleAssetSelection('XLM-native');
    assert(useAssetListStore.getState().selectedAssets.has('XLM-native') === true, 'toggle adds to selection');

    useAssetListStore.getState().toggleAssetSelection('XLM-native');
    assert(useAssetListStore.getState().selectedAssets.has('XLM-native') === false, 'toggle removes from selection');
}

// ─── clearSelection ──────────────────────────────────────────────────────────

section('clearSelection');
{
    useAssetListStore.getState().toggleAssetSelection('XLM-native');
    useAssetListStore.getState().toggleAssetSelection('USDC-issuer');
    assert(useAssetListStore.getState().selectedAssets.size === 2, 'selection has 2 items');

    useAssetListStore.getState().clearSelection();
    assert(useAssetListStore.getState().selectedAssets.size === 0, 'clearSelection empties selection');
}

// ─── reset ──────────────────────────────────────────────────────────────────

section('reset');
{
    useAssetListStore.getState().setAssets(mockAssets);
    useAssetListStore.getState().setLoading(true);
    useAssetListStore.getState().setError('Error');
    useAssetListStore.getState().setSortBy('code-asc');
    useAssetListStore.getState().setFilterBy('native');
    useAssetListStore.getState().toggleAssetSelection('XLM-native');

    useAssetListStore.getState().reset();
    const state = useAssetListStore.getState();
    assert(state.assets.length === 0, 'reset: assets empty');
    assert(state.isLoading === false, 'reset: isLoading false');
    assert(state.error === null, 'reset: error null');
    assert(state.lastFetched === null, 'reset: lastFetched null');
    assert(state.sortBy === 'balance-desc', 'reset: sortBy defaults');
    assert(state.filterBy === 'all', 'reset: filterBy defaults');
    assert(state.selectedAssets.size === 0, 'reset: selectedAssets empty');
}

// ─── Report ─────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════');
console.log(`  Results:  ${passed} passed, ${failed} failed`);
console.log('══════════════════════════════════════════════════════');

if (failures.length > 0) {
    console.log('\nFailed tests:');
    failures.forEach((f) => console.log(`  ✗ ${f}`));
}

process.exit(failed > 0 ? 1 : 0);
