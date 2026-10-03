// Regression checks for visitor-visible project and publication loading.
// Supply Playwright via NODE_PATH and optionally CHROMIUM_PATH; start a local
// server first, rooted at the BUILD OUTPUT -- `python3 -m http.server 8303
// --directory dist`. These routes (projects/*.html) exist only in dist/, so a
// server on the repo root 404s them. 8303 is this suite's port, deliberately
// not the dock's 8301: that tile serves the repo root, and pointing the tests
// at it would fail against a server that is up. BASE_URL overrides.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:8303';
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
  await page.goto(`${base}/projects/${id}.html`);
}
test('deferred project URLs do not expose a coming-soon page', async t => {
  const page = await pageFor(t);
  await page.goto(`${base}/project-detail.html?id=noisy-grt`);
  assert.match(await page.locator('#legacy-message').innerText(), /not currently available/i);
  assert.equal((await page.request.get(`${base}/projects/noisy-grt.html`)).status(), 404);
});
test('an under-review project displays its related preprint', async t => {
  const page = await pageFor(t);
  await loadedProject(page, 'confidnet');
  await page.waitForSelector('#project-publications .pub-entry', { timeout: 2000 });
  assert.match(await page.locator('#project-publications').innerText(), /Machine metacognition improves classification/);
  assert.equal(await page.locator('#project-publications a.doi-link').getAttribute('href'), 'https://doi.org/10.31234/osf.io/jp83f_v1');
});
test('project narrative is present without a Markdown request', async t => {
  const page = await pageFor(t);
  let markdownRequests = 0;
  page.on('request', request => { if (request.url().endsWith('.md')) markdownRequests++; });
  await loadedProject(page, 'grin');
  assert.match(await page.locator('#project-content').innerText(), /Fitting a theory of perception/);
  assert.equal(markdownRequests, 0);
});
test('Research cards and project narratives remain readable without JavaScript', async t => {
  const page = await browser.newPage({ javaScriptEnabled: false });
  t.after(() => page.close());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/research.html`);
  assert.equal(await page.locator('.research-tile').count(), 7);
  assert.equal(await page.locator('nav a').count(), 5);
  assert.equal(await page.getByRole('link', { name: 'CV', exact: true }).isVisible(), true);
  await page.goto(`${base}/projects/grin.html`);
  assert.match(await page.locator('#project-content').innerText(), /Fitting a theory of perception/);
});
test('all published project routes fit desktop and mobile screens', async t => {
  const page = await pageFor(t);
  const ids = ['team-spirit-hh', 'confidnet', 'discrete-choice-rating', 'dutch-auction', 'grin', 'melanoma-features', 'wheel-of-fortune'];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const id of ids) {
      const response = await page.goto(`${base}/projects/${id}.html`);
      assert.equal(response.status(), 200, id);
      assert.equal(await page.locator('h1').count(), 1, id);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${id} at ${width}px`);
    }
  }
  assert.deepEqual(errors, []);
});
test('legacy project link reaches the static page', async t => {
  const page = await pageFor(t);
  await page.goto(`${base}/project-detail.html?id=grin`);
  await page.waitForURL('**/projects/grin.html');
  assert.match(await page.locator('h1').innerText(), /GRIN/);
});
test('core and project pages expose navigation, headings and sharing metadata', async t => {
  const page = await pageFor(t);
  for (const path of ['/', '/research.html', '/cv.html', '/teaching.html', '/tools.html', '/projects/confidnet.html']) {
    await page.goto(base + path);
    assert.equal(await page.locator('main').count(), 1, path);
    assert.equal(await page.locator('h1').count(), 1, path);
    assert.equal(await page.locator('link[rel=canonical]').count(), 1, path);
    assert.equal(await page.locator('meta[name=description]').count(), 1, path);
    assert.equal(await page.locator('.skip-link').count(), 1, path);
  }
  await page.goto(`${base}/index.html`);
  assert.equal(await page.getByRole('link', { name: 'Download CV' }).getAttribute('href'), '/assets/documents/MurrayBennettCV.pdf');
  await page.locator('nav a[data-nav=home][aria-current=page]').waitFor();
  assert.equal(await page.locator('nav a[data-nav=home]').getAttribute('aria-current'), 'page');
});
test('mobile menu has a usable target and keyboard activation', async t => {
  const page = await pageFor(t);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/research.html`);
  const button = page.getByRole('button', { name: 'Toggle navigation' });
  await button.waitFor();
  const box = await button.boundingBox();
  assert.ok(box.width >= 44 && box.height >= 44);
  await button.focus();
  await page.keyboard.press('Enter');
  assert.equal(await button.getAttribute('aria-expanded'), 'true');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
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
