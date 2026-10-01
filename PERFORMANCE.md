# Performance Baselines & Load Testing

## Overview

This document covers load testing for the `/api/og` share card generation endpoint and client-side `html2canvas` benchmarking.

---

## Server-side: `/api/og` Load Test

### Setup

The test script lives in `load-tests/og-load-test.js` and uses [`autocannon`](https://github.com/mcollina/autocannon).

Install the dependency:

```bash
npm install -g autocannon
# or run without installing:
npx autocannon <url>
```

### Running the tests

```bash
# Start the dev server (or target a staging URL)
pnpm dev

# In a separate terminal:
BASE_URL=http://localhost:3000 node load-tests/og-load-test.js

# Against a deployed environment:
BASE_URL=https://your-staging-url.vercel.app node load-tests/og-load-test.js
```

### Test scenarios

| Scenario | Concurrent connections | Duration |
|----------|----------------------|---------|
| Light    | 10                   | 15 s    |
| Moderate | 50                   | 15 s    |
| Heavy    | 100                  | 15 s    |

### Baseline targets

| Metric            | Target       |
|-------------------|--------------|
| p95 response time | **< 2 000 ms** |
| Error rate        | **< 1 %**    |
| Timeout rate      | **< 0.5 %**  |

### Identified bottlenecks

| Bottleneck | Root cause | Mitigation |
|-----------|-----------|-----------|
| Cold start latency | Vercel Edge Function first-request spin-up (~200–400 ms) | Keep-alive via scheduled synthetic pings; upgrade to a warm-tier plan |
| Font loading | `@vercel/og` fetches fonts on each cold start | Pre-load fonts as module-level `ArrayBuffer` constants in `route.tsx` |
| Archetype image fetch | `fetch(baseUrl + archetypeImagePath)` adds RTT per request | Cache fetched image buffers in module scope (survives across warm invocations) |
| Canvas encoding | `btoa` on large images is CPU-bound | Use `Buffer.from(buf).toString('base64')` (faster) or reduce image resolution |

### Recommended `Cache-Control` headers

The endpoint already sets:

```
Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800
```

This allows Vercel's CDN (and any downstream CDN) to cache OG images for 24 hours and serve stale content for up to 7 days while revalidating. For high-traffic deployments, add a CDN prefix cache key on the full query string to maximise hit rate.

---

## Client-side: `html2canvas` benchmark

### How to run

1. Open Chrome DevTools → **Performance** tab.
2. Click the CPU throttle dropdown and select **4× slowdown** (simulates a mid-range phone).
3. Start recording, trigger share card generation on `/share`, stop recording.
4. Look for the `html2canvas` task in the flame graph.

### Target

| Device profile                | Target render time |
|-------------------------------|--------------------|
| Desktop (no throttle)         | < 800 ms           |
| Mid-range phone (4× throttle) | < 3 000 ms         |
| Low-end phone (6× throttle)   | < 5 000 ms         |

### Identified bottlenecks & remediation

| Bottleneck | Mitigation |
|-----------|-----------|
| 3× scale factor (`scale: 3` in `html2canvas` config) | Reduce to `scale: 2` for mobile user agents |
| Complex CSS gradients & blur filters | Simplify backdrop-filter usage in the card DOM subtree |
| Web font loading at render time | Pre-warm fonts with `document.fonts.load()` before calling `html2canvas` |
| Large DOM subtree | Render a lightweight shadow clone element instead of the full page |

---

## Bundle Size Tracking

### Overview

Animated pages, wallet libraries, and Stellar SDK can significantly increase frontend bundle size. Bundle size tracking helps catch regressions and identify optimization opportunities.

### Running Bundle Analysis

#### Local Development

Run the bundle analyzer locally to inspect your bundle composition:

```bash
pnpm analyze
```

This will:
1. Build the Next.js application with bundle analysis enabled
2. Generate interactive HTML reports in `.next/analyze/`
3. Automatically open the reports in your browser

#### CI/CD

The bundle size tracking workflow (`.github/workflows/bundle-size.yml`) automatically:
- Runs on every pull request and push to main/master/develop branches
- Builds the application with bundle analysis enabled
- Uploads bundle analysis reports as artifacts (retained for 30 days)
- Comments on pull requests with bundle size statistics

### Inspecting Bundle Reports

1. **Download the artifact** from the GitHub Actions run
2. **Open the HTML files** in `.next/analyze/` directory:
   - `client.html` - Client-side JavaScript bundles
   - `nodejs.html` - Server-side Node.js bundles
   - `edge.html` - Edge runtime bundles (if applicable)

3. **Analyze the treemap visualization**:
   - Larger rectangles represent larger modules
   - Color intensity often indicates module size
   - Click on modules to drill down into dependencies

### Bundle Size Budgets & Thresholds

Current baseline targets (to be refined after initial analysis):

| Bundle Type | Target Size | Rationale |
|-------------|-------------|-----------|
| Main JS bundle | < 500 KB | Ensures fast initial load on 3G connections |
| Total page weight | < 2 MB | Includes all JS, CSS, and assets |
| Individual chunks | < 200 KB | Prevents large lazy-loaded chunks |

### Common Bundle Size Issues & Solutions

| Issue | Common Cause | Solution |
|-------|--------------|----------|
| Large main bundle | Heavy dependencies (Stellar SDK, motion libraries) | Code splitting, dynamic imports, tree shaking |
| Duplicate dependencies | Multiple versions of same package | Deduplicate via pnpm, update to compatible versions |
| Large node_modules in bundle | Bundling server-only code on client | Use `next.config.ts` to exclude server-only packages |
| Unoptimized images | Large asset files | Use Next.js Image component, optimize assets |

### Monitoring Regressions

The CI workflow will comment on PRs with bundle size changes. Review these comments to ensure:
- No significant bundle size increases without justification
- New dependencies are properly code-split
- Lazy-loaded chunks remain reasonably sized

### Recommended Actions Before Merging

1. Run `pnpm analyze` locally and review the report
2. Check that new features use dynamic imports for heavy dependencies
3. Verify that tree-shaking is working (no unused code in bundles)
4. Ensure bundle size increase is justified by feature value

---

## Recommended limits

| Limit | Value | Rationale |
|-------|-------|-----------|
| Max concurrent OG requests per deployment | ~200 rps | Vercel Edge plan limit; above this, add request queuing |
| OG image cache TTL | 24 h (`s-maxage=86400`) | Sufficient freshness for persona data that changes monthly |
| `html2canvas` scale on mobile | `2` | Balances quality and speed on mid-range devices |
| Client-side generation timeout | 10 s | Show error state if canvas encoding exceeds this threshold |
