import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "**/__tests__/**/*.comprehensive.test.[jt]s?(x)",
      "**/__tests__/**/*.edge.test.[jt]s?(x)",
      "**/__tests__/**/*.integration.test.[jt]s?(x)",
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        '.next/**',
        'coverage/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
      ],
    },
  },
  resolve: {
    alias: [
      { find: "@/data", replacement: path.resolve(__dirname, "./src/data") },
      { find: "@", replacement: path.resolve(__dirname, "./") },
    ],
  },
});
