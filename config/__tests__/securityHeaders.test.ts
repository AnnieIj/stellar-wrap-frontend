/**
 * Tests for getSecurityHeaders (issue #386)
 */

import { getSecurityHeaders } from '../securityHeaders';

function findHeader(headers: ReturnType<typeof getSecurityHeaders>, key: string) {
    return headers.find((h) => h.key === key);
}

describe('getSecurityHeaders', () => {
    it('sets X-Frame-Options: DENY', () => {
        const header = findHeader(getSecurityHeaders(false), 'X-Frame-Options');
        expect(header?.value).toBe('DENY');
    });

    it('sets X-Content-Type-Options: nosniff', () => {
        const header = findHeader(getSecurityHeaders(false), 'X-Content-Type-Options');
        expect(header?.value).toBe('nosniff');
    });

    it('sets Referrer-Policy: strict-origin-when-cross-origin', () => {
        const header = findHeader(getSecurityHeaders(false), 'Referrer-Policy');
        expect(header?.value).toBe('strict-origin-when-cross-origin');
    });

    it('ships CSP as report-only, not enforcing', () => {
        const headers = getSecurityHeaders(false);
        expect(findHeader(headers, 'Content-Security-Policy')).toBeUndefined();
        expect(findHeader(headers, 'Content-Security-Policy-Report-Only')).toBeDefined();
    });

    it("CSP includes frame-ancestors 'none' (clickjacking defense-in-depth with X-Frame-Options)", () => {
        const csp = findHeader(getSecurityHeaders(false), 'Content-Security-Policy-Report-Only');
        expect(csp?.value).toContain("frame-ancestors 'none'");
    });

    it('CSP connect-src covers Horizon and Soroban RPC endpoints the app calls directly from the browser', () => {
        const csp = findHeader(getSecurityHeaders(false), 'Content-Security-Policy-Report-Only');
        expect(csp?.value).toContain('https://horizon.stellar.org');
        expect(csp?.value).toContain('https://horizon-testnet.stellar.org');
        expect(csp?.value).toContain('https://soroban-testnet.stellar.org');
    });

    it('CSP allows Plausible for script-src and connect-src', () => {
        const csp = findHeader(getSecurityHeaders(false), 'Content-Security-Policy-Report-Only');
        const scriptSrc = csp?.value.split('; ').find((d) => d.startsWith('script-src'));
        const connectSrc = csp?.value.split('; ').find((d) => d.startsWith('connect-src'));
        expect(scriptSrc).toContain('https://plausible.io');
        expect(connectSrc).toContain('https://plausible.io');
    });

    it('CSP allows WalletConnect relay origins in connect-src', () => {
        const csp = findHeader(getSecurityHeaders(false), 'Content-Security-Policy-Report-Only');
        const connectSrc = csp?.value.split('; ').find((d) => d.startsWith('connect-src'));
        expect(connectSrc).toContain('wss://relay.walletconnect.com');
        expect(connectSrc).toContain('https://relay.walletconnect.org');
    });

    it('omits Strict-Transport-Security outside production', () => {
        const header = findHeader(getSecurityHeaders(false), 'Strict-Transport-Security');
        expect(header).toBeUndefined();
    });

    it('sets Strict-Transport-Security in production only', () => {
        const header = findHeader(getSecurityHeaders(true), 'Strict-Transport-Security');
        expect(header?.value).toBe('max-age=63072000; includeSubDomains; preload');
    });
});
