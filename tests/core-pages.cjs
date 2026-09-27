// Regression checks for visitor-visible project and publication loading.
// Supply Playwright via NODE_PATH and optionally CHROMIUM_PATH; start a local
// server first (BASE_URL defaults to http://127.0.0.1:8765).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:8765';
let browser;
before(async () => {
  browser = await chromium.launch({ headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
});
after(async () => { await browser?.close(); });
async function pageFor(t) {
  const page = await browser.newPage();
  t.after(() => page.close());
  // External font, Markdown CDN and ORCID availability must not decide these tests.
  await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin
    ? route.continue() : route.abort());
  return page;
}
async function loadedProject(page, id) {
  await page.goto(`${base}/project-detail.html?id=${id}`);
  await page.waitForFunction(() => !document.querySelector('#project-title').textContent.toLowerCase().includes('loading'));
}
test('deferred project URLs do not expose a coming-soon page', async t => {
  const page = await pageFor(t);
  await loadedProject(page, 'noisy-grt');
  assert.match(await page.locator('#project-title').innerText(), /not found|unavailable/i);
  assert.doesNotMatch(await page.locator('#project-content').innerText(), /coming soon/i);
});
test('an under-review project displays its related preprint', async t => {
  const page = await pageFor(t);
  await loadedProject(page, 'confidnet');
  await page.waitForSelector('#project-publications .pub-entry', { timeout: 2000 });
  assert.match(await page.locator('#project-publications').innerText(), /Machine metacognition improves classification/);
  assert.equal(await page.locator('#project-publications a.doi-link').getAttribute('href'), 'https://doi.org/10.31234/osf.io/jp83f_v1');
});
test('missing project content fails visibly instead of displaying a placeholder', async t => {
  const page = await pageFor(t);
  await page.route('**/data/projects/grin/content.md', route => route.fulfill({ status: 404, body: 'missing' }));
  await loadedProject(page, 'grin');
  assert.match(await page.locator('#project-title').innerText(), /not found|unavailable/i);
  assert.doesNotMatch(await page.locator('#project-content').innerText(), /coming soon/i);
});
test('curated CV publications remain visible when ORCID is unavailable', async t => {
  const page = await pageFor(t);
  await page.goto(`${base}/cv.html`);
  await page.waitForSelector('#cv-under-review-pubs .pub-entry');
  assert.equal(await page.locator('#cv-under-review-pubs .pub-entry').count(), 4);
  assert.match(await page.locator('#cv-journal-pubs').innerText(), /In Press/);
});
test('the not-found page fits a narrow mobile screen', async t => {
  const page = await pageFor(t);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/404.html`);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '404 page must not overflow horizontally');
  assert.equal(await page.getByRole('link', { name: 'Go to Homepage' }).getAttribute('href'), 'index.html');
});
test('ORCID maintenance information stays out of the visitor CV', async t => {
  const page = await pageFor(t);
  await page.route('https://pub.orcid.org/**', route => route.fulfill({ json: {
    group: [{ 'work-summary': [{ 'put-code': 999, title: { title: { value: 'Uncurated example work' } } }] }]
  } }));
  await page.goto(`${base}/cv.html`);
  await page.waitForSelector('#cv-journal-pubs .pub-entry');
  assert.doesNotMatch(await page.locator('body').innerText(), /publications\.json|Uncurated example work/);
});
