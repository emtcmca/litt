import type { Page } from '@playwright/test';
import brief from '../../src/demo-fixtures/brief.json';
import sweep from '../../src/demo-fixtures/sweep.json';
import tools from '../../src/demo-fixtures/tools.json';
import deadlines from '../../src/demo-fixtures/deadlines.json';
import inbound from '../../src/demo-fixtures/inbound.json';
import commitments from '../../src/demo-fixtures/commitments.json';
import relationships from '../../src/demo-fixtures/relationships.json';
import budgets from '../../src/demo-fixtures/budgets.json';
import auditLog from '../../src/demo-fixtures/audit-log.json';

export async function mockAllApis(page: Page) {
  const json = (data: unknown) => (r: Parameters<Parameters<Page['route']>[1]>[0]) => r.fulfill({ json: data });
  await page.route('**/api/brief*',         json(brief));
  await page.route('**/api/sweep*',         json({ timeline: { observations: sweep }, brief }));
  await page.route('**/api/tools*',         json(tools));
  await page.route('**/api/deadlines*',     json(deadlines));
  await page.route('**/api/inbound*',       json(inbound));
  await page.route('**/api/commitments*',   json(commitments));
  await page.route('**/api/relationships*', json(relationships));
  await page.route('**/api/budgets*',       json(budgets));
  await page.route('**/api/audit-log*',     json(auditLog));
}
