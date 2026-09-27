# Testing Strategy

## Overview

This project uses a **dual test runner strategy** to leverage the strengths of each testing framework:

| Framework | Purpose | When to Use |
|-----------|---------|-------------|
| **Jest** | Unit tests with mocking | Testing isolated functions, components, modules |
| **Vitest** | Integration & comprehensive tests | Testing service interactions, edge cases, large test suites |
| **Playwright** | Visual regression & E2E | Testing UI rendering and user flows |

## File Naming Convention

The test runner is determined by the file naming pattern:

```
✅ *.test.ts          → Jest (unit tests)
✅ *.test.tsx         → Jest (React component tests)
✅ *.comprehensive.test.ts → Vitest (comprehensive test suites)
✅ *.edge.test.ts     → Vitest (edge case tests)
✅ *.integration.test.ts   → Vitest (integration tests)
✅ *.spec.ts          → Playwright (E2E/visual tests)
```

## Decision Matrix

### Use Jest when:
- ✅ Testing a single function or method in isolation
- ✅ Testing React components
- ✅ Need extensive mocking of dependencies
- ✅ Testing Next.js-specific features
- ✅ Writing traditional unit tests

### Use Vitest when:
- ✅ Testing interactions between multiple services
- ✅ Writing comprehensive test suites (100+ assertions)
- ✅ Testing edge cases and boundary conditions
- ✅ Need fast test execution and HMR
- ✅ Testing with minimal or no mocks (integration style)

### Use Playwright when:
- ✅ Testing visual appearance of components
- ✅ Testing complete user flows (E2E)
- ✅ Visual regression testing

## Commands

```bash
# Run all tests (Jest + Vitest)
pnpm test

# Run only unit tests (Jest)
pnpm test:unit

# Run only integration tests (Vitest)
pnpm test:integration

# Watch mode
pnpm test:watch              # Jest
pnpm test:integration:watch  # Vitest

# UI mode (Vitest only)
pnpm test:integration:ui

# Coverage
pnpm test:coverage  # Jest coverage

# Visual tests
pnpm test:visual
pnpm test:visual:update  # Update snapshots
```

## Configuration Files

| File | Purpose | Key Settings |
|------|---------|-------------|
| `jest.config.js` | Jest configuration | Excludes `*.comprehensive.test.ts` and `*.edge.test.ts` |
| `vitest.config.ts` | Vitest configuration | Includes only `*.comprehensive.test.ts`, `*.edge.test.ts`, `*.integration.test.ts` |
| `playwright.config.ts` | Playwright configuration | Visual regression settings |

## CI Pipeline

The CI runs tests in this order:

1. **Lint** - Code quality checks
2. **Jest unit tests** - Fast unit tests with mocks
3. **Vitest integration tests** - Comprehensive integration tests
4. **Build** - Ensure code compiles
5. **Playwright visual tests** - Visual regression (separate workflow)

All test suites must pass for PR approval.

## Coverage

Jest generates coverage reports for unit tests:
- **Target**: 80%+ for all metrics
- **Report**: `coverage/lcov-report/index.html`
- **Command**: `pnpm test:coverage`

## Examples

### Jest Unit Test Example

```typescript
// app/services/__tests__/myService.test.ts
import { myFunction } from '../myService';

describe('MyService', () => {
  it('should process valid input', () => {
    const result = myFunction({ value: 42 });
    expect(result).toBe(84);
  });

  it('should throw on invalid input', () => {
    expect(() => myFunction(null)).toThrow('Invalid input');
  });
});
```

### Vitest Integration Test Example

```typescript
// app/services/__tests__/myService.comprehensive.test.ts
import { describe, it, expect } from 'vitest';
import { myService } from '@/app/services/myService';

describe('MyService Comprehensive Tests', () => {
  it('handles edge case: empty dataset', () => {
    const result = myService.process([]);
    expect(result).toEqual({ count: 0, items: [] });
  });

  it('handles edge case: large dataset', () => {
    const largeData = Array.from({ length: 100000 }, (_, i) => i);
    const result = myService.process(largeData);
    expect(result.count).toBe(100000);
  });

  it('integrates with cache and indexer', () => {
    // Test with real dependencies, minimal mocking
    const result = myService.fullFlow();
    expect(result.cached).toBe(true);
    expect(result.indexed).toBe(true);
  });
});
```

## Migration Guide

### Moving a Test from Jest to Vitest

1. Rename file: `myService.test.ts` → `myService.comprehensive.test.ts`
2. Add Vitest imports: `import { describe, it, expect } from 'vitest'`
3. Replace Jest mocks with real implementations (if testing integration)
4. Update any Jest-specific syntax

### Moving a Test from Vitest to Jest

1. Rename file: `myService.comprehensive.test.ts` → `myService.test.ts`
2. Remove Vitest imports (Jest is global)
3. Add mocks for external dependencies
4. Update any Vitest-specific syntax

## Best Practices

1. **Follow naming conventions** - File names determine which runner executes the test
2. **Keep tests focused** - Unit tests in Jest, integration in Vitest
3. **Avoid mixing patterns** - Don't put comprehensive tests in `*.test.ts` files
4. **Mock appropriately** - Heavy mocking in Jest, minimal in Vitest
5. **Run locally** - Test with both runners before pushing
6. **Check CI** - Ensure both test suites pass in CI

## Troubleshooting

### Test file not running?

Check the file naming:
- Jest: Must end with `.test.ts` or `.test.tsx`
- Vitest: Must end with `.comprehensive.test.ts`, `.edge.test.ts`, or `.integration.test.ts`

### Import errors?

- **Jest**: Check `moduleNameMapper` in `jest.config.js`
- **Vitest**: Check `resolve.alias` in `vitest.config.ts`

### Tests timing out?

- Increase timeout: `it('test', async () => {...}, 30000)`
- Or set globally in config

## Summary

This dual-strategy approach gives us:

✅ **Fast unit tests** with Jest's mature mocking ecosystem  
✅ **Comprehensive integration tests** with Vitest's speed and modern features  
✅ **Clear separation** through file naming conventions  
✅ **No conflicts** - each runner handles its own test files  
✅ **CI confidence** - both suites run on every PR

For detailed usage, see [TESTING.md](./TESTING.md).
