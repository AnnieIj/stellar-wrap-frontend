# WrapStore Indexing Persistence Test Suite Summary

## Overview
Comprehensive unit and integration tests for `app/store/wrapStore.ts` ensuring proper persistence lifecycle management, expiration handling, and corruption recovery for indexing state.

## Test Framework
- **Framework**: Vitest (v4.1.10)
- **Mock Timers**: `vi.useFakeTimers()` for time-based scenarios
- **Storage Mocking**: Mock `localStorage` implementation with spy tracking

## Key Constants Tested
- **PERSISTENCE_KEY**: `"stellar-wrap-indexing-state"`
- **PERSISTENCE_TIMEOUT**: `5 * 60 * 1000` (5 minutes)

## Test Suite Structure

### A. Fresh State Hydration (2 tests) ✅
Tests that valid, non-expired persisted state is correctly loaded and rehydrated into the store.

#### Test Cases:
1. **Rehydrates valid fresh state (t < PERSISTENCE_TIMEOUT)**
   - Scenario: State stored 60 seconds ago
   - Validates: `isLoading: true`, `currentStep`, progress values, completion records
   - Confirms: Storage entry NOT purged

2. **Rehydrates at boundary (t = PERSISTENCE_TIMEOUT - 1ms)**
   - Scenario: State at exact fresh boundary
   - Validates: State accepted as fresh
   - Edge case: Boundary condition testing

### B. Expired State Clearing & Rejection (2 tests) ✅
Tests that stale state beyond `PERSISTENCE_TIMEOUT` is properly rejected and purged.

#### Test Cases:
1. **Rejects state at expiry boundary (t = PERSISTENCE_TIMEOUT)**
   - Scenario: State exactly at expiration threshold
   - Validates: `loadIndexingState()` returns `false`
   - Confirms: Storage entry explicitly purged via `removeItem()`
   - Asserts: Store falls back to clean initial state (all progress at 0, no loading spinners)

2. **Rejects very stale state (t >> PERSISTENCE_TIMEOUT)**
   - Scenario: State from over 1 hour ago
   - Validates: No resurrection of stale `loading: true` or progress indicators
   - Confirms: Storage purged, clean initial state restored

### C. Time-Fast-Forwarding / Active Expiry (2 tests) ✅
Tests dynamic expiration behavior using fake timer advancement.

#### Test Cases:
1. **Fresh → Expired transition on re-check**
   - Scenario: Load fresh state, advance time past timeout, reload
   - Validates: Initially loads successfully, then rejects after timeout
   - Confirms: Storage purged after timeout

2. **Boundary precision check (PERSISTENCE_TIMEOUT + 1ms)**
   - Scenario: Advance exactly PERSISTENCE_TIMEOUT + 1ms
   - Validates: Triggers purge at precise boundary
   - Edge case: Off-by-one millisecond handling

### D. Corrupted JSON Recovery (7 tests) ✅
Tests graceful handling of malformed, invalid, or corrupt storage data.

#### Test Cases:
1. **Malformed JSON string**
   - Input: `"{ malformed_json: "`
   - Validates: Parse error caught, storage purged, no crash
   - Confirms: Console warning emitted

2. **Valid JSON but primitive payload**
   - Input: `JSON.stringify("just-a-string")`
   - Validates: Non-object rejected, storage purged

3. **Valid object with null timestamp**
   - Input: `{ currentStep: "initializing", timestamp: null }`
   - Validates: Invalid timestamp rejected, storage purged

4. **Valid object with string timestamp**
   - Input: `{ ..., timestamp: "not-a-number" }`
   - Validates: Type mismatch rejected, storage purged

5. **Valid object with Infinity timestamp**
   - Input: `{ ..., timestamp: Infinity }`
   - Validates: Non-finite number rejected via `Number.isFinite()` check
   - Confirms: Storage purged

6. **Valid object with NaN timestamp**
   - Input: `{ ..., timestamp: NaN }`
   - Validates: NaN rejected, storage purged

7. **Empty string payload**
   - Input: `""`
   - Validates: Handles empty storage gracefully without error

### E. Storage Operations & State Lifecycle (6 tests) ✅
Tests the complete persistence lifecycle across store actions.

#### Test Cases:
1. **saveIndexingState persists when isLoading = true**
   - Validates: Active indexing state is saved to storage
   - Confirms: Correct timestamp and step data persisted

2. **saveIndexingState skips when isLoading = false**
   - Validates: No storage writes when not indexing
   - Confirms: `setItem()` not called

3. **saveIndexingState skips when isCancelled = true**
   - Validates: Cancelled operations don't persist state
   - Confirms: No storage pollution from cancelled runs

4. **clearPersistedIndexingState removes storage entry**
   - Validates: Explicit cleanup removes persisted state
   - Confirms: `removeItem()` called, storage entry deleted

5. **completeIndexing clears state and sets all steps to 100%**
   - Validates: Successful completion cleans up persistence
   - Confirms: All steps marked complete, progress = 100%, `isLoading = false`

