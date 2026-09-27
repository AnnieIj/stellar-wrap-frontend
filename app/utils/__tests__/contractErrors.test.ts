/**
 * Unit tests for Soroban contract error → friendly UI mapping
 *
 * Run with: npx tsx app/utils/__tests__/contractErrors.test.ts
 */

import {
  extractContractErrorCode,
  mapContractError,
  getContractErrorUserMessage,
  SorobanContractErrorCode,
} from "../contractErrors";

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

section("extractContractErrorCode");
{
  assert(
    extractContractErrorCode("HostError: Error(Contract, #4)") === 4,
    "parses Error(Contract, #4)",
  );
  assert(
    extractContractErrorCode("Error(Contract, #6)") === 6,
    "parses Error(Contract, #6)",
  );
  assert(
    extractContractErrorCode("network timeout") === undefined,
    "returns undefined when no code present",
  );
}

section("mapContractError — WrapAlreadyExists");
{
  const mapped = mapContractError(new Error("HostError: Error(Contract, #4)"));
  assert(mapped.code === "WrapAlreadyExists", "code is WrapAlreadyExists");
  assert(
    mapped.numericCode === SorobanContractErrorCode.WrapAlreadyExists,
    "numeric code is 4",
  );
  assert(/already minted/i.test(mapped.userMessage), "friendly duplicate-wrap message");
  assert(mapped.raw.includes("#4"), "raw details preserved");
}

section("mapContractError — InvalidSignature");
{
  const mapped = mapContractError("simulation failed: Error(Contract, #6)");
  assert(mapped.code === "InvalidSignature", "code is InvalidSignature");
  assert(/signature/i.test(mapped.userMessage), "friendly signature message");
  assert(mapped.raw.includes("#6"), "raw details preserved");
}

section("mapContractError — unknown host error");
{
  const mapped = mapContractError(new Error("HostError: weird trap"));
  assert(mapped.code === "Unknown", "unknown code");
  assert(/try again/i.test(mapped.userMessage), "safe fallback message");
  assert(mapped.raw === "HostError: weird trap", "raw message kept for diagnostics");
}

section("getContractErrorUserMessage");
{
  assert(
    /opted out/i.test(
      getContractErrorUserMessage(new Error("Error(Contract, #8)")),
    ),
    "returns concise UI string for opted-out",
  );
}

console.log("\n══════════════════════════════════════════════════════");
console.log(`  Results:  ${passed} passed, ${failed} failed`);
console.log("══════════════════════════════════════════════════════");

if (failures.length > 0) {
  console.log("\nFailed tests:");
  failures.forEach((f) => console.log(`  ✗ ${f}`));
}

process.exit(failed > 0 ? 1 : 0);
