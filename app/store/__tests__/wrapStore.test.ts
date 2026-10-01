/**
 * Unit Tests for wrapStore (Zustand)
 *
 * Run with: npx tsx app/store/__tests__/wrapStore.test.ts
 *
 * @module wrapStore.test
 */

import { create } from 'zustand';

// ─── Inline types and store (avoids @/ alias issues with npx tsx) ───────────

type WrapPeriod = 'weekly' | 'monthly' | 'yearly';
type Network = 'mainnet' | 'testnet';
type WrapStatus = 'idle' | 'loading' | 'ready' | 'error';

interface DappData { name: string; interactions: number; }
interface VibeSlice { type: string; percentage: number; color: string; label: string; }
interface WrapResult {
    username: string; totalTransactions: number; percentile: number;
    dapps: DappData[]; vibes: VibeSlice[]; persona: string; personaDescription: string;
}

interface CacheMeta {
    fromCache: boolean;
    cacheTimestamp?: number;
    refreshingInBackground?: boolean;
    offline?: boolean;
}

interface WrapStoreState {
    address: string | null; period: WrapPeriod; network: Network;
    status: WrapStatus; error: string | null; result: WrapResult | null;
    cacheMeta: CacheMeta | null;
    currentContractAddress: string | null;
    setAddress: (address: string | null) => void;
    setPeriod: (period: WrapPeriod) => void;
    setNetwork: (network: Network) => void;
    setStatus: (status: WrapStatus) => void;
    setError: (error: string | null) => void;
    setResult: (result: WrapResult | null) => void;
    setCacheMeta: (meta: CacheMeta | null) => void;
    reset: () => void;
}

