/**
 * Security response headers (issue #386).
 *
 * Split out from next.config.ts so the header list itself is unit-testable
 * without exercising Next.js's config-loading machinery.
 *
 * ## Content-Security-Policy: why these origins
 *
 * Shipped as `Content-Security-Policy-Report-Only` for now, per the issue's
 * own guidance — collect violation reports before switching to enforcing.
 * The origin list below is a best-effort inventory from reading the
 * codebase, not a guarantee it's complete; that's exactly what report-only
 * mode is for.
 *
 * - `connect-src` — Horizon and Soroban RPC endpoints
 *   (`src/config.ts` `RPC_ENDPOINTS`/`SOROBAN_RPC_URLS`) are called
 *   *directly from the browser* (see `src/services/horizonIndexer.ts`),
 *   not proxied through an API route, so these are load-bearing for the
 *   app to function at all — not just "nice to have."
 * - `connect-src`/`frame-src` — WalletConnect v2 (via
 *   `@creit-tech/stellar-wallets-kit`'s `WalletConnectModule`, see
 *   `app/utils/walletConnectManager.ts`) talks to WalletConnect/Reown's
 *   relay, verify, and analytics infrastructure. These are the documented
 *   WalletConnect Cloud domains; the exact set actually hit will need
 *   confirming from real report-only violations, since the SDK doesn't
 *   document its full origin list anywhere in this repo.
 * - `script-src`/`connect-src` — `https://plausible.io`, matching the
 *   `<Script src="https://plausible.io/js/script.js">` in
 *   `app/[locale]/layout.tsx` and the events it posts back.
 * - No external font origins: the app uses system fonts only
 *   (`--font-sans: Arial, Helvetica, sans-serif` in `app/globals.css`) —
 *   confirmed no `next/font` or Google Fonts usage anywhere in the repo.
 * - `script-src 'unsafe-eval'` is required for `next dev`'s React Refresh /
 *   HMR runtime. Since these headers apply in dev and prod alike (that's
 *   the point of using `headers()` instead of `vercel.json`), and this
 *   directive is report-only for now, it's left in rather than special-
 *   cased per environment — tightening it is a follow-up once enforcing.
 */

const PLAUSIBLE_ORIGIN = 'https://plausible.io';

const HORIZON_ORIGINS = [
    'https://horizon.stellar.org',
    'https://horizon-testnet.stellar.org',
];

const SOROBAN_RPC_ORIGINS = [
    'https://mainnet.stellar.validation.stellar.org',
    'https://soroban-testnet.stellar.org',
];

// WalletConnect Cloud / Reown infrastructure used by
// @creit-tech/stellar-wallets-kit's WalletConnectModule.
const WALLETCONNECT_CONNECT_ORIGINS = [
    'https://relay.walletconnect.com',
    'https://relay.walletconnect.org',
    'wss://relay.walletconnect.com',
    'wss://relay.walletconnect.org',
    'https://pulse.walletconnect.org',
    'https://api.web3modal.org',
    'https://explorer-api.walletconnect.com',
];

const WALLETCONNECT_FRAME_ORIGINS = [
    'https://verify.walletconnect.com',
    'https://verify.walletconnect.org',
];

function buildContentSecurityPolicy(): string {
    const directives: string[] = [
        "default-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        // Clickjacking defense-in-depth alongside X-Frame-Options: DENY below.
        "frame-ancestors 'none'",
        "object-src 'none'",
        `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${PLAUSIBLE_ORIGIN}`,
        // Next.js and the wallet-connect modal both inject inline <style>.
        "style-src 'self' 'unsafe-inline'",
        // Wallet icons and OG/share images come from a mix of self-hosted,
        // data:, blob:, and third-party https sources.
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        `connect-src 'self' ${PLAUSIBLE_ORIGIN} ${HORIZON_ORIGINS.join(' ')} ${SOROBAN_RPC_ORIGINS.join(' ')} ${WALLETCONNECT_CONNECT_ORIGINS.join(' ')}`,
        `frame-src 'self' ${WALLETCONNECT_FRAME_ORIGINS.join(' ')}`,
        "worker-src 'self'",
        "manifest-src 'self'",
    ];

    return directives.join('; ');
}

export interface SecurityHeader {
    key: string;
    value: string;
}

/**
 * Builds the security response headers for every route.
 * `isProduction` gates Strict-Transport-Security only — HSTS on a plain
 * `http://localhost` dev server is meaningless (browsers ignore it on
 * non-HTTPS origins) and would be actively confusing to see there.
 */
export function getSecurityHeaders(isProduction: boolean): SecurityHeader[] {
    const headers: SecurityHeader[] = [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Content-Security-Policy-Report-Only', value: buildContentSecurityPolicy() },
    ];

    if (isProduction) {
        headers.push({
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
        });
    }

    return headers;
}
