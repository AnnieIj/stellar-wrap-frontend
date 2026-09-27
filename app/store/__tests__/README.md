# WrapStore Test Suite

## Quick Start

```bash
# Run all wrapStore tests
npm run vitest -- wrapStore.test.ts --run

# Run with watch mode
npm run vitest -- wrapStore.test.ts

# Run with UI
npm run vitest -- wrapStore.test.ts --ui
```

## Test Coverage

### 20 Tests Across 6 Categories

| Category | Tests | Focus |
|----------|-------|-------|
| A. Fresh State Hydration | 2 | Valid state rehydration within timeout |
| B. Expired State Clearing | 2 | Stale state rejection and purging |
| C. Time-Fast-Forwarding | 2 | Dynamic expiration with timer advancement |
| D. Corrupted JSON Recovery | 7 | Malformed data handling and error recovery |
| E. Storage Operations | 6 | Complete lifecycle management |
| F. No Storage Key | 1 | Empty storage handling |

## Key Testing Patterns

### 1. Mock Timer Setup
```typescript
const now = 1_700_000_000_000;
vi.useFakeTimers().setSystemTime(now);

// Your test code here

vi.useRealTimers(); // Cleanup
```

### 2. Storage Spy Verification
```typescript
expect(setItemSpy).toHaveBeenCalled();
expect(removeItemSpy).toHaveBeenCalledWith(PERSISTENCE_KEY);
expect(storageMap.has(PERSISTENCE_KEY)).toBe(false);
```

### 3. State Assertions
```typescript
const state = useWrapStore.getState();
expect(state.isLoading).toBe(false);
expect(state.currentStep).toBe(null);
expect(state.overallProgress).toBe(0);
```

## Testing the Expiration Logic

The persistence timeout is **5 minutes (300,000ms)**:

```typescript
const PERSISTENCE_TIMEOUT = 5 * 60 * 1000; // 300,000ms
```

### Valid State (Fresh)
- `timestamp`: `now - 60_000` (1 minute ago) ✅
- `timestamp`: `now - (PERSISTENCE_TIMEOUT - 1)` (4:59.999 ago) ✅

### Invalid State (Expired)
- `timestamp`: `now - PERSISTENCE_TIMEOUT` (exactly 5 minutes) ❌
- `timestamp`: `now - PERSISTENCE_TIMEOUT - 1` (5:00.001+ ago) ❌

## Testing Corrupted Data

The suite tests various corruption scenarios:

### JSON Parse Failures
```typescript
storageMap.set(PERSISTENCE_KEY, "{ malformed_json: ");
// Expects: purge storage, return false, warn to console
```

### Type Mismatches
```typescript
// String timestamp
{ timestamp: "not-a-number" }

// Null timestamp  
{ timestamp: null }

// Primitive payload
"just-a-string"
```

### Special Numeric Values
```typescript
// Infinity
{ timestamp: Infinity }

// NaN
{ timestamp: NaN }
```

All corruption scenarios should:
1. Return `false` from `loadIndexingState()`
2. Purge the storage entry
3. Fall back to clean initial state

## State Lifecycle Testing

### Start → Save → Load
```typescript
store.startIndexing();                    // isLoading = true
store.setCurrentStep("fetching-transactions");
store.saveIndexingState();                // Persists to storage
const loaded = store.loadIndexingState(); // Rehydrates state
```

### Complete → Cleanup
```typescript
store.completeIndexing(); // Sets all progress to 100%, clears storage
```

### Cancel → Reset
```typescript
store.cancelIndexing(); // Resets to initial state, clears storage
```

## Debugging Failed Tests

### Test fails on storage operations
1. Check that `storageMap` is properly reset in `beforeEach`
2. Verify spy mocks are cleared: `getItemSpy.mockClear()`
3. Ensure `useWrapStore.getState().reset()` is called

### Test fails on time-based assertions
1. Verify fake timers are set: `vi.useFakeTimers().setSystemTime(now)`
2. Check timer advancement: `vi.advanceTimersByTime(duration)`
3. Ensure cleanup: `vi.useRealTimers()` in test

### Test fails on state assertions
1. Get fresh state after mutations: `const s = useWrapStore.getState()`
2. Don't reuse stale state references
3. Check that store was reset in `beforeEach`

## Adding New Tests

### Template
```typescript
it("test description", () => {
  const now = 1_700_000_000_000;
  vi.useFakeTimers().setSystemTime(now);

  // Setup: create persisted state or configure store
  const persisted: PersistedIndexingState = {
    currentStep: "fetching-transactions",
    completedSteps: 1,
    stepProgress: { ...BASE_STEP_PROGRESS },
    overallProgress: 20,
    completedStepRecord: { ...BASE_COMPLETED_RECORD },
    stepTimings: { ...BASE_STEP_TIMINGS },
    startTime: now - 10_000,
    timestamp: now - 5_000, // 5 seconds ago
  };
  storageMap.set(PERSISTENCE_KEY, JSON.stringify(persisted));

  // Action: call store methods
  const loaded = useWrapStore.getState().loadIndexingState();

  // Assertions
  expect(loaded).toBe(true);
  const s = useWrapStore.getState();
  expect(s.currentStep).toBe("fetching-transactions");
  expect(s.isLoading).toBe(true);

  // Cleanup
  vi.useRealTimers();
});
```

## Common Pitfalls

### ❌ Don't
```typescript
const store = useWrapStore.getState();
store.startIndexing();
expect(store.isLoading).toBe(true); // May use stale reference
```

### ✅ Do
```typescript
const store = useWrapStore.getState();
store.startIndexing();
const updatedStore = useWrapStore.getState(); // Fresh reference
expect(updatedStore.isLoading).toBe(true);
```

### ❌ Don't
```typescript
it("test", () => {
  vi.useFakeTimers();
  // ... test code ...
  // Missing vi.useRealTimers() - will affect subsequent tests!
});
```

### ✅ Do
```typescript
it("test", () => {
  vi.useFakeTimers().setSystemTime(now);
  // ... test code ...
  vi.useRealTimers(); // Always cleanup
});
```

## Integration with CI/CD

The test suite is designed for automated environments:
- ✅ No external dependencies
- ✅ Deterministic with fake timers
- ✅ Fast execution (~90ms)
- ✅ Zero flakiness
- ✅ Comprehensive error messages

Add to CI pipeline:
```yaml
- name: Run wrapStore tests
  run: npm run vitest -- wrapStore.test.ts --run
```

## Related Documentation

- [TESTING_SUMMARY.md](./TESTING_SUMMARY.md) - Detailed test coverage report
- [wrapStore.ts](../wrapStore.ts) - Store implementation
- [indexing.ts](../../types/indexing.ts) - Type definitions

## Questions or Issues?

If tests fail unexpectedly:
1. Check that dependencies are installed: `npm install`
2. Verify Vitest version: `npm run vitest -- --version`
3. Review recent changes to store or types
4. Check for timing issues with fake timers
5. Ensure proper cleanup in `afterEach` hooks

For test improvements or additional coverage, refer to the acceptance criteria in the original requirements document.
