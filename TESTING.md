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
import { XLM_PAYMENT_TRANSACTIONS } from '../__tests__/fixtures';

// Use utilities to create test data
const transaction = createMockTransaction({ hash: '0x123' });

// Use fixtures for common scenarios
const result = service.processTransactions(XLM_PAYMENT_TRANSACTIONS);
```

### Best Practices

1. **Isolation**: Each test should be independent
2. **Descriptive Names**: Test names should clearly describe what is being tested
3. **Arrange-Act-Assert**: Structure tests with clear sections
4. **Edge Cases**: Test boundary conditions and error cases
5. **Mocking**: Use mocks for external dependencies (Jest for unit, minimal mocking in Vitest for integration)
6. **Fixtures**: Reuse test data fixtures when possible
7. **File Naming**: Follow the naming convention to ensure correct runner

### Migrating Tests Between Runners

If you need to move a test from Jest to Vitest or vice versa:

**Jest → Vitest:**
1. Rename file: `*.test.ts` → `*.comprehensive.test.ts` or `*.edge.test.ts`
2. Add imports: `import { describe, it, expect } from 'vitest'`
3. Remove Jest-specific mocks if testing integration

**Vitest → Jest:**
1. Rename file: `*.comprehensive.test.ts` → `*.test.ts`
2. Remove Vitest imports (Jest is global)
3. Add Jest mocks for external dependencies

## Test Categories

### Unit Tests (Jest)

Test individual functions and methods in isolation with mocked dependencies.

**Location**: `**/__tests__/*.test.ts`
**Runner**: Jest
**Command**: `pnpm test:unit`

**Examples:**
- `app/services/__tests__/achievementCalculator.test.ts`
- `app/services/__tests__/assetResolver.test.ts`
- `app/store/__tests__/wrapStore.test.ts`

### Integration Tests (Vitest)

Test how multiple components work together with minimal mocking.

**Location**: `**/__tests__/*.integration.test.ts`
**Runner**: Vitest
**Command**: `pnpm test:integration`

### Comprehensive Tests (Vitest)

Extensive test suites covering all branches and edge cases.

**Location**: `**/__tests__/*.comprehensive.test.ts`
**Runner**: Vitest
**Command**: `pnpm test:integration`

**Example:**
- `app/services/__tests__/achievementCalculator.comprehensive.test.ts`

### Edge Case Tests (Vitest)

Focused tests for boundary conditions and error scenarios.

**Location**: `**/__tests__/*.edge.test.ts`
**Runner**: Vitest
**Command**: `pnpm test:integration`

**Example:**
- `app/services/__tests__/indexerService.edge.test.ts`

### Visual/E2E Tests (Playwright)

Visual regression and end-to-end user flow tests.

**Location**: `e2e/*.spec.ts`
**Runner**: Playwright
**Command**: `pnpm test:visual`

## Continuous Integration

The CI pipeline runs all test suites:

1. **Jest unit tests** (`pnpm test:unit`) - Fast unit tests with mocks
2. **Vitest integration tests** (`pnpm test:integration`) - Comprehensive integration tests
3. **Playwright visual tests** (`pnpm test:visual`) - Visual regression tests

Tests must pass before merging PRs:
- ✅ All Jest tests pass
- ✅ All Vitest tests pass  
- ✅ Coverage thresholds maintained (80%+)
- ✅ Visual regression tests pass
- ✅ All new code includes corresponding tests

## Troubleshooting

### Tests Not Running

**Jest:**
- Ensure dependencies are installed: `pnpm install`
- Check Jest configuration in `jest.config.js`
- Verify test file naming matches: `*.test.ts` or `*.test.tsx`
- Check file is not excluded by patterns in `jest.config.js`

**Vitest:**
- Ensure file naming matches: `*.comprehensive.test.ts`, `*.edge.test.ts`, or `*.integration.test.ts`
- Check `vitest.config.ts` include patterns
- Try running with `--reporter=verbose` for more details

### Import/Module Errors

**Jest:**
- Verify `moduleNameMapper` in `jest.config.js` includes your aliases
- Check `tsconfig.json` paths match Jest config

**Vitest:**
- Verify `resolve.alias` in `vitest.config.ts`
- Vitest has native ESM support, ensure imports use correct syntax

### Tests Timing Out

- Increase timeout in test file: `it('test', async () => {...}, 30000)` (Jest)
- Or globally: `testTimeout: 30000` in config
- Check for unresolved promises or missing `await`

### Type Errors

- Ensure TypeScript is properly configured
- Check `tsconfig.json` includes test files
- Verify type definitions are imported correctly

### Coverage Issues

- Check `collectCoverageFrom` in `jest.config.js`
- Ensure test files are not included in coverage
- Verify coverage thresholds are realistic

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Vitest Documentation](https://vitest.dev/guide/)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Summary

| Test Type | Runner | File Pattern | Command |
|-----------|--------|-------------|---------|
| Unit tests | Jest | `*.test.ts(x)` | `pnpm test:unit` |
| Integration tests | Vitest | `*.integration.test.ts` | `pnpm test:integration` |
| Comprehensive tests | Vitest | `*.comprehensive.test.ts` | `pnpm test:integration` |
| Edge case tests | Vitest | `*.edge.test.ts` | `pnpm test:integration` |
| Visual/E2E tests | Playwright | `*.spec.ts` | `pnpm test:visual` |
| **All tests** | All | All patterns | `pnpm test` |

## Current Status

⚠️ **Note**: The indexer and achievement calculator services are not yet implemented (blocked by issues #34 and #40). The test files are written in a TDD approach and will validate the services once they are implemented.

To make tests pass:
1. Implement the indexer service (issue #34)
2. Implement the achievement calculator service (issue #40)
3. Initialize services in test `beforeEach` hooks
4. Remove placeholder comments and TODOs
