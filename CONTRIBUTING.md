# Contributing to Stellar Wrap

## Handling dependency advisory exceptions

Our CI runs `pnpm audit` on every PR that touches `package.json` or
`pnpm-lock.yaml`, plus a weekly scheduled scan.

If an advisory has no available fix (no patched version exists) and a
maintainer has assessed it as not exploitable in our usage, it can be
suppressed via `pnpm.auditConfig.ignoreCves` in `package.json`:

​```json
{
  "pnpm": {
    "auditConfig": {
      "ignoreCves": ["CVE-2024-XXXXX"]
    }
  }
}
​```

Before adding an entry:
1. Confirm no patched version is available (`pnpm audit` will say so).
2. Document *why* it's safe to ignore in the PR description that adds the
   exception (e.g. "only affects a build-time-only dependency, never
   shipped to production").
3. Revisit ignored CVEs periodically — remove the entry once a fix ships.

Note: this project pins `pnpm@10.25.0`. If upgraded to pnpm v11+, this
field is renamed to `pnpm.auditConfig.ignoreGhsas` and uses GitHub
Advisory IDs (GHSA-xxxx-xxxx-xxxx) instead of CVE numbers.
