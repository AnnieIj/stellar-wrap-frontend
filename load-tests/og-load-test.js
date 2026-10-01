#!/usr/bin/env node
/**
 * Load test for /api/og (share card generation)
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 node load-tests/og-load-test.js
 *
 * Requires: npm install -g autocannon   OR   npx autocannon (no install)
 *
 * Scenarios tested:
 *   - 10 concurrent connections (light load)
 *   - 50 concurrent connections (moderate load)
 *   - 100 concurrent connections (heavy load)
 *
 * Baseline targets:
 *   - p95 response time < 2 000 ms
 *   - Error rate < 1 %
 */

const autocannon = require("autocannon");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

/** Canonical OG endpoint URL with representative params */
const OG_PATH =
  "/api/og?username=TestUser&transactions=42&persona=The+Wizard&topVibe=Steady&vibePercentage=75";

const SCENARIOS = [
  { connections: 10, label: "Light (10 concurrent)" },
  { connections: 50, label: "Moderate (50 concurrent)" },
  { connections: 100, label: "Heavy (100 concurrent)" },
];

/** p95 threshold in milliseconds */
const P95_TARGET_MS = 2000;

async function runScenario({ connections, label }) {
  return new Promise((resolve) => {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Scenario: ${label}`);
    console.log(`Target:   ${BASE_URL}${OG_PATH}`);
    console.log("=".repeat(60));

    const instance = autocannon(
      {
        url: `${BASE_URL}${OG_PATH}`,
        connections,
        duration: 15, // seconds
        timeout: 10,  // per-request timeout in seconds
        headers: {
          accept: "image/png",
        },
      },
      (err, result) => {
        if (err) {
          console.error("autocannon error:", err.message);
          resolve({ label, passed: false, error: err.message });
          return;
        }

        const p95 = result.latency.p97_5 ?? result.latency["97.5"] ?? result.latency.max;
        const totalRequests = result.requests.total;
        const errors = result.errors + result["2xx"] === 0 ? totalRequests : result.errors;
        const non2xxErrors =
          totalRequests - (result["2xx"] || result.requests.sent - result.errors);
        const errorRate =
          totalRequests > 0 ? (non2xxErrors / totalRequests) * 100 : 0;

        const p95Pass = p95 < P95_TARGET_MS;

        console.log(`\nResults:`);
        console.log(`  Total requests : ${totalRequests}`);
        console.log(`  Req/sec        : ${result.requests.mean.toFixed(1)}`);
        console.log(`  Latency p50    : ${result.latency.p50} ms`);
        console.log(`  Latency p90    : ${result.latency.p90} ms`);
        console.log(`  Latency p97.5  : ${p95} ms  ${p95Pass ? "✅ PASS" : "❌ FAIL (> 2 000 ms)"}`);
        console.log(`  Latency max    : ${result.latency.max} ms`);
        console.log(`  2xx responses  : ${result["2xx"] ?? "n/a"}`);
        console.log(`  Timeouts       : ${result.timeouts}`);
        console.log(`  Errors         : ${result.errors}`);
        console.log(
          `  Error rate     : ${errorRate.toFixed(2)}%  ${errorRate < 1 ? "✅ PASS" : "❌ FAIL (> 1%)"}`
        );

        resolve({
          label,
          connections,
          p95,
          p95Pass,
          errorRate,
          totalRequests,
          reqPerSec: result.requests.mean,
        });
      }
    );

    autocannon.track(instance, { renderProgressBar: true });
  });
}

async function main() {
  console.log("🚀 Stellar Wrap — /api/og Load Test");
  console.log(`   Target base URL : ${BASE_URL}`);
  console.log(`   p95 target      : < ${P95_TARGET_MS} ms`);
  console.log(`   Error rate goal : < 1%`);

  const results = [];
  for (const scenario of SCENARIOS) {
    const r = await runScenario(scenario);
    results.push(r);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("SUMMARY");
  console.log("=".repeat(60));
  let allPassed = true;
  for (const r of results) {
    if (r.error) {
      console.log(`❌ ${r.label}: ERROR — ${r.error}`);
      allPassed = false;
    } else {
      const status = r.p95Pass && r.errorRate < 1 ? "✅ PASS" : "❌ FAIL";
      if (status.includes("FAIL")) allPassed = false;
      console.log(
        `${status}  ${r.label}: p95=${r.p95}ms, errors=${r.errorRate.toFixed(2)}%, rps=${r.reqPerSec.toFixed(1)}`
      );
    }
  }
  console.log("=".repeat(60));

  if (!allPassed) {
    console.log("\n⚠️  Some scenarios failed. See PERFORMANCE.md for remediation steps.");
    process.exit(1);
  } else {
    console.log("\n✅ All scenarios within baseline targets.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
