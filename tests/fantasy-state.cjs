const test = require('node:test');
const assert = require('node:assert/strict');

const state = import('../tools/fantasy-lineup/state.mjs');

class MemoryStorage {
  values = new Map();
  failWrites = false;
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.values.set(key, String(value));
  }
}

const config = () => ({
  schema_version: 1,
  roster: [
    {player_id: 'a', name: 'Alex Smith', position: 'WR', team: 'NE'},
    {player_id: 'b', name: 'Alex Smith', position: 'WR', team: 'NYJ'},
    {player_id: 'k', name: 'Pat Kicker', position: 'K', team: 'NE'},
    {player_id: 'dst', name: 'Defense', position: 'DST', team: 'NE'},
  ],
  slots: [
    {slot_id: 'WR', eligible_positions: ['WR'], modeled: true},
    {slot_id: 'K', eligible_positions: ['K'], modeled: true},
    {slot_id: 'DST', eligible_positions: ['DST'], modeled: false, fixed_player_id: 'dst'},
  ],
  rules: {coefficients: {receptions: 1, receiving_yards: .1,
    fg_made: 3, pat_made: 1}},
});

const manifest = () => ({schema_version: 1, season: 2026, week: 5,
  cutoff_utc: '2026-10-02T18:00:00Z', generated_at: '2026-10-02T18:05:00Z',
  model_version: 'pilot-0.1', manifest_sha256: 'a'.repeat(64),
  sources: {'games.csv': {retrieved_at: '2026-10-02T16:00:00Z'}},
  supported_stat_fields: ['receptions', 'receiving_yards', 'fg_made', 'pat_made'],
  games: {a: {kickoff_utc: '2026-10-04T17:00:00Z'},
    b: {kickoff_utc: '2026-10-04T17:00:00Z'},
    k: {kickoff_utc: '2026-10-04T17:00:00Z'}},
});

const lineupA = {WR: 'a', K: 'k', DST: 'dst'};
const lineupB = {WR: 'b', K: 'k', DST: 'dst'};
const prelock = '2026-10-03T18:00:00Z';
const postlock = '2026-10-04T18:00:00Z';

test('duplicate names remain distinct but duplicate IDs fail validation', async () => {
  const {validateConfig} = await state;
  assert.equal(validateConfig(config(), manifest()).valid, true);
  const duplicate = config();
  duplicate.roster[1].player_id = 'a';
  assert.match(validateConfig(duplicate, manifest()).errors.join(' '), /duplicate player ID/);
});

test('unsupported scoring and invalid or unfixed slots fail visibly', async () => {
  const {validateConfig} = await state;
  const badRule = config();
  badRule.rules.coefficients.tackles = 1;
  assert.match(validateConfig(badRule, manifest()).errors.join(' '), /tackles/);
  const badSlot = config();
  badSlot.slots[0].eligible_positions = ['QB'];
  assert.match(validateConfig(badSlot, manifest()).errors.join(' '), /WR/);
  const unfixed = config();
  delete unfixed.slots[2].fixed_player_id;
  assert.match(validateConfig(unfixed, manifest()).errors.join(' '), /DST/);
});

test('failed config save leaves the previous storage value intact', async () => {
  const {saveConfig} = await state;
  const storage = new MemoryStorage();
  saveConfig(config(), storage);
  const previous = [...storage.values.values()][0];
  storage.failWrites = true;
  const changed = config();
  changed.roster[0].name = 'New name';
  assert.throws(() => saveConfig(changed, storage), /QuotaExceededError/);
  assert.equal([...storage.values.values()][0], previous);
});

