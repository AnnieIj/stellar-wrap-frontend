/**
 * Unit tests for /api/wrapped safe error responses
 *
 * Run with: npx tsx app/api/wrapped/__tests__/route.errors.test.ts
 *
 * Verifies that internal error details are not returned to clients
 * and structured diagnostic codes are preserved.
 */

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(message);
    console.error(`  ✗ ${message}`);
  }
}

function section(name: string): void {
  console.log(`\n▸ ${name}`);
}

/** Mirrors the safe payload shape from app/api/wrapped/route.ts */
function buildSafeErrorPayload(
  error: unknown,
): { status: number; body: { error: string; code: string; details?: string } } {
  const err = error as Record<string, unknown>;
  const message = (err?.message as string) || "";
  const statusCode = err?.statusCode as number | undefined;

  if (
    message.includes("Not Found") ||
    message.includes("not found") ||
    statusCode === 404
  ) {
    return {
      status: 404,
      body: {
        error:
          "Account not found on this network. Make sure you selected the correct network (mainnet/testnet) where the account exists.",
        code: "ACCOUNT_NOT_FOUND",
      },
    };
  }

  if (statusCode === 429) {
    return {
      status: 429,
      body: { error: "Rate limited. Please try again later.", code: "RATE_LIMITED" },
    };
  }

  if (statusCode === 500) {
    return {
      status: 500,
      body: { error: "Horizon server error", code: "HORIZON_ERROR" },
    };
  }

  if (message.includes("Bad Request") || statusCode === 400) {
    return {
      status: 400,
      body: { error: "Bad request to Horizon API", code: "BAD_REQUEST" },
    };
  }

  return {
    status: 500,
    body: {
      error: "Failed to fetch wrapped data. Please try again later.",
      code: "WRAPPED_FETCH_FAILED",
    },
  };
}

section("does not leak internal error details on generic 500");
{
  const internal = new Error(
    "ECONNREFUSED 127.0.0.1:5432 password=super-secret stack at indexer.ts:42",
  );
  const payload = buildSafeErrorPayload(internal);

  assert(payload.status === 500, "status is 500");
  assert(payload.body.code === "WRAPPED_FETCH_FAILED", "structured code present");
  assert(
    !JSON.stringify(payload.body).includes("ECONNREFUSED"),
    "does not include connection internals",
  );
  assert(
    !JSON.stringify(payload.body).includes("password="),
    "does not include secret-like internals",
  );
  assert(
    !("details" in payload.body),
    "details field is omitted from client payload",
  );
  assert(
    /try again/i.test(payload.body.error),
    "safe user-facing message returned",
  );
}

section("preserves structured codes for known failures");
{
  const notFound = buildSafeErrorPayload({
    message: "Account Not Found",
    statusCode: 404,
  });
  assert(notFound.body.code === "ACCOUNT_NOT_FOUND", "404 → ACCOUNT_NOT_FOUND");

  const rateLimited = buildSafeErrorPayload({ statusCode: 429, message: "Too Many" });
  assert(rateLimited.body.code === "RATE_LIMITED", "429 → RATE_LIMITED");

  const horizon = buildSafeErrorPayload({ statusCode: 500, message: "boom" });
  assert(horizon.body.code === "HORIZON_ERROR", "upstream 500 → HORIZON_ERROR");
}

console.log("\n══════════════════════════════════════════════════════");
console.log(`  Results:  ${passed} passed, ${failed} failed`);
console.log("══════════════════════════════════════════════════════");

if (failures.length > 0) {
  console.log("\nFailed tests:");
  failures.forEach((f) => console.log(`  ✗ ${f}`));
}

process.exit(failed > 0 ? 1 : 0);
