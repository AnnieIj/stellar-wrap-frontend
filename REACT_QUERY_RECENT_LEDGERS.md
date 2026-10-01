Closes #438

# React Query Implementation for Recent Ledgers

## Overview

This implementation adds React Query (TanStack Query) caching for fetching Recent Ledgers from the Stellar Horizon API, replacing the traditional `useEffect` approach with a more robust, performant solution.

## Implementation Details

### 1. React Query Setup

**Added Dependencies:**
- `@tanstack/react-query@^5.102.8` - React Query library for data fetching and caching

**Provider Configuration:**
- Updated `app/providers.tsx` to include `QueryClientProvider`
- Configured default query options:
  - `staleTime: 60 * 1000` (1 minute) - Data remains fresh for 1 minute
  - `retry: 3` - Retry failed requests 3 times
  - `refetchOnWindowFocus: false` - Disable automatic refetch on window focus

### 2. useRecentLedgers Hook

**Location:** `app/hooks/useRecentLedgers.ts`

**Features:**
- **Caching:** Uses React Query's built-in caching mechanism
- **TypeScript Strict Typing:** All interfaces use proper TypeScript types, no `any` types
- **Optimistic Updates:** Implements optimistic updates for ledger mutations
- **Error Rollback:** Automatically rolls back on mutation failures
- **Pagination:** Supports cursor-based pagination for ledger data

**Key Functions:**

```typescript
// Main hook for fetching recent ledgers
export function useRecentLedgers(params: RecentLedgersParams): UseRecentLedgersResult

// Hook for mutating ledger data with optimistic updates
export function useLedgerMutation(options?: UseLedgerMutationOptions)

// Prefetch function for performance optimization
export function prefetchRecentLedgers(params: RecentLedgersParams, queryClient: QueryClient)
```

**TypeScript Interfaces:**
- `Ledger` - Stellar ledger data structure
- `RecentLedgersParams` - Configuration for fetching ledgers
- `UseRecentLedgersResult` - Return type for the hook
- `UseLedgerMutationOptions` - Options for mutation callbacks

### 3. RecentLedgers Component

**Location:** `app/components/RecentLedgers.tsx`

**Features:**
- **Loading States:** Displays loading spinner while fetching data
- **Error Handling:** Shows error messages with retry functionality
- **Empty States:** Handles cases with no ledger data
- **Pagination:** Load more functionality for paginated results
- **Responsive Design:** Uses Tailwind CSS for responsive styling
- **Animation:** Uses Framer Motion for smooth transitions
- **No Inline Styles:** All styling uses Tailwind CSS classes

**Component Props:**
```typescript
interface RecentLedgersProps {
  limit?: number;           // Number of ledgers to fetch (default: 10)
  showMutationExample?: boolean; // Show mutation example button (default: false)
}
```

### 4. Demo Page

**Location:** `app/[locale]/recent-ledgers/page.tsx`

A demo page showcasing the RecentLedgers component with mutation examples enabled.

## Architecture Benefits

### Performance Improvements
- **Caching:** Reduces redundant API calls by caching responses
- **Optimistic Updates:** UI updates immediately without waiting for server response
- **Background Refetching:** Keeps data fresh in the background
- **Request Deduplication:** Prevents duplicate requests for the same data

### Developer Experience
- **Type Safety:** Full TypeScript support prevents runtime errors
- **Declarative Data Fetching:** Clear separation of data fetching logic
- **Built-in Loading/Error States:** No need for manual state management
- **Retry Logic:** Automatic retry on failures with configurable options

### React Component Optimization
- **Prevents Unnecessary Re-renders:** React Query's memoization prevents unnecessary component updates
- **Automatic Cache Invalidation:** Smart cache management based on query keys
- **Selective Updates:** Only components using specific data re-render when that data changes

## Usage Examples

### Basic Usage

```typescript
import { RecentLedgers } from "@/app/components/RecentLedgers";

function MyComponent() {
  return <RecentLedgers limit={10} />;
}
```

### With Custom Network

