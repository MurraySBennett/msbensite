const test = require('node:test');
const assert = require('node:assert/strict');
const evaluation = import('../tools/fantasy-lineup/evaluation.mjs');

function record() { return {
  schema_version: 1, season: 2026, week: 5,
  roster: [
    {player_id: 'a', name: 'Alex', position: 'WR', team: 'AA'},
    {player_id: 'b', name: 'Blair', position: 'WR', team: 'BB'},
    {player_id: 'c', name: 'Casey', position: 'WR', team: 'CC'},
    {player_id: 'k', name: 'Kicker', position: 'K', team: 'AA'},
    {player_id: 'dst', name: 'Defense', position: 'DST', team: 'AA'},
  ],
  slots: [
    {slot_id: 'WR', eligible_positions: ['WR'], modeled: true},
    {slot_id: 'K', eligible_positions: ['K'], modeled: true},
    {slot_id: 'DST', eligible_positions: ['DST'], modeled: false, fixed_player_id: 'dst'},
  ],
  rules: {coefficients: {receptions: 1, receiving_yards: .1, fg_made: 3, pat_made: 1}},
  game_locks: Object.fromEntries(['a', 'b', 'c', 'k'].map(id => [id, '2026-10-04T17:00:00Z'])),
  initial: {lineup: {WR: 'a', K: 'k', DST: 'dst'}, comparisons: [{a: 'a', b: 'b', probability: .6}],
    external_forecast_seen: false, excluded_from_prospective: false},
  advice: {lineup: {WR: 'b', K: 'k', DST: 'dst'}, comparisons: [{a: 'a', b: 'b', probabilityA: null}],
    player_means: {a: 11, b: 14, c: 8, k: 6}, calibrated: false},
  final: {lineup: {WR: 'c', K: 'k', DST: 'dst'}, comparisons: [{a: 'a', b: 'b', probability: .3}],
    excluded_from_prospective: false},
  prelock_final: {lineup: {WR: 'c', K: 'k', DST: 'dst'}, comparisons: [{a: 'a', b: 'b', probability: .3}],
    excluded_from_prospective: false},
}; }
function outcomes() {
  const observed_at = '2026-10-05T12:00:00Z';
  return {schema_version: 1, season: 2026, week: 5, source: {name: 'fixture'}, players: {
    a: {player_id: 'a', observed_at, stats: {receptions: 5, receiving_yards: 50}},
    b: {player_id: 'b', observed_at, stats: {receptions: 8, receiving_yards: 80}},
    c: {player_id: 'c', observed_at, stats: {receptions: 3, receiving_yards: 30}},
    k: {player_id: 'k', observed_at, stats: {fg_made: 2, pat_made: 1}},
  }};
}
test('browser evaluator agrees with three known Python lineup totals', async () => {
  const {evaluateWeek} = await evaluation;
  const result = evaluateWeek(record(), outcomes());
  assert.deepEqual(result.realized_points, {initial: 17, model: 23, final: 13});
  assert.deepEqual(result.regret, {initial: 6, model: 0, final: 10});
  assert.equal(result.oracle_points, 23);
  assert.equal(result.override_direction, 'hurt');
  assert.equal(result.forecast_quality.roster_mae, 1.5);
  assert.equal(result.prospective_eligible, true);
});
test('negative observed receiving yards lower the realized score', async () => {
  const {evaluateWeek} = await evaluation;
  const observed = outcomes();
  observed.players.a.stats = {receptions: 1, receiving_yards: -5};
  assert.equal(evaluateWeek(record(), observed).realized_points.initial, 7.5);
});
test('missing outcome stays pending and correction does not mutate record', async () => {
  const {evaluateWeek} = await evaluation;
  const saved = record(), frozen = structuredClone(saved);
  const incomplete = outcomes(); delete incomplete.players.c;
  assert.equal(evaluateWeek(saved, incomplete).status, 'pending');
  const corrected = outcomes(); corrected.players.b.stats.receiving_yards = 100;
  assert.equal(evaluateWeek(saved, corrected).realized_points.model, 25);
  assert.deepEqual(saved, frozen);
});
test('late and externally informed choices are labeled, not prospectively pooled', async () => {
  const {evaluateWeek, aggregateResults} = await evaluation;
  const saved = record(); saved.initial.external_forecast_seen = true;
  saved.final.lineup.WR = 'a'; saved.final.excluded_from_prospective = true;
  const result = evaluateWeek(saved, outcomes());
  assert.equal(result.realized_points.final, 13);
  assert.equal(result.latest_saved_final_points, 17);
  assert.equal(result.prospective_eligible, false);
  assert.ok(result.exclusion_reasons.includes('external forecast seen'));
  assert.equal(aggregateResults([result]).paired_weeks, 0);
});
test('too few paired weeks suppress inference interval and calibration bins', async () => {
  const {evaluateWeek, aggregateResults} = await evaluation;
  const report = aggregateResults([evaluateWeek(record(), outcomes())]);
  assert.equal(report.paired_weeks, 1);
  assert.equal(report.paired_final_minus_model_ci95, null);
  assert.equal(report.calibration_bins, null);
});
test('bye-only roster entry and fixed-only lineup avoid invented points', async () => {
  const {evaluateWeek} = await evaluation;
  const withBye = record();
  withBye.roster.push({player_id: 'bye', name: 'Bye', position: 'WR', team: 'DD'});
  assert.equal(evaluateWeek(withBye, outcomes()).oracle_points, 23);
  const fixed = record();
  fixed.roster = [fixed.roster.at(-1)]; fixed.slots = [fixed.slots.at(-1)]; fixed.game_locks = {};
  for (const field of ['initial', 'advice', 'final', 'prelock_final']) {
    fixed[field].lineup = {DST: 'dst'}; fixed[field].comparisons = [];
  }
  fixed.advice.player_means = {};
  const outcome = outcomes(); outcome.players = {};
  const result = evaluateWeek(fixed, outcome);
  assert.deepEqual(result.realized_points, {initial: 0, model: 0, final: 0});
  assert.equal(result.forecast_quality, null);
});
