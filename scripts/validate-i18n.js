/**
 * Locale catalog consistency check for CI.
 *
 * `next-intl` renders the raw key path when a key is missing from the active
 * locale, so a drifted catalog fails silently: nothing throws, no test breaks,
 * and a French visitor sees `SharePage.copyLink` where a label should be. This
 * script turns that into a build failure.
 *
 * Compares the flattened key paths of every locale declared in
 * `i18n/routing.ts` against the default locale (`en.json`). Key *paths* are
 * compared, never values - a translated string legitimately differs.
 *
 * Usage: node scripts/validate-i18n.js
 * Exit codes:
 *   0 - all catalogs contain exactly the default locale's keys
 *   1 - a catalog is missing keys and/or has extra keys
 *   2 - the script could not run (missing files, unparsable JSON, ...)
 *
 * No dependencies: uses only `node:fs` / `node:path`, matching the pattern of
 * `scripts/validate-env.js`. The issue requires a plain `.js` CommonJS file and
 * this package is CommonJS, so `require()` is used here; the disable below keeps
 * this file from adding to the repository's existing lint errors.
 */

/* eslint-disable @typescript-eslint/no-require-imports -- the issue mandates a plain CommonJS `.js` script and this package is CommonJS, matching scripts/validate-env.js */

const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const routingFile = path.join(rootDir, "i18n", "routing.ts");
const messagesDir = path.join(rootDir, "messages");

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
};

function log(message, color = "") {
  console.log(`${color}${message}${colors.reset}`);
}

function fail(message) {
  log(`ERROR: ${message}`, colors.red);
}

/**
 * Read the locale list from `i18n/routing.ts` rather than hardcoding it, so
 * adding a locale cannot silently skip the check.
 *
 * The array literal is matched structurally so this stays a plain script with no
 * TypeScript loader.
 */
function readLocalesFromRouting() {
  if (!fs.existsSync(routingFile)) {
    throw new Error(`could not find ${path.relative(rootDir, routingFile)}`);
  }
  const source = fs.readFileSync(routingFile, "utf8");
  const match = source.match(/locales\s*:\s*\[([^\]]*)\]/);
  if (!match) {
    throw new Error(
      `could not find a \`locales: [...]\` array in ${path.relative(rootDir, routingFile)}`
    );
  }
  const locales = match[1]
    .split(",")
    .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
  if (locales.length === 0) {
    throw new Error("the `locales` array is empty");
  }
  return locales;
}

function readDefaultLocale(locales) {
  const match = fs.readFileSync(routingFile, "utf8").match(/defaultLocale\s*:\s*['"]([^'"]+)['"]/);
  const fallback = locales[0];
  return match ? match[1] : fallback;
}

/**
 * Flatten a nested catalog into dotted key paths.
 *
 * Only plain objects are descended into; a leaf of any other type (string,
 * number, array, null) is a terminal key.
 */
function flattenKeys(value, prefix = "", out = new Set()) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    if (prefix) {
      out.add(prefix);
    }
    return out;
  }
  const entries = Object.entries(value);
  if (entries.length === 0 && prefix) {
    out.add(prefix);
    return out;
  }
  for (const [key, child] of entries) {
    flattenKeys(child, prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
}

function readCatalog(locale) {
  const file = path.join(messagesDir, `${locale}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`missing message catalog: ${path.relative(rootDir, file)}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`could not parse ${path.relative(rootDir, file)}: ${error.message}`);
  }
  return flattenKeys(parsed);
}

function difference(a, b) {
  return [...a].filter((key) => !b.has(key)).sort();
}

/**
 * Scan the codebase for translation key references.
 * Looks for patterns like:
 * - useTranslations("Namespace")
 * - getTranslations({ namespace: "Namespace" })
 * - t("key") or t("Namespace.key")
 * - t.rich("key")
 */
function scanCodebaseForUsedKeys() {
  const usedKeys = new Set();
  const usedNamespaces = new Set();

  function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip node_modules, .next, etc.
      if (
        entry.name === "node_modules" ||
        entry.name === ".next" ||
        entry.name === ".git" ||
        entry.name === "dist" ||
        entry.name === "coverage"
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (
        entry.name.endsWith(".ts") ||
        entry.name.endsWith(".tsx") ||
        entry.name.endsWith(".js") ||
        entry.name.endsWith(".jsx")
      ) {
        const content = fs.readFileSync(fullPath, "utf8");

        // Find namespace declarations
        const namespaceMatches = [
          ...content.matchAll(/useTranslations\(["']([^"']+)["']\)/g),
          ...content.matchAll(/getTranslations\([^)]*namespace:\s*["']([^"']+)["']/g),
        ];

        for (const match of namespaceMatches) {
          usedNamespaces.add(match[1]);
        }

        // Find key references - t("key") or t("Namespace.key")
        const keyMatches = [
          ...content.matchAll(/\bt\(["']([^"']+)["']\)/g),
          ...content.matchAll(/\bt\.rich\(["']([^"']+)["']\)/g),
        ];

        for (const match of keyMatches) {
          const key = match[1];
          // If it contains a dot, it's a fully qualified key
          if (key.includes(".")) {
            usedKeys.add(key);
          }
          // Otherwise, we need context from namespace - mark the leaf key
          // This is less precise but catches usage
          else {
            // Mark this as potentially used under any namespace
            for (const ns of usedNamespaces) {
              usedKeys.add(`${ns}.${key}`);
            }
          }
        }
      }
    }
  }

  scanDirectory(path.join(rootDir, "app"));
  scanDirectory(path.join(rootDir, "src"));
  scanDirectory(path.join(rootDir, "components"));

  return { usedKeys, usedNamespaces };
}