```typescript
import { useRecentLedgers } from "@/app/hooks/useRecentLedgers";

function MyComponent() {
  const { ledgers, isLoading, error } = useRecentLedgers({
    network: "testnet",
    limit: 5
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {ledgers?.map(ledger => (
        <div key={ledger.id}>{ledger.sequence}</div>
      ))}
    </div>
  );
}
```

### With Optimistic Updates

```typescript
import { useLedgerMutation } from "@/app/hooks/useRecentLedgers";

function MyComponent() {
  const { mutateLedger, isLoading } = useLedgerMutation({
    onSuccess: (data) => console.log("Success:", data),
    onError: (error) => console.error("Error:", error)
  });

  const handleUpdate = (ledgerId: string) => {
    mutateLedger(ledgerId);
  };

  return <button onClick={() => handleUpdate("ledger-id")}>Update</button>;
}
```

### Prefetching for Performance

```typescript
import { useQueryClient } from "@tanstack/react-query";
import { prefetchRecentLedgers } from "@/app/hooks/useRecentLedgers";

function MyComponent() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Prefetch data before it's needed
    prefetchRecentLedgers(
      { network: "mainnet", limit: 10 },
      queryClient
    );
  }, [queryClient]);

  return <div>Content</div>;
}
```

## Technical Constraints Compliance

### ✅ Modularity
- Components are decoupled and reusable
- Hooks can be used independently
- Clear separation of concerns (data fetching, UI, state management)

### ✅ TypeScript Strict Typing
- No `any` types used
- All interfaces properly typed
- Type-safe API calls with proper return types

### ✅ Styling
- No inline styles used
- All styling uses Tailwind CSS classes
- Follows project's centralized styling approach

### ✅ Error Handling
- Comprehensive error states
- Automatic retry logic
- Error rollback for optimistic updates
- User-friendly error messages

### ✅ Performance
- Local caching minimizes redundant fetching
- Optimistic updates improve perceived performance
- Background refetching keeps data fresh
- Request deduplication prevents duplicate calls

## Testing Recommendations

### Unit Tests
```typescript
// Test useRecentLedgers hook
describe('useRecentLedgers', () => {
  it('should fetch ledgers successfully', async () => {
    const { result } = renderHook(() => useRecentLedgers({
      network: 'mainnet',
      limit: 10
    }));
    
    await waitFor(() => expect(result.current.ledgers).toBeDefined());
  });

  it('should handle errors gracefully', async () => {
    // Mock error scenario
    const { result } = renderHook(() => useRecentLedgers({
      network: 'mainnet',
      limit: 10
    }));
    
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });
});
```

### Integration Tests
```typescript
// Test RecentLedgers component
describe('RecentLedgers', () => {
  it('should render loading state', () => {
    render(<RecentLedgers limit={10} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should render ledger data', async () => {
    render(<RecentLedgers limit={10} />);
    await waitFor(() => expect(screen.getByText(/recent ledgers/i)).toBeInTheDocument());
  });
});
```

## Future Enhancements

1. **Real-time Updates:** Implement WebSocket integration for real-time ledger updates
2. **Advanced Caching:** Add more sophisticated cache strategies (stale-while-revalidate)
3. **Analytics:** Add performance monitoring for cache hit rates
4. **Offline Support:** Implement offline cache with IndexedDB integration
5. **Infinite Scroll:** Add infinite scroll for better UX with large datasets

## Migration Guide

### From useEffect to React Query

**Before (useEffect):**
```typescript
const [ledgers, setLedgers] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

useEffect(() => {
  const fetchLedgers = async () => {
    setLoading(true);
    try {
      const response = await fetchLedgers();
      setLedgers(response);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };
  
  fetchLedgers();
}, []);
```

**After (React Query):**
```typescript
const { ledgers, isLoading, error } = useRecentLedgers({
  network: 'mainnet',
  limit: 10
});
```

## Conclusion

This React Query implementation provides a robust, performant solution for fetching Recent Ledgers with built-in caching, optimistic updates, and comprehensive error handling. The architecture follows React best practices and improves both developer experience and end-user performance.

Closes #438