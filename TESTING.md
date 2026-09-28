# Testing Guide

This document provides information about running and maintaining tests for the Stellar Wrap project.

## Testing Strategy

This project uses a **dual test runner strategy** to leverage the strengths of each tool:

| Test Runner | Purpose | Test Files | Command |
|-------------|---------|-----------|---------|
| **Jest** | Unit tests, mocking, Next.js integration | `*.test.ts`, `*.test.tsx` | `pnpm test:unit` |
| **Vitest** | Integration tests, edge cases, comprehensive tests | `*.comprehensive.test.ts`, `*.edge.test.ts`, `*.integration.test.ts` | `pnpm test:integration` |
| **Playwright** | Visual regression, E2E tests | `*.spec.ts` (in e2e folder) | `pnpm test:visual` |

### Why Two Test Runners?

- **Jest**: Mature ecosystem, excellent Next.js integration, strong mocking capabilities. Used for standard unit tests.
- **Vitest**: Fast, modern, native ESM support. Used for comprehensive integration tests and edge case testing.
- **Playwright**: Industry-standard for visual regression and E2E testing.

### Test File Naming Convention

Follow these naming patterns to ensure tests run with the correct runner:

```
*.test.ts          → Jest (unit tests)
*.test.tsx         → Jest (React component tests)
*.comprehensive.test.ts → Vitest (comprehensive integration tests)
*.edge.test.ts     → Vitest (edge case tests)
*.integration.test.ts   → Vitest (integration tests)
*.spec.ts          → Playwright (E2E/visual tests)
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Run all tests (Jest + Vitest)
pnpm test

# Run only unit tests (Jest)
pnpm test:unit

# Run only integration tests (Vitest)
pnpm test:integration

# Run tests in watch mode
pnpm test:watch              # Jest watch mode
pnpm test:integration:watch  # Vitest watch mode

# Generate coverage report
pnpm test:coverage

# Visual regression tests
pnpm test:visual
pnpm test:visual:update  # Update snapshots
```

We use [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci) to track Performance, Accessibility, Best Practices, and SEO scores on every pull request.

### Score Thresholds

| Category | Minimum Score | Enforcement |
|----------|-------------|-------------|
| Performance | 70 | Hard fail (PR blocked) |
| Accessibility | 85 | Hard fail (PR blocked) |
| Best Practices | 90 | Hard fail (PR blocked) |
| SEO | 80 | Hard fail (PR blocked) |

### Running Lighthouse Locally

Useful for debugging performance regressions before opening a PR:

```bash
# 1. Install dependencies (if not already done)
yarn install

# 2. Build the production app
yarn build

# 3. Run Lighthouse CI against the local production server
yarn lhci:local

## Lighthouse CI (Performance & Quality)

## Type Checking

Run the TypeScript compiler in `--noEmit` mode to catch type errors without emitting build output:

```bash
pnpm typecheck
```

This runs automatically in CI on every pull request.

## Test Infrastructure

### Frameworks

- **Jest** (`^29`) - Unit tests with Next.js integration
  - Configuration: `jest.config.js`
  - Setup: `jest.setup.js`
  - Used for: Standard unit tests, component tests
  
- **Vitest** (`^4.1.9`) - Integration and comprehensive tests
  - Configuration: `vitest.config.ts`
  - Used for: Comprehensive test suites, edge cases, integration tests
  
- **Playwright** (`^1.61.1`) - E2E and visual regression
  - Used for: Share card visual tests, user flows

### Test Structure by Runner

#### Jest Tests (Unit)
```
__tests__/
├── bundle-budget.test.js         # Build tooling tests
├── contracts.test.ts             # Contract config tests
app/services/__tests__/
├── achievementCalculator.test.ts # Achievement logic
├── achievementCalculator.unit.test.ts
├── indexerService.test.ts        # Indexer unit tests
├── indexerService.unit.test.ts
├── assetResolver.test.ts         # Asset resolution
├── personaDetection.test.ts      # Persona detection
└── fullFlow.test.ts              # Full flow integration
app/store/__tests__/
├── wrapStore.test.ts             # Store unit tests
└── indexingStore.test.ts
```

#### Vitest Tests (Integration/Comprehensive)
```
app/services/__tests__/
├── achievementCalculator.comprehensive.test.ts  # Full coverage
├── indexerService.edge.test.ts                  # Edge cases
└── *.integration.test.ts                        # Integration tests
```

#### Playwright Tests (Visual/E2E)
```
e2e/
└── share-card.spec.ts            # Share card visual regression
```

## Running Tests

### Run All Tests

Runs both Jest and Vitest test suites:

```bash
pnpm test
```

### Run Jest Tests (Unit)

```bash
# Run all Jest tests
pnpm test:unit

# Run in watch mode
pnpm test:watch

# Run specific test file
pnpm test:unit -- contracts.test.ts

# Run tests matching a pattern
pnpm test:unit -- --testNamePattern="calculateVolume"

# Generate coverage
pnpm test:coverage
```

### Run Vitest Tests (Integration)

```bash
# Run all Vitest tests
pnpm test:integration

