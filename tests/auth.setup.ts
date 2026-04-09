import { test as setup } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const SUBSIDIARY = process.env.SUBSIDIARY ?? 'XGT';
const LANGUAGE   = process.env.LANGUAGE   ?? 'es';
const EMAIL      = process.env.EMAIL      ?? 'xgtwebdemo2@yopmail.com';
const PASSWORD   = process.env.PASSWORD   ?? 'Password01**';
const BASE_URL   = `https://myservices.intcomex.com/${LANGUAGE}/${SUBSIDIARY}`;

const AUTH_FILE    = path.join(__dirname, '../.auth/session.json');
const METRICS_FILE = path.join(__dirname, '../metrics.ndjson');

const TIMEOUT_NAV     = Number.parseInt(process.env.TIMEOUT_NAV     ?? '120000');
const TIMEOUT_ELEMENT = Number.parseInt(process.env.TIMEOUT_ELEMENT ?? '120000');

setup('login', async ({ page }) => {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  if (fs.existsSync(METRICS_FILE)) fs.unlinkSync(METRICS_FILE);

  const t0 = Date.now();
  await page.goto(`${BASE_URL}/store`, { timeout: TIMEOUT_NAV });
  await page.locator('.userbutton button').waitFor({ state: 'visible', timeout: TIMEOUT_ELEMENT });
  await page.locator('.userbutton button').click();
  await page.locator('#email').waitFor({ state: 'visible', timeout: TIMEOUT_ELEMENT });
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('#next').click();
  await page.waitForURL(`**/${LANGUAGE}/${SUBSIDIARY}/**`, { timeout: TIMEOUT_NAV });

  await page.context().storageState({ path: AUTH_FILE });
  console.log(`[setup] Login completado en ${Date.now() - t0}ms`);
});