test('week records freeze initial, model and final choices with provenance', async () => {
  const {beginWeek, saveInitial, freezeAdvice, saveFinal, saveWeek, readWeek} = await state;
  const storage = new MemoryStorage();
  let record = beginWeek(config(), manifest(), storage);
  assert.equal(record.schema_version, 1);
  assert.equal(record.data_cutoff_utc, manifest().cutoff_utc);
  assert.equal(record.model_version, manifest().model_version);
  assert.equal(record.game_locks.a, manifest().games.a.kickoff_utc);
  record = saveInitial(record, {lineup: lineupA,
    comparisons: [{a: 'a', b: 'b', probability: .65}],
    external_forecast_seen: true}, prelock);
  const forecast = {lineup: structuredClone(lineupB), comparison: {a: 'a', b: 'b', probabilityA: null},
    model_version: 'pilot-0.1', calibrated: false};
  record = freezeAdvice(record, forecast, prelock);
  forecast.lineup.WR = 'a';
  assert.equal(record.advice.lineup.WR, 'b');
  assert.equal(record.advice.comparison.probabilityA, null);
  record = saveFinal(record, {lineup: lineupA,
    comparisons: [{a: 'a', b: 'b', probability: .6}],
    override_reasons: {WR: 'I saw a practice update'}}, prelock);
  assert.equal(record.initial.comparisons[0].probability, .65);
  assert.equal(record.initial.external_forecast_seen, true);
  assert.equal(record.final.comparisons[0].probability, .6);
  assert.equal(record.final.excluded_from_prospective, false);
  saveWeek(record, storage);
  assert.deepEqual(readWeek(2026, 5, storage), record);
  assert.deepEqual(beginWeek(config(), {...manifest(), model_version: 'new'}, storage), record);
});

test('frozen advice retains per-player expected points for later forecast checking', async () => {
  const {beginWeek, freezeAdvice, saveWeek, readWeek} = await state;
  const storage = new MemoryStorage();
  let record = beginWeek(config(), manifest(), storage);
  record = freezeAdvice(record, {lineup: lineupB, calibrated: false,
    player_means: {a: 10.5, b: 12, k: 6}}, prelock);
  saveWeek(record, storage);
  assert.equal(readWeek(2026, 5, storage).advice.player_means.a, 10.5);
  const changed = structuredClone(record);
  changed.advice.player_means.a = 100;
  assert.throws(() => saveWeek(changed, storage), /frozen advice/);
});

test('late revision is retained while earlier prelock final remains frozen', async () => {
  const {beginWeek, freezeAdvice, saveFinal} = await state;
  const storage = new MemoryStorage();
  let record = beginWeek(config(), manifest(), storage);
  record = freezeAdvice(record, {lineup: lineupB, calibrated: false}, prelock);
  record = saveFinal(record, {lineup: lineupB, comparisons: [], override_reasons: {}}, prelock);
  const frozenAdvice = structuredClone(record.advice);
  record = saveFinal(record, {lineup: lineupA, comparisons: [],
    override_reasons: {WR: 'Changed after kickoff'}}, postlock);
  assert.deepEqual(record.advice, frozenAdvice);
  assert.equal(record.prelock_final.lineup.WR, 'b');
  assert.equal(record.final.lineup.WR, 'a');
  assert.equal(record.final.excluded_from_prospective, true);
  assert.equal(record.final.player_flags.a.locked, true);
  assert.equal(record.revisions.length, 1);
});

test('late advice cannot replace a frozen forecast', async () => {
  const {beginWeek, freezeAdvice} = await state;
  let record = beginWeek(config(), manifest(), new MemoryStorage());
  record = freezeAdvice(record, {lineup: lineupB, calibrated: false}, prelock);
  assert.throws(() => freezeAdvice(record, {lineup: lineupA}, postlock), /already frozen/);
  const fresh = beginWeek(config(), manifest(), new MemoryStorage());
  assert.throws(() => freezeAdvice(fresh, {lineup: lineupA}, postlock), /lock/);
});

test('export discloses private roster, rules and picks; import treats HTML names as text', async () => {
  const {saveConfig, beginWeek, exportRecords, importRecords, readWeek} = await state;
  const storage = new MemoryStorage();
  const privateConfig = config();
  privateConfig.roster[0].name = '<img src=x onerror=alert(1)>';
  saveConfig(privateConfig, storage);
  beginWeek(privateConfig, manifest(), storage);
  const blob = exportRecords(storage);
  assert.equal(blob.type, 'application/json');
  const payload = await blob.text();
  assert.match(payload, /Includes roster, scoring rules, picks/);
  assert.match(payload, /onerror=alert/);
  assert.match(payload, /receiving_yards/);
  const imported = new MemoryStorage();
  assert.equal(importRecords(payload, imported).imported_weeks, 1);
  assert.equal(readWeek(2026, 5, imported).roster[0].name,
    '<img src=x onerror=alert(1)>');
});

