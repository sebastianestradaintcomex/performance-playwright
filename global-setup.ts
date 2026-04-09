import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const SUBSIDIARY   = process.env.SUBSIDIARY ?? 'XGT';
const LANGUAGE     = process.env.LANGUAGE   ?? 'es';
const EMAIL        = process.env.EMAIL      ?? 'xgtwebdemo2@yopmail.com';
const PASSWORD     = process.env.PASSWORD   ?? 'Password01**';
const BASE_URL     = `https://myservices.intcomex.com/${LANGUAGE}/${SUBSIDIARY}`;
export const AUTH_FILE = path.join(__dirname, '.auth/session.json');

const TIMEOUT_NAV     = Number.parseInt(process.env.TIMEOUT_NAV     ?? '120000');
const TIMEOUT_ELEMENT = Number.parseInt(process.env.TIMEOUT_ELEMENT ?? '120000');

export default async function globalSetup() {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  // Limpiar métricas anteriores al inicio de una nueva corrida
  const metricsFile = path.join(__dirname, 'metrics.ndjson');
  if (fs.existsSync(metricsFile)) fs.unlinkSync(metricsFile);

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page    = await context.newPage();

  const t0 = Date.now();
  await page.goto(`${BASE_URL}/store`, { timeout: TIMEOUT_NAV });

  const loginButton = page.locator('.userbutton button');
  await loginButton.waitFor({ state: 'visible', timeout: TIMEOUT_ELEMENT });
  await loginButton.click();

  await page.locator('#email').waitFor({ state: 'visible', timeout: TIMEOUT_ELEMENT });
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('#next').click();

  await page.waitForURL(`**/${LANGUAGE}/${SUBSIDIARY}/**`, { timeout: TIMEOUT_NAV });

  await context.storageState({ path: AUTH_FILE });
  await browser.close();

  console.log(`[setup] Login completado en ${Date.now() - t0}ms — sesión guardada`);
}