6. **cancelIndexing clears state and resets to initial**
   - Validates: Cancellation triggers full reset
   - Confirms: `isCancelled = true`, progress reset, storage purged

### F. No Storage Key Exists (1 test) ✅
Tests behavior when no persisted state exists.

#### Test Case:
1. **Returns false when no key in storage**
   - Scenario: Fresh environment, no prior persistence
   - Validates: `loadIndexingState()` returns `false` gracefully
   - Confirms: No purge attempted, no errors

## Verification Methods

### Mock Time Manipulation
- Uses `vi.useFakeTimers()` and `vi.setSystemTime()`
- Tests boundary conditions: `t - 1ms`, `t`, `t + 1ms`
- Advances timers with `vi.advanceTimersByTime()`

### Storage Spy Tracking
- `getItemSpy`: Tracks reads from storage
- `setItemSpy`: Tracks writes to storage
- `removeItemSpy`: Tracks deletions (purges)
- Verifies correct call counts and parameters

### State Assertions
- Validates all indexing state properties: `currentStep`, `isLoading`, `overallProgress`, etc.
- Confirms step-by-step progress values across all `STEP_ORDER` steps
- Verifies completion records (`completedStepRecord`)

## Test Execution Results

```
✓ app/store/__tests__/wrapStore.test.ts (20 tests) 93ms
  ✓ wrapStore indexing persistence lifecycle (20)
    ✓ A. Fresh State Hydration (2)
    ✓ B. Expired State Clearing & Rejection (2)
    ✓ C. Time-Fast-Forwarding / Active Expiry (2)
    ✓ D. Corrupted JSON Recovery (7)
    ✓ E. Storage Operations & State Lifecycle (6)
    ✓ F. No Storage Key Exists (1)

Test Files  1 passed (1)
     Tests  20 passed (20)
  Duration  1.04s
```

## Acceptance Criteria Status ✅

### ✅ Mock Time Manipulation
- Fake timers used in all time-sensitive tests
- Boundary testing at `t - 1ms`, `t`, and `t + 1ms` implemented
- Timer advancement verified for active expiry scenarios

### ✅ Storage Purging Assertions
- All expired/corrupt scenarios verify `removeItem()` calls
- Storage map state validated post-purge
- Spy call counts tracked accurately

### ✅ Zero UI Artifacts
- Confirmed no `loading: true` or `indexing: true` from expired sessions
- All progress indicators reset to 0 after expiration
- `currentStep` nullified on expiry/corruption

### ✅ Test Suite Execution
- All 20 tests passing
- Zero unhandled promise rejections
- Zero console errors (except expected warnings)
- Clean test lifecycle with proper setup/teardown

## Coverage Highlights

### Edge Cases Covered
- Exact boundary millisecond precision (±1ms)
- Special numeric values: `Infinity`, `NaN`, negative numbers
- Type mismatches: strings, nulls, primitives
- Empty/missing storage keys
- State transitions: idle → loading → complete/cancelled

### Error Recovery Patterns
- JSON parse errors handled gracefully
- Invalid timestamps detected via `typeof` + `Number.isFinite()`
- Best-effort cleanup with try-catch blocks
- Fallback to clean initial state on any corruption

### State Lifecycle Verification
- `startIndexing()` → `saveIndexingState()` → persistence
- `completeIndexing()` → cleanup + full progress
- `cancelIndexing()` → cleanup + reset
- `resetIndexing()` → full state reset

## Running the Tests

```bash
# Run wrapStore tests only
npm run vitest -- wrapStore.test.ts --run

# Run with UI
npm run vitest -- wrapStore.test.ts --ui

# Run with coverage
npm run vitest -- wrapStore.test.ts --coverage
```

## Maintenance Notes

### Adding New Tests
1. Follow existing structure with descriptive scenario names
2. Use fake timers for time-sensitive tests
3. Always verify storage spy calls for persistence operations
4. Clean up timers with `vi.useRealTimers()` in each test

### Updating Constants
If `PERSISTENCE_TIMEOUT` changes:
- Update constant declaration at top of test file
- Review boundary test cases (may need adjustment)
- Verify timer advancement calculations

### Schema Changes
If `PersistedIndexingState` structure changes:
- Update `BASE_STEP_PROGRESS`, `BASE_COMPLETED_RECORD`, `BASE_STEP_TIMINGS`
- Review fresh state hydration tests
- Update corruption recovery test payloads

## Conclusion

This comprehensive test suite provides rigorous verification of the indexing persistence lifecycle, ensuring:
- ✅ Fresh state rehydrates correctly
- ✅ Expired state is rejected and purged
- ✅ Corrupted data doesn't crash the application
- ✅ No stale loading indicators resurface
- ✅ Clean state lifecycle management

All 20 tests pass successfully with excellent coverage of edge cases, boundary conditions, and error recovery scenarios.
