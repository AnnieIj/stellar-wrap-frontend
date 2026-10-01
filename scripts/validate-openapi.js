/**
 * OpenAPI specification validator for CI.
 *
 * Validates that:
 * 1. Every route handler in app/api has a corresponding path in openapi.yaml
 * 2. Every path in openapi.yaml corresponds to an actual route handler
 * 3. HTTP methods match between the spec and the handlers
 *
 * This prevents the API spec from drifting silently as routes are added,
 * removed, or modified.
 *
 * Usage: node scripts/validate-openapi.js
 * Exit codes:
 *   0 - OpenAPI spec matches route handlers
 *   1 - Mismatches found (missing routes, extra routes, or method mismatches)
 *   2 - Script could not run (missing files, parse errors, etc.)
 */

/* eslint-disable @typescript-eslint/no-require-imports -- plain CommonJS script matching validate-env.js and validate-i18n.js */

const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const apiDir = path.join(rootDir, "app", "api");
const openapiFile = path.join(rootDir, "openapi.yaml");

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
 * Recursively walk app/api and collect route handlers.
 * Returns array of { path, methods, file }
 *
 * Next.js App Router conventions:
 * - app/api/wrapped/route.ts -> /api/wrapped
 * - app/api/notifications/subscribe/route.ts -> /api/notifications/subscribe
 * - app/api/notifications/data/[wallet]/route.ts -> /api/notifications/data/{wallet}
 */
function findRouteHandlers(dir, basePath = "") {
  const routes = [];

  if (!fs.existsSync(dir)) {
    return routes;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip internal directories
      if (entry.name.startsWith("_") || entry.name.startsWith(".")) {
        continue;
      }

      // Dynamic route segment: [wallet] -> {wallet}
      const segment = entry.name.startsWith("[") && entry.name.endsWith("]")
        ? `{${entry.name.slice(1, -1)}}`
        : entry.name;

      routes.push(...findRouteHandlers(fullPath, `${basePath}/${segment}`));
    } else if (entry.name === "route.ts" || entry.name === "route.tsx") {
      // Found a route handler
      const methods = extractExportedMethods(fullPath);
      const apiPath = `/api${basePath}`;
      const responseCodes = extractResponseTypes(fullPath);
      routes.push({ 
        path: apiPath, 
        methods, 
        responseCodes,
        file: path.relative(rootDir, fullPath) 
      });
    }
  }

  return routes;
}

/**
 * Parse a route.ts file and extract exported HTTP method functions.
 * Looks for: export async function GET, export function POST, etc.
 */
