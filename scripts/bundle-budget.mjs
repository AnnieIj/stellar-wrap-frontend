#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function evaluateBudget({ name, actualBytes, budgetBytes }) {
  const deltaBytes = actualBytes - budgetBytes;
  const status = deltaBytes > 0 ? 'exceeded' : 'within-budget';

  return {
    name,
    actualBytes,
    budgetBytes,
    deltaBytes,
    deltaLabel: deltaBytes >= 0 ? `+${formatBytes(deltaBytes)}` : `-${formatBytes(Math.abs(deltaBytes))}`,
    status,
  };
}

function main() {
  const reportPath = process.env.SIZE_LIMIT_REPORT || path.join(process.cwd(), '.size-limit.json');
  const budgetsPath = path.join(process.cwd(), '.size-limit.json');

  if (!fs.existsSync(reportPath)) {
    console.error('No size-limit report found. Run `npm run build:size-limit` first.');
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const budgets = JSON.parse(fs.readFileSync(budgetsPath, 'utf8'));

  const entries = Object.entries(budgets).map(([name, budgetBytes]) => evaluateBudget({
    name,
    actualBytes: report[name] || 0,
    budgetBytes,
  }));

  const exceeded = entries.filter((entry) => entry.status === 'exceeded');

  for (const entry of entries) {
    const symbol = entry.status === 'exceeded' ? '❌' : '✅';
    console.log(`${symbol} ${entry.name}: ${entry.deltaLabel} (${(entry.actualBytes / 1024).toFixed(1)} KB / ${(entry.budgetBytes / 1024).toFixed(1)} KB)`);
  }

  fs.writeFileSync(path.join(process.cwd(), '.size-limit-results.json'), JSON.stringify(entries, null, 2));

  if (exceeded.length > 0) {
    console.error('\nBundle size budgets exceeded.');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { evaluateBudget, formatBytes };