const useWrapStore = create<WrapStoreState>((set) => ({
    address: null, period: 'yearly', network: 'mainnet' as Network,
    status: 'idle', error: null, result: null, cacheMeta: null,
    currentContractAddress: null,
    setAddress: (address) => set({ address }),
    setPeriod: (period) => set({ period }),
    setNetwork: (network) => {
        const newContractAddress = network === 'mainnet'
            ? 'CMainnetTBD5EJXJ5CBN5XJXJXJXJXJXJXJXJXJXJXJXJXJXJX'
            : 'CTestnetTBD5EJXJ5CBN5XJXJXJXJXJXJXJXJXJXJXJXJXJXJXJXJX';
        set({
            network,
            currentContractAddress: newContractAddress,
            result: null,
            cacheMeta: null,
            status: 'idle',
            error: null,
        });
    },
    setStatus: (status) => set({ status }),
    setError: (error) => set({ error }),
    setResult: (result) => set({ result }),
    setCacheMeta: (cacheMeta) => set({ cacheMeta }),
    reset: () => set({ address: null, period: 'yearly', network: 'mainnet' as Network, status: 'idle', error: null, result: null, cacheMeta: null }),
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

const mockResult: WrapResult = {
    username: 'test_user', totalTransactions: 500, percentile: 95,
    dapps: [{ name: 'DEX', interactions: 100 }],
    vibes: [{ type: 'defi', percentage: 80, color: '#FF0000', label: 'DeFi Lord' }],
    persona: 'The Trader', personaDescription: 'You live for the swap.',
};

const MAINNET_CONTRACT_ADDRESS = 'CMainnetTBD5EJXJ5CBN5XJXJXJXJXJXJXJXJXJXJXJXJXJXJX';
const TESTNET_CONTRACT_ADDRESS = 'CTestnetTBD5EJXJ5CBN5XJXJXJXJXJXJXJXJXJXJXJXJXJXJXJXJX';

// ─── Initial State ──────────────────────────────────────────────────────────

section('Initial state');
{
    const state = useWrapStore.getState();
    assert(state.address === null, 'address starts null');
    assert(state.period === 'yearly', 'period defaults to yearly');
    assert(state.network === 'mainnet', 'network defaults to mainnet');
    assert(state.status === 'idle', 'status starts idle');
    assert(state.error === null, 'error starts null');
    assert(state.result === null, 'result starts null');
}

// ─── setAddress ─────────────────────────────────────────────────────────────

section('setAddress');
{
    useWrapStore.getState().setAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7');
    assert(useWrapStore.getState().address === 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7', 'setAddress works');

    useWrapStore.getState().setAddress(null);
    assert(useWrapStore.getState().address === null, 'setAddress(null) clears');
}

// ─── setPeriod ──────────────────────────────────────────────────────────────

section('setPeriod');
{
    useWrapStore.getState().setPeriod('weekly');
    assert(useWrapStore.getState().period === 'weekly', 'setPeriod to weekly');

    useWrapStore.getState().setPeriod('monthly');
    assert(useWrapStore.getState().period === 'monthly', 'setPeriod to monthly');

    useWrapStore.getState().setPeriod('yearly');
    assert(useWrapStore.getState().period === 'yearly', 'setPeriod back to yearly');
}

// ─── setNetwork ─────────────────────────────────────────────────────────────

section('setNetwork');
{
    useWrapStore.getState().setNetwork('testnet');
    assert(useWrapStore.getState().network === 'testnet', 'setNetwork to testnet');

    useWrapStore.getState().setNetwork('mainnet');
    assert(useWrapStore.getState().network === 'mainnet', 'setNetwork back to mainnet');
}

// ─── setNetwork clears network-sensitive state ──────────────────────────────

section('setNetwork clears result and cache metadata');
{
    useWrapStore.getState().setAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7');
    useWrapStore.getState().setPeriod('weekly');
    useWrapStore.getState().setNetwork('mainnet');
    useWrapStore.getState().setStatus('ready');
    useWrapStore.getState().setResult(mockResult);
    useWrapStore.getState().setCacheMeta({ fromCache: true, cacheTimestamp: Date.now() });
    useWrapStore.getState().setError('stale network error');

    useWrapStore.getState().setNetwork('testnet');
    const state = useWrapStore.getState();

    assert(state.network === 'testnet', 'network switched to testnet');
    assert(state.result === null, 'result cleared on network change');
    assert(state.cacheMeta === null, 'cacheMeta cleared on network change');
    assert(state.status === 'idle', 'status reset to idle on network change');
    assert(state.error === null, 'error cleared on network change');
    assert(state.period === 'weekly', 'period preference preserved on network change');
    assert(
        state.address === 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
        'address preference preserved on network change',
    );
}

section('Network Switching');

console.log('  ▸ Mainnet to testnet - contract address refresh and state clear');
{
    useWrapStore.getState().setAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7');
    useWrapStore.getState().setPeriod('yearly');
    useWrapStore.getState().setNetwork('mainnet');
    useWrapStore.getState().setStatus('ready');
    useWrapStore.getState().setResult(mockResult);
    useWrapStore.getState().setCacheMeta({ fromCache: true, cacheTimestamp: Date.now() });
    useWrapStore.getState().setError('some error');

    const stateBefore = useWrapStore.getState();
    assert(
        stateBefore.currentContractAddress === MAINNET_CONTRACT_ADDRESS,
        'currentContractAddress is mainnet address',
    );
    assert(stateBefore.network === 'mainnet', 'network is mainnet');
    assert(stateBefore.result !== null, 'result is set before switch');
    assert(stateBefore.cacheMeta !== null, 'cacheMeta is set before switch');
    assert(stateBefore.status === 'ready', 'status is ready before switch');
    assert(stateBefore.error === 'some error', 'error is set before switch');

    useWrapStore.getState().setNetwork('testnet');
    const stateAfter = useWrapStore.getState();

    assert(stateAfter.network === 'testnet', 'network switched to testnet');
    assert(
        stateAfter.currentContractAddress === TESTNET_CONTRACT_ADDRESS,
        'currentContractAddress updated to testnet address',
    );
    assert(stateAfter.result === null, 'result cleared on network change');
    assert(stateAfter.cacheMeta === null, 'cacheMeta cleared on network change');
    assert(stateAfter.status === 'idle', 'status reset to idle on network change');
    assert(stateAfter.error === null, 'error cleared on network change');
    assert(stateAfter.period === 'yearly', 'period preserved on network change');
    assert(
        stateAfter.address === 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
        'address preserved on network change',
    );
}

console.log('  ▸ Testnet to mainnet - contract address refresh and state clear');
{
    useWrapStore.getState().setAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7');
    useWrapStore.getState().setPeriod('weekly');
    useWrapStore.getState().setNetwork('testnet');
    useWrapStore.getState().setStatus('ready');
    useWrapStore.getState().setResult(mockResult);
    useWrapStore.getState().setCacheMeta({ fromCache: true, cacheTimestamp: Date.now() });
    useWrapStore.getState().setError('some error');

    const stateBefore = useWrapStore.getState();
    assert(
        stateBefore.currentContractAddress === TESTNET_CONTRACT_ADDRESS,
        'currentContractAddress is testnet address',
    );
    assert(stateBefore.network === 'testnet', 'network is testnet');
    assert(stateBefore.result !== null, 'result is set before switch');
    assert(stateBefore.cacheMeta !== null, 'cacheMeta is set before switch');
    assert(stateBefore.status === 'ready', 'status is ready before switch');
    assert(stateBefore.error === 'some error', 'error is set before switch');

    useWrapStore.getState().setNetwork('mainnet');
    const stateAfter = useWrapStore.getState();

    assert(stateAfter.network === 'mainnet', 'network switched to mainnet');
    assert(
        stateAfter.currentContractAddress === MAINNET_CONTRACT_ADDRESS,
        'currentContractAddress updated to mainnet address',
    );
    assert(stateAfter.result === null, 'result cleared on network change');
    assert(stateAfter.cacheMeta === null, 'cacheMeta cleared on network change');
    assert(stateAfter.status === 'idle', 'status reset to idle on network change');
    assert(stateAfter.error === null, 'error cleared on network change');
    assert(stateAfter.period === 'weekly', 'period preserved on network change');
    assert(
        stateAfter.address === 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
        'address preserved on network change',
    );
}

// ─── setStatus ──────────────────────────────────────────────────────────────

section('setStatus transitions');
{
    useWrapStore.getState().setStatus('loading');
    assert(useWrapStore.getState().status === 'loading', 'status: loading');

    useWrapStore.getState().setStatus('ready');
    assert(useWrapStore.getState().status === 'ready', 'status: ready');

    useWrapStore.getState().setStatus('error');
    assert(useWrapStore.getState().status === 'error', 'status: error');

    useWrapStore.getState().setStatus('idle');
    assert(useWrapStore.getState().status === 'idle', 'status: back to idle');
}

// ─── setResult ──────────────────────────────────────────────────────────────

section('setResult');
{
    useWrapStore.getState().setResult(mockResult);
    const state = useWrapStore.getState();
    assert(state.result !== null, 'result is set');
    assert(state.result?.username === 'test_user', 'result username matches');
    assert(state.result?.totalTransactions === 500, 'result totalTransactions matches');
    assert(state.result?.dapps.length === 1, 'result dapps length matches');

    useWrapStore.getState().setResult(null);
    assert(useWrapStore.getState().result === null, 'setResult(null) clears');
}

// ─── setError ───────────────────────────────────────────────────────────────

section('setError');
{
    useWrapStore.getState().setError('Network timeout');
    assert(useWrapStore.getState().error === 'Network timeout', 'error set');

    useWrapStore.getState().setError(null);
    assert(useWrapStore.getState().error === null, 'error cleared');
}

// ─── reset ──────────────────────────────────────────────────────────────────

section('reset');
{
    // Set various state
    useWrapStore.getState().setAddress('GTEST...');
    useWrapStore.getState().setPeriod('weekly');
    useWrapStore.getState().setNetwork('testnet');
    useWrapStore.getState().setStatus('ready');
    useWrapStore.getState().setResult(mockResult);
    useWrapStore.getState().setError('some error');

    // Reset
    useWrapStore.getState().reset();
    const state = useWrapStore.getState();
    assert(state.address === null, 'reset: address null');
    assert(state.period === 'yearly', 'reset: period yearly');
    assert(state.network === 'mainnet', 'reset: network mainnet');
    assert(state.status === 'idle', 'reset: status idle');
    assert(state.result === null, 'reset: result null');
    assert(state.error === null, 'reset: error null');
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
