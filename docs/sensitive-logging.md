# Sensitive logging (code review)

Do **not** log in production builds:

- Stellar account addresses (`G…`)
- Raw indexer results / transaction payloads
- Signed XDR or secrets

Use `app/utils/indexerDebug.ts` (`indexerDebug` / `indexerWarn` / `indexerError`), which is gated by `NODE_ENV === "development"` or `NEXT_PUBLIC_DEBUG_INDEXER=true`.

ESLint: `no-console` is enforced as a **warn** under `app/loading/**` and `app/services/indexerService.ts` so new console calls are flagged in review.
