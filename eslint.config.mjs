import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Require a description on every eslint-disable comment so suppressions are
  // self-documenting. New disable comments without a reason will fail linting.
  {
    plugins: {
      "eslint-comments": eslintComments,
    },
    rules: {
      "eslint-comments/require-description": [
        "error",
        { ignore: ["eslint-enable"] },
      ],
    },
  },
  // Code review: discourage ad-hoc console logging in indexer/loading paths
  // (use app/utils/indexerDebug.ts). See docs/sensitive-logging.md.
  {
    files: ["app/**/*.{ts,tsx,js,jsx}", "src/**/*.{ts,tsx,js,jsx}"],
    ignores: [
      "app/utils/logger.ts",
      "**/__tests__/**",
      "**/*.test.ts",
      "**/*.test.tsx",
    ],
    rules: {
      "no-console": "error",
    },
  },
]);

export default eslintConfig;
