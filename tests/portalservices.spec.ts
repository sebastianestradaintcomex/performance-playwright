import { test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SUBSIDIARY = process.env.SUBSIDIARY ?? 'XGT';
const LANGUAGE   = process.env.LANGUAGE   ?? 'es';
const CATEGORY   = process.env.CATEGORY   ?? 'cac_cable';

const BASE_URL = `https://myservices.intcomex.com/${LANGUAGE}/${SUBSIDIARY}`;

const TIMEOUT_NAV      = Number.parseInt(process.env.TIMEOUT_NAV      ?? '120000');
const TIMEOUT_REQUESTS = Number.parseInt(process.env.TIMEOUT_REQUESTS ?? '120000');

const METRICS_FILE = path.join(__dirname, '..', 'metrics.ndjson');

interface RequestInfo { url: string; status: number; durationMs: number; }

function trackRequests(page: Page, pattern: string) {
  const pending = new Map<string, number>();
  const results: RequestInfo[] = [];
  let started = false;

  page.on('request', req => {
    if (req.url().includes(pattern)) { pending.set(req.url(), Date.now()); started = true; }
  });
  page.on('response', async resp => {
    if (resp.url().includes(pattern)) {
      results.push({ url: resp.url(), status: resp.status(), durationMs: Date.now() - (pending.get(resp.url()) ?? Date.now()) });
      pending.delete(resp.url());
    }
  });
  page.on('requestfailed', req => { if (req.url().includes(pattern)) pending.delete(req.url()); });

  return async (): Promise<RequestInfo[]> => {
    const deadline = Date.now() + TIMEOUT_REQUESTS;
    while (!started && Date.now() < deadline) await page.waitForTimeout(100);
    while (pending.size > 0 && Date.now() < deadline) await page.waitForTimeout(100);
    return results;
  };
}

function appendMetric(record: object) {
  fs.appendFileSync(METRICS_FILE, JSON.stringify(record) + '\n');
}

let sharedPage: Page;

test.describe.serial('portal services', () => {
  test.beforeAll(async ({ browser }) => {
    // Carga la sesión guardada por globalSetup — sin login nuevo
    const context = await browser.newContext({ storageState: '.auth/session.json' });
    sharedPage = await context.newPage();
  });

  test.afterAll(async () => {
    await sharedPage.context().close();
  });

  test('store', async () => {
    const waitFooter   = trackRequests(sharedPage, 'get-footer-data');
    const waitHomeData = trackRequests(sharedPage, 'get-home-data');
    const t1 = Date.now();
    await sharedPage.goto(`${BASE_URL}/store`, { timeout: TIMEOUT_NAV });
    const [, homeResults] = await Promise.all([waitFooter(), waitHomeData()]);
    const storeMs = Date.now() - t1;

    console.log(`[store] ${storeMs}ms`);
    console.log('  home-data:', homeResults.map(r => `${new URL(r.url).searchParams.get('type')} → ${r.status} (${r.durationMs}ms)`));

    appendMetric({
      ts: new Date().toISOString(),
      step: 'store',
      totalMs: storeMs,
      requests: homeResults.map(r => ({
        type: new URL(r.url).searchParams.get('type'),
        status: r.status,
        durationMs: r.durationMs,
      })),
    });
  });

  test('categoría', async () => {
    const waitFooter2  = trackRequests(sharedPage, 'get-footer-data');
    const waitProducts = trackRequests(sharedPage, 'get-products');
    const waitMenu     = trackRequests(sharedPage, 'get-menu');
    const t2 = Date.now();
    await sharedPage.goto(`${BASE_URL}/store/${CATEGORY}`, { timeout: TIMEOUT_NAV });
    const [, productResults, menuResults] = await Promise.all([waitFooter2(), waitProducts(), waitMenu()]);
    const catMs = Date.now() - t2;

    console.log(`[categoria] ${catMs}ms`);

    appendMetric({
      ts: new Date().toISOString(),
      step: 'categoria',
      totalMs: catMs,
      requests: [
        ...productResults.map(r => ({ type: 'get-products', status: r.status, durationMs: r.durationMs })),
        ...menuResults.map(r => ({ type: 'get-menu', status: r.status, durationMs: r.durationMs })),
      ],
    });
  });
});