# Run in watch mode
pnpm test:integration:watch

# Run with UI
pnpm test:integration:ui

# Run specific test file
pnpm test:integration -- achievementCalculator.comprehensive.test.ts
```

### Run Visual Regression Tests (Playwright)

Share card screenshots are tested with Playwright at the card's native
`1080x1080` resolution. The suite covers all five color themes, short and long
persona names, transaction counts of `1`, `100`, and `999,999`, and missing
archetype/vibe data.

```bash
# Run visual comparisons against committed baselines
pnpm test:visual

# Update baselines after an intentional ShareImageCard visual change
pnpm test:visual:update
```

Review the generated image changes before committing updated baselines. Visual
tests fail when the screenshot diff exceeds `0.1%`.

#### Visual Regression Workflow

Visual baselines are committed image files, not build artifacts. They live next
to the spec that produces them and are checked into git so a baseline change is
reviewable as an image diff in the pull request:

```
e2e/
├── share-card.spec.ts
└── share-card.spec.ts-snapshots/
    ├── share-card-<theme>-<case>-chromium-linux.png
    └── ...
```

**When to run `pnpm test:visual:update`**

Only run the update command when the visual change is intentional and is the
point of your pull request — for example, a deliberate `ShareImageCard`
redesign, a copy change, or a new theme. Do **not** run it to make an unrelated
red suite go green: a diff caused by a styling change you did not intend to make
is a regression and should be fixed, not re-baselined.

**What a baseline change requires in review**

1. Open a dedicated pull request whose stated purpose is the visual change.
2. Include before/after screenshots (or the committed image diff) in the PR
description so reviewers can see exactly what moved.
3. Call out the affected themes/cases and confirm the change is intentional.
4. Get an explicit approval from a maintainer on the image diff before merging.

**Pinned rendering environment**

Font availability differs between a developer's machine and CI, which is the
usual source of false diffs. Baselines are therefore generated and compared in
the same pinned environment:

- The `visual-chromium` Playwright project runs Chromium on Linux, matching the
  CI runner. Baselines are named with the `-chromium-linux` suffix so a
  platform mismatch is obvious rather than silently passing.
- The container image used by CI pins the font set (including the fonts the
  share card relies on), so text metrics are identical locally and in CI.
- Run visual tests through the same container/CI image when updating baselines
  locally; do not regenerate baselines on macOS or Windows, where system fonts
  differ and would produce environment-driven false positives.

**CI behavior**

Visual tests run in CI against the committed baselines. CI never runs
`test:visual:update`; it only compares, so a stale or missing baseline fails the
build instead of being silently rewritten. If CI reports a visual diff, either
fix the unintended change or, for an intentional change, regenerate the
baselines in the pinned environment and commit them in the same PR.

### Generate Coverage Report

Jest generates coverage for unit tests:

```bash
pnpm test:coverage
```

Coverage reports are generated in the `coverage/` directory. Open `coverage/lcov-report/index.html` in a browser to view the detailed report.

## Test Coverage Goals

- **Target**: 80%+ coverage for all services
- **Areas to Cover**:
  - All public methods
  - Edge cases
  - Error handling
  - Boundary conditions
  - Integration scenarios

## Writing Tests

### Choosing the Right Test Runner

| Scenario | Use | File Naming |
|----------|-----|-------------|
| Testing a single function/method | Jest | `*.test.ts` |
| Testing React components | Jest | `*.test.tsx` |
| Testing integration between services | Vitest | `*.integration.test.ts` |
| Testing edge cases and boundaries | Vitest | `*.edge.test.ts` |
| Comprehensive test suites (100+ assertions) | Vitest | `*.comprehensive.test.ts` |
| Visual regression / E2E flows | Playwright | `*.spec.ts` |

### Jest Test Structure (Unit Tests)

```typescript
// app/services/__tests__/myService.test.ts
import { myFunction } from '../myService';

describe('MyService', () => {
  beforeEach(() => {
    // Setup before each test
    jest.clearAllMocks();
  });

  describe('myFunction', () => {
    it('should handle valid input', () => {
      const result = myFunction('valid');
      expect(result).toBe('expected');
    });

    it('should throw on invalid input', () => {
      expect(() => myFunction(null)).toThrow();
    });
  });
});
```

### Vitest Test Structure (Integration Tests)

```typescript
// app/services/__tests__/myService.comprehensive.test.ts
import { describe, it, expect } from 'vitest';
import { myService } from '@/app/services/myService';

describe('MyService Comprehensive Tests', () => {
  it('handles edge case: empty array', () => {
    const result = myService.process([]);
    expect(result).toEqual([]);
  });

  it('handles edge case: large dataset', () => {
    const largeData = Array.from({ length: 10000 }, (_, i) => i);
    const result = myService.process(largeData);
    expect(result.length).toBe(10000);
  });
});
```

### Using Test Utilities

```typescript
import { createMockTransaction } from '../__tests__/test-utils';
import { XLM_PAYMENT_TRANSACTIONS } from '../

/* … truncated 5617 chars — edit only what you need near the top … */
