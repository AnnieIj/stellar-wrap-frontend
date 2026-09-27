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

function parseSizeLimitOutput(output) {
  const matches = [...output.matchAll(/([\w-]+)\s+([0-9.]+)\s+KB/g)];

  const parsed = {};
  for (const match of matches) {
    const [, name, size] = match;
    parsed[name] = Number(size) * 1024;
  }

  return parsed;
}

function ensureBudgetFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '{}\n');
  }
}

function readExistingBudgets(filePath) {
  ensureBudgetFile(filePath);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeBudgetReport(outputPath, results) {
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
}

function main() {
  const reportPath = process.env.SIZE_LIMIT_REPORT || path.join(process.cwd(), '.size-limit.json');
  const budgetsPath = path.join(process.cwd(), '.size-limit.json');

  if (!fs.existsSync(reportPath)) {
    console.error('No size-limit report found. Run `npm run build:size-limit` first.');
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const budgets = readExistingBudgets(budgetsPath);

  const entries = Object.entries(budgets).map(([name, budgetBytes]) => {
    const actualBytes = report[name] || 0;
    return evaluateBudget({
      name,
      actualBytes,
      budgetBytes,
    });
  });

  const exceeded = entries.filter((entry) => entry.status === 'exceeded');

  for (const entry of entries) {
    const symbol = entry.status === 'exceeded' ? '❌' : '✅';
    console.log(`${symbol} ${entry.name}: ${formatBytes(entry.actualBytes)} (budget ${formatBytes(entry.budgetBytes)}, delta ${entry.deltaLabel})`);
  }

  writeBudgetReport(path.join(process.cwd(), '.size-limit-results.json'), entries);

  if (exceeded.length > 0) {
    console.error('\nBundle size budgets exceeded.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  evaluateBudget,
  parseSizeLimitOutput,
  formatBytes,
};
