import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createDatabase, createServer, initializeDatabase } from '../server/index.js';

const db = createDatabase(':memory:');
initializeDatabase(db);
const server = createServer(db);
let baseUrl;

before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  db.close();
});

test('health endpoint confirms API and SQLite availability', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', database: 'sqlite' });
});

test('dashboard returns metrics, a complete daily series and resolved type ranking', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 59 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const response = await fetch(`${baseUrl}/api/dashboard?from=${from}&to=${today}`);
  assert.equal(response.status, 200);
  const data = await response.json();

  assert.equal(data.summary.total, 60);
  assert.equal(data.summary.resolved, 30);
  assert.equal(data.statusBreakdown.reduce((sum, item) => sum + item.total, 0), 60);
  assert.equal(data.dailyResolution.length, 60);
  assert.equal(data.period.to, today);
  assert.ok(data.resolvedByType.length > 0);
  assert.equal(data.latestTickets.length, 8);
});

test('dashboard filters are applied and invalid date ranges are rejected', async () => {
  const response = await fetch(`${baseUrl}/api/dashboard?from=2020-01-01&to=2020-01-31&type=Hardware&status=aberto`);
  assert.equal(response.status, 200);
  const empty = await response.json();
  assert.equal(empty.summary.total, 0);
  assert.equal(empty.dailyResolution.length, 31);

  const invalid = await fetch(`${baseUrl}/api/dashboard?from=2026-02-30&to=2026-03-01`);
  assert.equal(invalid.status, 400);
  assert.match((await invalid.json()).error, /data válida/);
});

test('tickets endpoint returns filtered ticket records', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const response = await fetch(`${baseUrl}/api/tickets?from=${today}&to=${today}&status=aberto`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(data.items.every((ticket) => ticket.status === 'aberto'));
  assert.ok(data.items.length <= 100);
});
