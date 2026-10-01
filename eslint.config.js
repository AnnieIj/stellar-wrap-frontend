import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: [
      "app/[locale]/share/**/*.{js,jsx,ts,tsx}",
      "app/[locale]/persona/**/*.{js,jsx,ts,tsx}",
    ],
    rules: {
      "react/jsx-no-literals": [
        "error",
        {
          noStrings: true,
          allowedStrings: [],
          ignoreProps: true,
        },
      ],
    },
  },
];

export default eslintConfig;