/**
 * Check for dead keys - keys in catalogs that are never referenced in code.
 */
function checkForDeadKeys(catalogKeys, usedKeys, usedNamespaces) {
  const deadKeys = [];
  const potentiallyDead = [];

  for (const key of catalogKeys) {
    // Direct match
    if (usedKeys.has(key)) {
      continue;
    }

    // Check if the namespace is used (conservative - don't flag as dead if namespace is used)
    const namespace = key.split(".")[0];
    if (usedNamespaces.has(namespace)) {
      // Namespace is used, but we can't confirm this specific key is used
      // This is a potential false positive, so we'll be conservative
      continue;
    }

    // Check for partial matches (e.g., t(`archetypes.${variable}`) won't be caught by direct match)
    const hasPartialMatch = Array.from(usedKeys).some((usedKey) => {
      return usedKey.startsWith(key.split(".")[0] + ".");
    });

    if (hasPartialMatch) {
      continue;
    }

    // Likely dead key
    potentiallyDead.push(key);
  }

  return { deadKeys, potentiallyDead };
}

function main() {
  let locales;
  let defaultLocale;
  try {
    locales = readLocalesFromRouting();
    defaultLocale = readDefaultLocale(locales);
  } catch (error) {
    fail(error.message);
    return 2;
  }

  log(`Validating locale catalogs against "${defaultLocale}"`, colors.blue);
  log(`Locales from i18n/routing.ts: ${locales.join(", ")}`, colors.dim);
  log("");

  let baseKeys;
  try {
    baseKeys = readCatalog(defaultLocale);
  } catch (error) {
    fail(error.message);
    return 2;
  }

  log(`${defaultLocale}.json: ${baseKeys.size} keys`, colors.dim);

  let hasErrors = false;

  for (const locale of locales) {
    if (locale === defaultLocale) {
      continue;
    }
    let keys;
    try {
      keys = readCatalog(locale);
    } catch (error) {
      fail(error.message);
      hasErrors = true;
      continue;
    }

    const missing = difference(baseKeys, keys);
    const extra = difference(keys, baseKeys);

    if (missing.length === 0 && extra.length === 0) {
      log(`  ${locale}.json: OK (${keys.size} keys)`, colors.green);
      continue;
    }

    hasErrors = true;
    log(
      `  ${locale}.json: out of sync (${keys.size} keys, expected ${baseKeys.size})`,
      colors.yellow
    );
    if (missing.length > 0) {
      log(`    Missing in ${locale}:`, colors.red);
      for (const key of missing) {
        log(`      - ${key}`, colors.red);
      }
    }
    if (extra.length > 0) {
      log(`    Extra in ${locale} (not in ${defaultLocale}):`, colors.yellow);
      for (const key of extra) {
        log(`      + ${key}`, colors.yellow);
      }
    }
  }

  // Check for unused keys
  log("");
  log("Scanning codebase for unused translation keys...", colors.blue);
  const { usedKeys, usedNamespaces } = scanCodebaseForUsedKeys();
  log(`Found ${usedKeys.size} key references in code`, colors.dim);
  log(`Found ${usedNamespaces.size} namespace declarations`, colors.dim);

  const { deadKeys, potentiallyDead } = checkForDeadKeys(baseKeys, usedKeys, usedNamespaces);

  if (potentiallyDead.length > 0) {
    log("");
    log(`Potentially unused keys in ${defaultLocale}.json:`, colors.yellow);
    log(
      `  (These keys exist in catalogs but were not found in code scans)`,
      colors.dim
    );
    for (const key of potentiallyDead) {
      log(`    ? ${key}`, colors.yellow);
    }
    log("");
    log(
      `Note: This check may have false positives for dynamically constructed keys.`,
      colors.dim
    );
    log(`Review these keys manually to confirm they are truly unused.`, colors.dim);
  } else {
    log(`  No obviously unused keys detected`, colors.green);
  }

  log("");
  if (hasErrors) {
    fail(
      "locale catalogs are out of sync. Add the missing keys to each locale, " +
        `or remove keys that no longer exist in ${defaultLocale}.json.`
    );
    return 1;
  }

  log(`All ${locales.length} locales match ${defaultLocale}.json.`, colors.green);
  return 0;
}

process.exit(main());
