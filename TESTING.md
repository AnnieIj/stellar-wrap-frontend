# Testing Strategy

This document records which test runner executes which suite, why the split
exists today, and the target state for consolidating onto a single runner.

## Current state

`package.json` currently wires the suites to two different runners:

| Script | Runner | Config |
| --- | --- | --- |
| `test:unit` | Jest | `jest.config.js` |
| `test:components` | Jest | `jest.config.components.js` |
| `test:integration` | Vitest | `vitest.config.ts` |
| `test:hooks` | Vitest | `vitest.hooks.config.ts` |

That means two mocking APIs (`jest.mock` vs `vi.mock`), two setup files, and
two transform pipelines for what is, in practice, one JavaScript/TypeScript
codebase. A contributor adding a new test has no stated rule for which runner
to reach for.

### Why the split exists

The split is **accidental, not principled**. It grew out of the order in which
suites were added:

- The unit and component suites were written first, when Jest was the default
  in the project template.
- The integration and hook suites were added later by contributors who were
  already using Vitest elsewhere; they brought their own config rather than
  extending the Jest setup.

No suite depends on a capability that is unique to its current runner. The
four configs differ only in `testMatch`/`include` globs, `testEnvironment`, and
setup-file wiring — all of which a single runner can express per-project.

## Target state

**Vitest is the surviving runner for both the unit and integration suites.**

Rationale, based on the actual transform and mocking story rather than
assumption:

- **Transform:** Vitest uses Vite's transform pipeline, which handles the
  project's TypeScript and ESM sources without the extra Babel/SWC layer Jest
  needs. The project is not Vite-based, but the transform story still works:
  Vitest resolves and transforms the same `src/**` modules the suites import,
  and the existing `vitest.config.ts` already proves this for the integration
  and hook suites.
- **Mocking:** `vi.mock`/`vi.fn`/`vi.spyOn` cover the module and timer mocking
  the unit and component suites rely on, so no Jest-only mocking API is
  required.
- **Environment:** Vitest's `environment` option (`node` vs `jsdom`) covers the
  node-only unit tests and the DOM-dependent component tests, so the two Jest
  configs collapse into per-project settings on one config.

## Migration

Migrate in **one pass**, not file by file:

1. Point `test:unit` and `test:components` at Vitest.
2. Convert the Jest suites' `jest.mock`/`jest.fn`/`jest.spyOn` calls to the
   `vi.*` equivalents and import `{ describe, it, expect, vi }` from `vitest`.
3. Replace the Jest setup file with the Vitest setup file so both suites share
   one setup path.
4. Remove `jest.config.js` and `jest.config.components.js` once no suite
   references them.

## Configs after migration

Collapse the four configs to the minimum the surviving runner needs — one
config per genuinely distinct environment:

- `vitest.config.ts` — the single config, with a `node` project for the unit
  suite and a `jsdom` project for the component suite.
- `vitest.hooks.config.ts` — retained only if the hook suite genuinely needs a
  distinct environment from the two above; otherwise fold it into
  `vitest.config.ts` as a third project.

`jest.config.js` and `jest.config.components.js` are deleted.

## Done criteria

- One runner (Vitest) executes the unit and integration suites.
- One config per genuinely distinct environment, with no Jest configs left.
- This document states the boundary so a contributor knows which runner to use
  for a new test.
