const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {chromium} = require('playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:8765';
let browser;
before(async () => { browser = await chromium.launch({headless: true,
  ...(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {})}); });
after(async () => browser?.close());
const hash = text => createHash('sha256').update(text).digest('hex');
function fixture(multiplier = 1) {
  const make = (id, name, status, points) => ({player_id: id, name, team: 'AA', position: 'WR',
    injury_status: status, injury_issued_at: status === 'Unknown' ? null : '2099-09-25T12:00:00Z',
    draws: points.map(raw => { const value = raw * multiplier; return {available: value > 0, stats: {
      receptions: value / 2, receiving_yards: value * 5, targets: value / 2,
      carries: 0, rushing_yards: 0, receiving_tds: 0,
      receiving_2pt_conversions: 0, rushing_2pt_conversions: 0,
    }}; })});
  const players = {a: make('a', 'Alex Example', 'Questionable', [8, 12, 10, 6]),
    b: make('b', 'Blair Example', 'Unknown', [6, 8, 12, 10]),
    c: make('c', 'Casey Example', 'Out', [0, 0, 0, 0])};
  const shard = {team: 'AA', team_opportunity: Array.from({length: 4}, () =>
    ({targets: 12, carries: 0, attempts: 20, other_attempts: 20})), players};
  const shardText = JSON.stringify(shard);
  const manifest = {schema_version: 1, season: 2099, week: 4,
    cutoff_utc: '2099-09-25T13:00:00Z', generated_at: '2099-09-25T14:00:00Z',
    model_version: 'fixture-v1', draw_count: 4, supported_stat_fields: [
      'completions', 'attempts', 'passing_yards', 'passing_tds', 'passing_interceptions',
      'passing_2pt_conversions', 'carries', 'rushing_yards', 'rushing_tds',
      'rushing_2pt_conversions', 'targets', 'receptions', 'receiving_yards',
      'receiving_tds', 'receiving_2pt_conversions', 'fumbles_lost_total',
      'fg_made', 'fg_att', 'fg_missed', 'fg_made_0_19', 'fg_made_20_29',
      'fg_made_30_39', 'fg_made_40_49', 'fg_made_50_59', 'fg_made_60_',
      'pat_made', 'pat_att', 'pat_missed'], sources: {fixture: {retrieved_at: '2099-09-25T12:00:00Z'}},
    games: Object.fromEntries(['a', 'b', 'c'].map(id => [id, {kickoff_utc: '2099-09-28T17:00:00Z'}])),
    shards: [{team: 'AA', path: 'versions/test/team-AA.json', sha256: hash(shardText), player_count: 3}]};
  const manifestText = JSON.stringify(manifest);
  return {pointer: {schema_version: 1, manifest: 'versions/test/manifest.json', manifest_sha256: hash(manifestText)},
    manifestText, shardText};
}
async function pageFor(t, {fail = false} = {}) {
  const page = await browser.newPage({viewport: {width: 1280, height: 900}});
  t.after(() => page.close());
  const data = fixture();
  await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin
    ? route.continue() : route.abort());
  await page.route('**/tools/fantasy-lineup/current.json', route => fail
    ? route.fulfill({status: 503, body: 'unavailable'}) : route.fulfill({json: data.pointer}));
  await page.route('**/tools/fantasy-lineup/versions/test/manifest.json', route => route.fulfill({body: data.manifestText, contentType: 'application/json'}));
  await page.route('**/tools/fantasy-lineup/versions/test/team-AA.json', route => route.fulfill({body: data.shardText, contentType: 'application/json'}));
  return page;
}
async function setup(page) {
  await page.goto(`${base}/tools/fantasy-lineup/`);
  await page.getByText(/Season 2099, week 4/).waitFor();
  await page.locator('input[name=roster][value=a]').check();
  await page.locator('input[name=roster][value=b]').check();
  for (const kind of ['QB', 'RB', 'WR', 'TE', 'FLEX', 'SUPERFLEX', 'K'])
    await page.locator(`#slot-${kind}`).fill(kind === 'WR' ? '1' : '0');
  await page.locator('#scoring-confirmed').check();
  await page.getByRole('button', {name: 'Continue to my pick'}).click();
  await page.getByRole('heading', {name: 'Make your pick'}).waitFor({timeout: 3000});
}
test('fixture roster saves unaided, official and final choices with readable advice', async t => {
  const page = await pageFor(t), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/tools/fantasy-lineup/`);
  await page.getByText(/Season 2099, week 4/).waitFor();
  assert.match(await page.locator('#roster-options').innerText(), /Questionable.*Unknown.*Out/s);
  await setup(page);
  assert.match(await page.locator('#pick-context').innerText(), /Questionable.*Unknown/s);
  await page.locator('#initial-WR-1').selectOption('b');
  assert.match(await page.locator('#comparison-slot').locator('option:checked').innerText(), /Blair Example/);
  assert.match(await page.locator('#comparison-b').locator('option:checked').innerText(), /Alex Example/);
  await page.locator('#initial-probability').fill('60');
  await page.getByRole('button', {name: 'Freeze my pick and show advice'}).click();
  await page.getByRole('heading', {name: 'Compare and save'}).waitFor();
  if (process.env.FANTASY_SCREENSHOT_DIR) await page.screenshot({path: `${process.env.FANTASY_SCREENSHOT_DIR}/fantasy-desktop.png`, fullPage: true});
  const card = await page.locator('#advice-card').innerText();
  for (const phrase of ['Expected points', '80% interval', 'P(A>B)', 'Unavailable until calibration', 'Lock time', 'Injury status', 'Decision band']) assert.match(card, new RegExp(phrase.replace(/[()]/g, '\\$&')));
  await page.locator('#scenario-panel summary').click();
  await page.locator('#scenario-player').selectOption('a');
  await page.getByRole('button', {name: 'Explore condition'}).click();
  assert.match(await page.locator('#scenario-result').innerText(), /Official frozen advice is unchanged/);
  assert.match(await page.locator('#scenario-result').innerText(), /Conditional legal lineup.*WR-1.*flip threshold/s);
  await page.getByRole('button', {name: 'Save final pick in this browser'}).click();
  await page.getByRole('heading', {name: 'Results'}).waitFor();
  assert.match(await page.locator('#saved-weeks').innerText(), /Unaided pick: saved.*Final pick: saved.*Pending outcome data/s);
  assert.deepEqual(errors, []);
});
test('skip path, form error preserving values, and 390px layout', async t => {
  const page = await pageFor(t), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({width: 390, height: 844});
  await page.goto(`${base}/tools/fantasy-lineup/`);
  await page.getByText(/Season 2099, week 4/).waitFor();
  await page.locator('input[name=roster][value=a]').check();
  await page.locator('#fixed-dst').fill('My defense');
  await page.getByRole('button', {name: 'Continue to my pick'}).click();
  assert.match(await page.locator('#setup-errors').innerText(), /Confirm the scoring/);
  assert.equal(await page.locator('#fixed-dst').inputValue(), 'My defense');
  await page.locator('input[name=roster][value=b]').check();
  for (const kind of ['QB', 'RB', 'WR', 'TE', 'FLEX', 'SUPERFLEX', 'K']) await page.locator(`#slot-${kind}`).fill(kind === 'WR' ? '1' : '0');
  await page.locator('#scoring-confirmed').check();
  await page.getByRole('button', {name: 'Continue to my pick'}).click();
  await page.getByRole('button', {name: 'Skip unaided pick'}).click();
  await page.getByRole('heading', {name: 'Compare and save'}).waitFor();
  if (process.env.FANTASY_SCREENSHOT_DIR) await page.screenshot({path: `${process.env.FANTASY_SCREENSHOT_DIR}/fantasy-mobile.png`, fullPage: true});
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
});
test('keyboard controls have visible focus; failed refresh retains saved records', async t => {
  const page = await pageFor(t);
  await setup(page);
  await page.getByRole('button', {name: 'Skip unaided pick'}).focus();
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), 'none');
  await page.keyboard.press('Enter');
  await page.getByRole('heading', {name: 'Compare and save'}).waitFor();
  await page.getByRole('button', {name: 'Save final pick in this browser'}).click();
  await page.route('**/tools/fantasy-lineup/current.json', route => route.fulfill({status: 503, body: 'unavailable'}));
  await page.reload();
  await page.locator('#notice:not(:empty)').waitFor();
  assert.match(await page.locator('#notice').innerText(), /last good dated snapshot/);
  await page.getByRole('button', {name: 'Results'}).click();
  await page.getByRole('heading', {name: 'Results'}).waitFor();
  assert.match(await page.locator('#saved-weeks').innerText(), /Final pick: saved/);
});
test('keyboard-only setup and skip reaches advice; unsupported rule stays visible', async t => {
  const page = await pageFor(t);
  await page.goto(`${base}/tools/fantasy-lineup/`);
  await page.getByText(/Season 2099, week 4/).waitFor();
  for (const id of ['a', 'b']) {
    await page.locator(`input[name=roster][value=${id}]`).focus();
    await page.keyboard.press('Space');
  }
  for (const kind of ['QB', 'RB', 'WR', 'TE', 'FLEX', 'SUPERFLEX', 'K']) {
    const input = page.locator(`#slot-${kind}`);
    await input.focus();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type(kind === 'WR' ? '1' : '0');
  }
  await page.locator('#other-scoring').focus();
  await page.keyboard.type('return yards');
  await page.locator('#scoring-confirmed').focus();
  await page.keyboard.press('Space');
  await page.getByRole('button', {name: 'Continue to my pick'}).focus();
  await page.keyboard.press('Enter');
  assert.match(await page.locator('#setup-errors').innerText(), /Unsupported scoring component: return yards/);
  assert.equal(await page.locator('#other-scoring').inputValue(), 'return yards');
  await page.locator('#other-scoring').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
  await page.getByRole('button', {name: 'Continue to my pick'}).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', {name: 'Skip unaided pick'}).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('heading', {name: 'Compare and save'}).waitFor();
  assert.match(await page.locator('#advice-card').innerText(), /Expected points/);
});
test('a frozen starter remains visible for a late final record', async t => {
  const page = await pageFor(t);
  await setup(page);
  await page.getByRole('button', {name: 'Skip unaided pick'}).click();
  const selected = await page.locator('#final-WR-1').inputValue();
  await page.addInitScript(() => {
    const ActualDate = Date;
    window.Date = class extends ActualDate {
      constructor(...args) { super(...(args.length ? args : ['2099-09-29T00:00:00Z'])); }
      static now() { return ActualDate.parse('2099-09-29T00:00:00Z'); }
    };
  });
  await page.reload();
  await page.getByRole('heading', {name: 'Compare and save'}).waitFor();
  assert.equal(await page.locator('#final-WR-1').inputValue(), selected);
  await page.getByRole('button', {name: 'Save final pick in this browser'}).click();
  await page.getByRole('heading', {name: 'Results'}).waitFor();
  assert.match(await page.locator('#saved-weeks').innerText(), /Final pick: saved/);
  const late = await page.evaluate(() => JSON.parse(localStorage.getItem('fantasy-lineup:v1')).weeks['2099-4'].final.excluded_from_prospective);
  assert.equal(late, true);
});
test('same-week refresh cannot change a frozen advice card', async t => {
  const page = await pageFor(t);
  await setup(page);
  await page.getByRole('button', {name: 'Skip unaided pick'}).click();
  const original = await page.locator('#advice-card').innerText();
  const updated = fixture(5);
  await page.route('**/tools/fantasy-lineup/current.json', route => route.fulfill({json: updated.pointer}));
  await page.route('**/tools/fantasy-lineup/versions/test/manifest.json', route => route.fulfill({body: updated.manifestText, contentType: 'application/json'}));
  await page.route('**/tools/fantasy-lineup/versions/test/team-AA.json', route => route.fulfill({body: updated.shardText, contentType: 'application/json'}));
  await page.reload();
  await page.getByRole('heading', {name: 'Compare and save'}).waitFor();
  assert.equal(await page.locator('#advice-card').innerText(), original);
  assert.match(await page.locator('#notice').innerText(), /original dated snapshot/);
});
test('damaged browser records still leave Results and Import reachable', async t => {
  const page = await pageFor(t);
  await page.goto(`${base}/tools/fantasy-lineup/`);
  await page.evaluate(() => localStorage.setItem('fantasy-lineup:v1', '{broken'));
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.reload();
  await page.getByRole('button', {name: 'Results'}).click();
  assert.match(await page.locator('#saved-weeks').innerText(), /cannot be read/);
  assert.equal(await page.locator('#import-records').isVisible(), true);
  assert.deepEqual(errors, []);
});
test('a verified but old snapshot warns about stale inputs', async t => {
  const page = await pageFor(t);
  await page.addInitScript(() => { Date.now = () => Date.parse('2099-09-27T16:00:00Z'); });
  await page.goto(`${base}/tools/fantasy-lineup/`);
  await page.getByText(/Season 2099, week 4/).waitFor();
  assert.match(await page.locator('#notice').innerText(), /more than 24 hours old/);
});
function outcomeFixture(aYards = 80, bYards = 40, forecastHash = fixture().pointer.manifest_sha256) {
  const observed_at = '2099-09-29T12:00:00Z';
  const week = {schema_version: 1, season: 2099, week: 4,
    forecast_manifest_sha256: forecastHash, missing_player_ids: [],
    source: {name: 'fixture results', url: 'https://example.invalid/final',
      retrieved_at: '2099-09-29T13:00:00Z', licence: 'fixture only',
      raw_sha256: 'f'.repeat(64), status: 'final'},
    players: {
      a: {player_id: 'a', observed_at, stats: {receptions: 8, receiving_yards: aYards}},
      b: {player_id: 'b', observed_at, stats: {receptions: 4, receiving_yards: bYards}},
    }};
  const weekText = JSON.stringify(week);
  const manifest = {schema_version: 1, generated_at: '2099-09-29T13:00:00Z',
    weeks: {['2099-4:' + forecastHash]: {path: 'versions/results/week-2099-4.json', sha256: hash(weekText)}}};
  const manifestText = JSON.stringify(manifest);
  return {pointer: {schema_version: 1, manifest: 'versions/results/manifest.json',
    manifest_sha256: hash(manifestText)}, manifestText, weekText};
}
async function routeOutcomes(page, data) {
  await page.route('**/tools/fantasy-lineup/outcomes/current.json', route => route.fulfill({json: data.pointer}));
  await page.route('**/tools/fantasy-lineup/outcomes/versions/results/manifest.json', route =>
    route.fulfill({body: data.manifestText, contentType: 'application/json'}));
  await page.route('**/tools/fantasy-lineup/outcomes/versions/results/week-2099-4.json', route =>
    route.fulfill({body: data.weekText, contentType: 'application/json'}));
}
test('Results keeps completed and pending weeks distinct, and correction leaves pick frozen', async t => {
  const page = await pageFor(t);
  await setup(page);
  await page.getByRole('button', {name: 'Skip unaided pick'}).click();
  await page.getByRole('button', {name: 'Save final pick in this browser'}).click();
  const frozen = await page.evaluate(() => localStorage.getItem('fantasy-lineup:v1'));
  await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('fantasy-lineup:v1'));
    const previous = structuredClone(store.weeks['2099-4']); previous.week = 3;
    store.weeks['2099-3'] = previous;
    localStorage.setItem('fantasy-lineup:v1', JSON.stringify(store));
  });
  const savedBeforeCorrection = await page.evaluate(() => localStorage.getItem('fantasy-lineup:v1'));
  await routeOutcomes(page, outcomeFixture());
  await page.reload();
  await page.getByRole('button', {name: 'Results'}).click();
  await page.getByText(/Season 2099, week 4.*Realized points/s).waitFor({timeout: 3000});
  assert.match(await page.locator('#saved-weeks').innerText(), /week 4.*Realized points.*week 3.*Pending outcome data/s);
  assert.match(await page.locator('#saved-weeks').innerText(), /Forecast quality.*Research inference/s);
  assert.match(await page.locator('#saved-weeks').innerText(), /model: 16\.0/);
  await page.setViewportSize({width: 390, height: 844});
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  if (process.env.FANTASY_SCREENSHOT_DIR) await page.screenshot({path: `${process.env.FANTASY_SCREENSHOT_DIR}/fantasy-results-mobile.png`, fullPage: true});
  const corrected = outcomeFixture(100, 40);
  await routeOutcomes(page, corrected);
  await page.reload();
  await page.getByRole('button', {name: 'Results'}).click();
  await page.getByText(/Season 2099, week 4.*Realized points/s).waitFor({timeout: 3000});
  assert.match(await page.locator('#saved-weeks').innerText(), /corrected outcome version|Source fixture results/i);
  assert.match(await page.locator('#saved-weeks').innerText(), /model: 18\.0/);
  assert.equal(await page.evaluate(() => localStorage.getItem('fantasy-lineup:v1')), savedBeforeCorrection);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('fantasy-lineup:v1')).weeks['2099-4']);
  assert.equal(saved.advice.lineup['WR-1'], JSON.parse(frozen).weeks['2099-4'].advice.lineup['WR-1']);
});
test('outcomes from a different forecast player pool remain pending', async t => {
  const page = await pageFor(t);
  await setup(page);
  await page.getByRole('button', {name: 'Skip unaided pick'}).click();
  await page.getByRole('button', {name: 'Save final pick in this browser'}).click();
  await routeOutcomes(page, outcomeFixture(80, 40, '0'.repeat(64)));
  await page.getByRole('button', {name: 'Results'}).click();
  await page.getByText(/different forecast snapshot/).waitFor();
  assert.match(await page.locator('#saved-weeks').innerText(), /different forecast|could not be verified/i);
  assert.doesNotMatch(await page.locator('#saved-weeks').innerText(), /Realized points/);
});