test('malformed and wrong-version imports preserve prior records', async () => {
  const {saveConfig, importRecords} = await state;
  const storage = new MemoryStorage();
  saveConfig(config(), storage);
  const previous = [...storage.values.values()][0];
  assert.throws(() => importRecords('{bad json', storage), /JSON/);
  assert.throws(() => importRecords(JSON.stringify({schema_version: 99,
    config: config(), weeks: {}}), storage), /schema version/);
  assert.equal([...storage.values.values()][0], previous);
});

test('quota error during import preserves old records', async () => {
  const {saveConfig, exportRecords, importRecords} = await state;
  const oldStorage = new MemoryStorage();
  saveConfig(config(), oldStorage);
  const previous = [...oldStorage.values.values()][0];
  const payload = await exportRecords(oldStorage).text();
  oldStorage.failWrites = true;
  assert.throws(() => importRecords(payload, oldStorage), /QuotaExceededError/);
  assert.equal([...oldStorage.values.values()][0], previous);
});

test('latest timely revision becomes the prospective final choice', async () => {
  const {beginWeek, freezeAdvice, saveFinal, saveWeek, readWeek} = await state;
  const storage = new MemoryStorage();
  let record = beginWeek(config(), manifest(), storage);
  record = freezeAdvice(record, {lineup: lineupB, calibrated: false}, prelock);
  record = saveFinal(record, {lineup: lineupB, comparisons: [], override_reasons: {}}, prelock);
  saveWeek(record, storage);
  record = saveFinal(record, {lineup: lineupA, comparisons: [],
    override_reasons: {WR: 'New injury report'}}, '2026-10-04T16:00:00Z');
  saveWeek(record, storage);
  assert.equal(record.prelock_final.lineup.WR, 'a');
  assert.equal(record.final.excluded_from_prospective, false);
  assert.equal(readWeek(2026, 5, storage).prelock_final.lineup.WR, 'a');
});

test('saveWeek refuses to rewrite frozen initial choice or model advice', async () => {
  const {beginWeek, saveInitial, freezeAdvice, saveWeek, readWeek} = await state;
  const storage = new MemoryStorage();
  let record = beginWeek(config(), manifest(), storage);
  record = saveInitial(record, {lineup: lineupA, comparisons: [],
    external_forecast_seen: false}, prelock);
  record = freezeAdvice(record, {lineup: lineupB, calibrated: false}, prelock);
  saveWeek(record, storage);
  const original = readWeek(2026, 5, storage);
  const changedInitial = structuredClone(original);
  changedInitial.initial.lineup.WR = 'b';
  assert.throws(() => saveWeek(changedInitial, storage), /frozen initial/);
  const changedAdvice = structuredClone(original);
  changedAdvice.advice.lineup.WR = 'a';
  assert.throws(() => saveWeek(changedAdvice, storage), /frozen advice/);
  assert.deepEqual(readWeek(2026, 5, storage), original);
});

test('import rejects malformed week records before touching storage', async () => {
  const {saveConfig, importRecords, exportRecords} = await state;
  const storage = new MemoryStorage();
  saveConfig(config(), storage);
  const previous = [...storage.values.values()][0];
  const exported = JSON.parse(await exportRecords(storage).text());
  exported.weeks['2026-5'] = {schema_version: 1, season: 2026, week: 5,
    roster: [], slots: [], rules: {}, sources: {}, game_locks: {}, revisions: [],
    data_cutoff_utc: 'yesterday', generated_at: 'today'};
  assert.throws(() => importRecords(JSON.stringify(exported), storage), /invalid UTC timestamp/);
  assert.equal([...storage.values.values()][0], previous);
});

test('final probability must address the same ordered comparison as the unaided choice', async () => {
  const {beginWeek, saveInitial, freezeAdvice, saveFinal} = await state;
  let record = beginWeek(config(), manifest(), new MemoryStorage());
  record = saveInitial(record, {lineup: lineupA,
    comparisons: [{a: 'a', b: 'b', probability: .6}]}, prelock);
  record = freezeAdvice(record, {lineup: lineupB, calibrated: false,
    comparison: {a: 'a', b: 'b', probabilityA: null}}, prelock);
  assert.throws(() => saveFinal(record, {lineup: lineupB,
    comparisons: [{a: 'b', b: 'a', probability: .4}],
    override_reasons: {}}, prelock), /same comparison/);
});

