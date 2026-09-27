import { evaluateBudget } from '../scripts/bundle-budget.mjs';

describe('evaluateBudget', () => {
  it('marks budgets as exceeded and reports the delta', () => {
    const result = evaluateBudget({
      name: 'landing',
      actualBytes: 180 * 1024,
      budgetBytes: 150 * 1024,
    });

    expect(result.name).toBe('landing');
    expect(result.status).toBe('exceeded');
    expect(result.deltaBytes).toBe(30 * 1024);
    expect(result.deltaLabel).toBe('+30.0 KB');
  });

  it('marks budgets as within limit when the bundle stays below the threshold', () => {
    const result = evaluateBudget({
      name: 'share',
      actualBytes: 120 * 1024,
      budgetBytes: 150 * 1024,
    });

    expect(result.status).toBe('within-budget');
    expect(result.deltaBytes).toBe(-30 * 1024);
    expect(result.deltaLabel).toBe('-30.0 KB');
  });
});