function extractExportedMethods(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const methods = [];

  const methodPattern = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(/g;
  let match;

  while ((match = methodPattern.exec(content)) !== null) {
    methods.push(match[1].toLowerCase());
  }

  return methods.sort();
}

/**
 * Extract response types from a route handler.
 * Looks for NextResponse.json() calls and their types.
 */
function extractResponseTypes(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const responses = [];

  // Match NextResponse.json({ ... }, { status: 200 })
  // This is a simple heuristic - captures common patterns
  const responsePattern = /NextResponse\.json\([^,]+,\s*\{\s*status:\s*(\d+)\s*\}/g;
  let match;

  while ((match = responsePattern.exec(content)) !== null) {
    const statusCode = match[1];
    if (!responses.includes(statusCode)) {
      responses.push(statusCode);
    }
  }

  // Also check for error responses with status codes
  const errorPattern = /(?:return|Response)\s*\([^,]*,\s*\{\s*status:\s*(\d+)\s*\}/g;
  while ((match = errorPattern.exec(content)) !== null) {
    const statusCode = match[1];
    if (!responses.includes(statusCode)) {
      responses.push(statusCode);
    }
  }

  // Check for explicit status code returns in error helpers
  const apiErrorPattern = /apiError\([^,]+,[^,]+,\s*(\d+)\)/g;
  while ((match = apiErrorPattern.exec(content)) !== null) {
    const statusCode = match[1];
    if (!responses.includes(statusCode)) {
      responses.push(statusCode);
    }
  }

  // Check for redirects (302)
  if (content.includes("NextResponse.redirect")) {
    if (!responses.includes("302")) {
      responses.push("302");
    }
  }

  return responses.sort((a, b) => parseInt(a) - parseInt(b));
}

/**
 * Parse openapi.yaml and extract documented paths with their methods and response codes.
 * Returns array of { path, methods, responseCodes }
 *
 * This is a simple YAML parser that assumes the structure:
 * paths:
 *   /api/wrapped:
 *     get:
 *       responses:
 *         "200":
 *         "400":
 */
function parseOpenApiPaths() {
  if (!fs.existsSync(openapiFile)) {
    throw new Error(`openapi.yaml not found at ${openapiFile}`);
  }

  const content = fs.readFileSync(openapiFile, "utf8");
  const paths = [];
  let currentPath = null;
  let currentMethod = null;
  let currentMethods = [];
  let methodResponseCodes = {};

  const lines = content.split("\n");
  let inPaths = false;
  let inResponses = false;

  for (const line of lines) {
    // Detect the paths section
    if (line.match(/^paths:\s*$/)) {
      inPaths = true;
      continue;
    }

    // Exit paths section when we hit a non-indented line
    if (inPaths && line.match(/^[a-z]/)) {
      inPaths = false;
    }

    if (!inPaths) continue;

    // Path definition: starts with two spaces and a slash
    const pathMatch = line.match(/^  (\/[^:]+):\s*$/);
    if (pathMatch) {
      if (currentPath) {
        // Collect all unique response codes across all methods
        const allResponseCodes = Object.values(methodResponseCodes).flat();
        const uniqueResponseCodes = [...new Set(allResponseCodes)].sort((a, b) => parseInt(a) - parseInt(b));
        paths.push({ path: currentPath, methods: currentMethods.sort(), responseCodes: uniqueResponseCodes });
      }
      currentPath = pathMatch[1];
      currentMethods = [];
      methodResponseCodes = {};
      currentMethod = null;
      inResponses = false;
      continue;
    }

    // Method definition: starts with four spaces and a method name
    const methodMatch = line.match(/^    (get|post|put|patch|delete|head|options):/);
    if (methodMatch && currentPath) {
      currentMethod = methodMatch[1];
      currentMethods.push(currentMethod);
      methodResponseCodes[currentMethod] = [];
      inResponses = false;
      continue;
    }

    // Responses section within a method
    const responsesMatch = line.match(/^      responses:\s*$/);
    if (responsesMatch && currentMethod) {
      inResponses = true;
      continue;
    }

    // Response code definition
    const responseCodeMatch = line.match(/^        ["']?(\d+)["']?:/);
    if (responseCodeMatch && inResponses && currentMethod) {
      const code = responseCodeMatch[1];
      if (!methodResponseCodes[currentMethod].includes(code)) {
        methodResponseCodes[currentMethod].push(code);
      }
    }
  }

  // Don't forget the last path
  if (currentPath) {
    const allResponseCodes = Object.values(methodResponseCodes).flat();
    const uniqueResponseCodes = [...new Set(allResponseCodes)].sort((a, b) => parseInt(a) - parseInt(b));
    paths.push({ path: currentPath, methods: currentMethods.sort(), responseCodes: uniqueResponseCodes });
  }

  return paths;
}

/**
 * Compare two sets of paths and report differences.
 */
function validatePaths(actualRoutes, documentedPaths) {
  let hasErrors = false;

  // Build lookup maps
  const actualMap = new Map(actualRoutes.map((r) => [r.path, r]));
  const documentedMap = new Map(documentedPaths.map((p) => [p.path, p]));

  // Check for routes that exist but are not documented
  for (const route of actualRoutes) {
    if (!documentedMap.has(route.path)) {
      hasErrors = true;
      log(`  Route exists but not documented: ${route.path}`, colors.red);
      log(`    File: ${route.file}`, colors.dim);
      log(`    Methods: ${route.methods.join(", ")}`, colors.dim);
    }
  }

  // Check for documented paths that don't have handlers
  for (const docPath of documentedPaths) {
    if (!actualMap.has(docPath.path)) {
      hasErrors = true;
      log(`  Path documented but route not found: ${docPath.path}`, colors.yellow);
      log(`    Documented methods: ${docPath.methods.join(", ")}`, colors.dim);
    }
  }

  // Check for method mismatches
  for (const route of actualRoutes) {
    const documented = documentedMap.get(route.path);
    if (!documented) continue;

    const actualMethods = new Set(route.methods);
    const documentedMethods = new Set(documented.methods);

    const missingInDoc = route.methods.filter((m) => !documentedMethods.has(m));
    const extraInDoc = documented.methods.filter((m) => !actualMethods.has(m));

    if (missingInDoc.length > 0 || extraInDoc.length > 0) {
      hasErrors = true;
      log(`  Method mismatch for ${route.path}:`, colors.yellow);
      if (missingInDoc.length > 0) {
        log(`    Methods in code but not documented: ${missingInDoc.join(", ")}`, colors.red);
      }
      if (extraInDoc.length > 0) {
        log(`    Methods documented but not in code: ${extraInDoc.join(", ")}`, colors.yellow);
      }
      log(`    File: ${route.file}`, colors.dim);
    }
  }

  // Check for response code mismatches (warnings only, not errors)
  log("");
  log("Checking response codes (informational)...", colors.dim);
  for (const route of actualRoutes) {
    const documented = documentedMap.get(route.path);
    if (!documented) continue;

    const actualCodes = new Set(route.responseCodes);
    const documentedCodes = new Set(documented.responseCodes);

    const missingInDoc = route.responseCodes.filter((c) => !documentedCodes.has(c));
    const extraInDoc = documented.responseCodes.filter((c) => !actualCodes.has(c));

    if (missingInDoc.length > 0 || extraInDoc.length > 0) {
      log(`  Response code differences for ${route.path}:`, colors.yellow);
      if (missingInDoc.length > 0) {
        log(`    Codes in code but not documented: ${missingInDoc.join(", ")}`, colors.yellow);
      }
      if (extraInDoc.length > 0) {
        log(`    Codes documented but not found in code: ${extraInDoc.join(", ")}`, colors.dim);
      }
    }
  }

  return hasErrors;
}

function main() {
  log("Validating OpenAPI specification against route handlers...", colors.blue);
  log("");

  let actualRoutes;
  let documentedPaths;

  try {
    actualRoutes = findRouteHandlers(apiDir);
  } catch (error) {
    fail(`Failed to scan route handlers: ${error.message}`);
    return 2;
  }

  try {
    documentedPaths = parseOpenApiPaths();
  } catch (error) {
    fail(`Failed to parse openapi.yaml: ${error.message}`);
    return 2;
  }

  log(`Found ${actualRoutes.length} route handlers in app/api`, colors.dim);
  log(`Found ${documentedPaths.length} paths in openapi.yaml`, colors.dim);
  log("");

  const hasErrors = validatePaths(actualRoutes, documentedPaths);

  if (hasErrors) {
    log("");
    fail(
      "OpenAPI spec is out of sync with route handlers. " +
        "Update openapi.yaml to document all routes, or remove documented paths that no longer exist."
    );
    return 1;
  }

  log("✓ OpenAPI spec matches route handlers", colors.green);
  return 0;
}

process.exit(main());
