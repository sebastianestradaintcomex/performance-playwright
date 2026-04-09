'use strict';

const SUBSIDIARY = process.env.SUBSIDIARY ?? 'XGT';
const LANGUAGE = process.env.LANGUAGE ?? 'es';
const EMAIL = process.env.EMAIL ?? 'xgtwebdemo2@yopmail.com';
const PASSWORD = process.env.PASSWORD ?? 'Password01**';
const CATEGORY = process.env.CATEGORY ?? 'cac_cable';
const BASE_URL = `https://myservices.intcomex.com/${LANGUAGE}/${SUBSIDIARY}`;

const TIMEOUT_NAV = 1200000; // navegación de página
const TIMEOUT_ELEMENT = 1200000;  // espera de elementos
const TIMEOUT_REQUESTS = 1200000;  // espera de API requests

function trackRequests(page, pattern) {
  const pending = new Map();
  const results = [];
  let started = false;

  page.on('request', req => {
    if (req.url().includes(pattern)) {
      pending.set(req.url(), Date.now());
      started = true;
    }
  });
  page.on('response', resp => {
    if (resp.url().includes(pattern)) {
      const startTime = pending.get(resp.url()) ?? Date.now();
      results.push({ url: resp.url(), status: resp.status(), durationMs: Date.now() - startTime });
      pending.delete(resp.url());
    }
  });
  page.on('requestfailed', req => {
    if (req.url().includes(pattern)) pending.delete(req.url());
  });

  return async (timeout = TIMEOUT_REQUESTS) => {
    const deadline = Date.now() + timeout;
    while (!started && Date.now() < deadline) await page.waitForTimeout(100);
    while (pending.size > 0 && Date.now() < deadline) await page.waitForTimeout(100);
    return results;
  };
}

async function storeFlow(page, userContext, events) {
  // ── Login ──────────────────────────────────────────────
  const startLogin = Date.now();
  await page.goto(`${BASE_URL}/store`, { timeout: TIMEOUT_NAV });

  const loginButton = page.locator('.userbutton button');
  await loginButton.waitFor({ state: 'visible', timeout: TIMEOUT_ELEMENT });
  events.emit('histogram', 'login.boton_visible_ms', Date.now() - startLogin);

  await loginButton.click();

  await page.locator('#email').waitFor({ state: 'visible', timeout: TIMEOUT_ELEMENT });
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);

  const startAuth = Date.now();
  await page.locator('#next').click();
  await page.waitForURL(`**/${LANGUAGE}/${SUBSIDIARY}/**`, { timeout: TIMEOUT_NAV });
  events.emit('histogram', 'login.redirect_ms', Date.now() - startAuth);
  events.emit('histogram', 'login.total_ms', Date.now() - startLogin);

  // ── Store ──────────────────────────────────────────────
  const waitFooter = trackRequests(page, 'get-footer-data');
  const waitHomeData = trackRequests(page, 'get-home-data');

  const startStore = Date.now();
  await page.goto(`${BASE_URL}/store`, { timeout: TIMEOUT_NAV });
  await Promise.all([waitFooter(), waitHomeData()]);
  events.emit('histogram', 'store.load_ms', Date.now() - startStore);

  // ── Categoría ──────────────────────────────────────────
  const waitFooter2 = trackRequests(page, 'get-footer-data');
  const waitProducts = trackRequests(page, 'get-products');
  const waitMenu = trackRequests(page, 'get-menu');

  const startCat = Date.now();
  await page.goto(`${BASE_URL}/store/${CATEGORY}`, { timeout: TIMEOUT_NAV });
  await Promise.all([waitFooter2(), waitProducts(), waitMenu()]);

  const startRender = Date.now();
  await page.locator('.ecommproductcard').first().waitFor({ state: 'visible', timeout: TIMEOUT_ELEMENT });
  events.emit('histogram', 'categoria.render_ms', Date.now() - startRender);
  events.emit('histogram', 'categoria.load_ms', Date.now() - startCat);
}

module.exports = { storeFlow };
