#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateBudget } from './bundle-budget.mjs';

function main() {
  const reportPath = path.join(process.cwd(), '.size-limit-report.json');
  const budgetsPath = path.join(process.cwd(), '.size-limit.json');

  if (!fs.existsSync(reportPath)) {
    console.error('No bundle-size report found. Run `npm run build:size-limit` first.');
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const budgets = JSON.parse(fs.readFileSync(budgetsPath, 'utf8'));

  const entries = Object.entries(budgets).map(([name, budgetBytes]) => {
    const actualBytes = report[name] ?? 0;
    return evaluateBudget({ name, actualBytes, budgetBytes });
  });

  for (const entry of entries) {
    const symbol = entry.status === 'exceeded' ? '❌' : '✅';
    console.log(`${symbol} ${entry.name}: ${entry.deltaLabel} (${(entry.actualBytes / 1024).toFixed(1)} KB / ${(entry.budgetBytes / 1024).toFixed(1)} KB)`);
  }

  const exceeded = entries.filter((entry) => entry.status === 'exceeded');
  fs.writeFileSync(path.join(process.cwd(), '.size-limit-results.json'), JSON.stringify(entries, null, 2));

  if (exceeded.length > 0) {
    console.error('\nBundle size budgets exceeded.');
    process.exit(1);
  }
}

main();
