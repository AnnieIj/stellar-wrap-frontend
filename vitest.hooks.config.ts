/**
 * Vitest configuration for unit tests that require a browser-like DOM
 * environment (React hooks, browser APIs).
 *
 * Covers:
 *   - src/hooks/__tests__/useFreighterWallet.test.ts
 *   - src/utils/__tests__/stellarAmounts.test.ts
 *
 * Run with:
 *   pnpm test:hooks
 */
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: [
      "src/hooks/__tests__/useFreighterWallet.test.ts",
      "src/utils/__tests__/stellarAmounts.test.ts",
    ],
    setupFiles: ["./vitest.hooks.setup.ts"],
  },
  resolve: {
    alias: [
      { find: "@/data", replacement: path.resolve(__dirname, "./src/data") },
      { find: "@", replacement: path.resolve(__dirname, "./") },
    ],
  },
});