test('removing a started player is a late revision even if replacement has not started', async () => {
  const {beginWeek, freezeAdvice, saveFinal} = await state;
  const staggered = manifest();
  staggered.games.b.kickoff_utc = '2026-10-04T21:00:00Z';
  staggered.games.k.kickoff_utc = '2026-10-04T21:00:00Z';
  let record = beginWeek(config(), staggered, new MemoryStorage());
  record = freezeAdvice(record, {lineup: lineupA, calibrated: false}, prelock);
  record = saveFinal(record, {lineup: lineupA, comparisons: [], override_reasons: {}}, prelock);
  record = saveFinal(record, {lineup: lineupB, comparisons: [],
    override_reasons: {WR: 'Replaced after A started'}}, postlock);
  assert.equal(record.final.excluded_from_prospective, true);
  assert.equal(record.final.player_flags.a.locked, true);
  assert.equal(record.prelock_final.lineup.WR, 'a');
});

test('missing scheduled player is marked unavailable and cannot enter advice', async () => {
  const {beginWeek, freezeAdvice} = await state;
  const noGame = manifest();
  delete noGame.games.a;
  const record = beginWeek(config(), noGame, new MemoryStorage());
  assert.equal(record.roster.find((player) => player.player_id === 'a').on_bye, true);
  assert.throws(() => freezeAdvice(record, {lineup: lineupA}, prelock), /ineligible/);
});

test('saveWeek preserves prior prospective final and append-only revisions', async () => {
  const {beginWeek, freezeAdvice, saveFinal, saveWeek, readWeek} = await state;
  const storage = new MemoryStorage();
  let record = beginWeek(config(), manifest(), storage);
  record = freezeAdvice(record, {lineup: lineupB, calibrated: false}, prelock);
  record = saveFinal(record, {lineup: lineupB, comparisons: [], override_reasons: {}}, prelock);
  saveWeek(record, storage);
  const tampered = structuredClone(record);
  tampered.prelock_final = null;
  assert.throws(() => saveWeek(tampered, storage), /prelock final/);
  const late = saveFinal(record, {lineup: lineupA, comparisons: [],
    override_reasons: {WR: 'Late change'}}, postlock);
  saveWeek(late, storage);
  const erasedHistory = structuredClone(late);
  erasedHistory.revisions = [];
  assert.throws(() => saveWeek(erasedHistory, storage), /revision history/);
  assert.equal(readWeek(2026, 5, storage).prelock_final.lineup.WR, 'b');
});

test('two initial comparisons remain paired with two frozen model comparisons', async () => {
  const {beginWeek, saveInitial, freezeAdvice} = await state;
  let record = beginWeek(config(), manifest(), new MemoryStorage());
  record = saveInitial(record, {lineup: lineupA, comparisons: [
    {a: 'a', b: 'b', probability: .6}, {a: 'k', b: 'a', probability: .4},
  ]}, prelock);
  assert.throws(() => freezeAdvice(record, {lineup: lineupB, calibrated: false,
    comparisons: [{a: 'b', b: 'a', probabilityA: null},
      {a: 'k', b: 'a', probabilityA: null}]}, prelock), /same comparison/);
  record = freezeAdvice(record, {lineup: lineupB, calibrated: false,
    comparisons: [{a: 'a', b: 'b', probabilityA: null},
      {a: 'k', b: 'a', probabilityA: null}]}, prelock);
  assert.equal(record.advice.comparisons.length, 2);
  assert.equal(record.advice.comparisons[1].a, 'k');
});

test('import rejects an uncalibrated probability embedded in model advice', async () => {
  const {beginWeek, freezeAdvice, saveWeek, exportRecords, importRecords, readWeek} = await state;
  const storage = new MemoryStorage();
  let record = beginWeek(config(), manifest(), storage);
  record = freezeAdvice(record, {lineup: lineupB, calibrated: false,
    comparison: {a: 'a', b: 'b', probabilityA: null}}, prelock);
  saveWeek(record, storage);
  const original = readWeek(2026, 5, storage);
  const exported = JSON.parse(await exportRecords(storage).text());
  exported.weeks['2026-5'].advice.comparisons[0].probabilityA = 1.5;
  assert.throws(() => importRecords(JSON.stringify(exported), storage), /model comparison/);
  assert.deepEqual(readWeek(2026, 5, storage), original);
});
