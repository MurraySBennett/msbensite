const test = require('node:test');
const assert = require('node:assert/strict');

const decision = import('../tools/fantasy-lineup/decision.mjs');
const scenarios = import('../tools/fantasy-lineup/scenarios.mjs');

const rules = {coefficients: {
  passing_yards: 0.04, passing_tds: 4, passing_interceptions: -2,
  rushing_yards: 0.1, rushing_tds: 6, receiving_yards: 0.1,
  receptions: 1, receiving_tds: 6, fumbles_lost_total: -2,
  fg_made: 3, fg_made_50_59: 2, pat_made: 1,
}};

test('scoring matches Python PPR receiver and kicker examples', async () => {
  const {scoreDraws} = await decision;
  assert.deepEqual(scoreDraws([{available: true, stats: {
    receptions: 6, receiving_yards: 72, receiving_tds: 1, fumbles_lost_total: 1,
  }}], rules), [17.2]);
  assert.deepEqual(scoreDraws([{available: true, stats: {
    fg_made: 2, fg_made_50_59: 1, pat_made: 3,
  }}], rules), [11]);
  assert.throws(() => scoreDraws([{available: true, stats: {}}],
    {coefficients: {tackles: 1}}), /tackles/);
});

test('optimizer matches Python superflex tie rule and honors fixed slots', async () => {
  const {optimize} = await decision;
  const roster = [
    {player_id: 'qb-b', position: 'QB'}, {player_id: 'qb-a', position: 'QB'},
    {player_id: 'rb', position: 'RB'}, {player_id: 'defense', position: 'DST'},
  ];
  const slots = [
    {slot_id: 'DST', eligible_positions: ['DST'], modeled: false},
    {slot_id: 'QB', eligible_positions: ['QB']},
    {slot_id: 'SUPERFLEX', eligible_positions: ['QB', 'RB', 'WR', 'TE']},
  ];
  assert.deepEqual(optimize(roster, slots,
    {'qb-a': 20, 'qb-b': 20, rb: 14}, {DST: 'defense'}),
    {DST: 'defense', QB: 'qb-a', SUPERFLEX: 'qb-b'});
  assert.throws(() => optimize(roster, slots, {'qb-a': 20, 'qb-b': 20, rb: 14}, {}),
    /DST/);
  assert.throws(() => optimize([roster[0], roster[0]],
    [slots[1]], {'qb-b': 20}, {}), /duplicate player ID/);
});

test('optimizer excludes bye and started players from new picks', async () => {
  const {optimize} = await decision;
  const roster = [
    {player_id: 'bye', position: 'RB', on_bye: true},
    {player_id: 'started', position: 'RB', locked: true},
    {player_id: 'ready', position: 'RB'},
  ];
  const slots = [{slot_id: 'RB', eligible_positions: ['RB']}];
  assert.deepEqual(optimize(roster, slots, {bye: 30, started: 20, ready: 1}, {}),
    {RB: 'ready'});
  assert.deepEqual(optimize(roster, slots, {bye: 30, started: 20, ready: 1},
    {RB: 'started'}), {RB: 'started'});
  assert.throws(() => optimize([
    {player_id: 'started', position: 'RB', locked: true, locked_slot: 'RB'},
    {player_id: 'ready', position: 'RB'},
  ], [{slot_id: 'SUPERFLEX', eligible_positions: ['RB']}],
  {started: 20, ready: 1}, {SUPERFLEX: 'started'}), /original slot/);
});

test('paired comparison keeps correlation at the same draw indices', async () => {
  const {compare} = await decision;
  assert.deepEqual(compare([10, 0, 10], [0, 10, 10]), {
    meanDifference: 0, interval80: [-8, 8], probabilityA: 1 / 3,
  });
  assert.throws(() => compare([1, 2], [1]), /draw count/);
});

function stat(targets, catches, yards, touchdowns = 0) {
  return {targets, receptions: catches, receiving_yards: yards,
    receiving_tds: touchdowns, carries: 0, rushing_yards: 0, rushing_tds: 0};
}

function snapshot() {
  return {
    manifest: {schema_version: 1, draw_count: 2,
      games: {a: {kickoff_utc: '2026-10-04T17:00:00Z'},
        b: {kickoff_utc: '2026-10-04T17:00:00Z'}}},
    shards: [{team: 'NE', team_opportunity: [
      {targets: 10, carries: 0, attempts: 12, other_attempts: 12, fg_att: 0, pat_att: 0},
      {targets: 10, carries: 0, attempts: 12, other_attempts: 12, fg_att: 0, pat_att: 0},
    ], players: {
      a: {player_id: 'a', team: 'NE', position: 'WR', injury_status: 'Questionable',
        draws: [{available: true, stats: stat(6, 4, 40, 1)},
          {available: false, stats: stat(0, 0, 0)}]},
      b: {player_id: 'b', team: 'NE', position: 'WR', injury_status: 'Unknown',
        draws: [{available: true, stats: stat(4, 2, 20)},
          {available: true, stats: stat(10, 6, 60)}]},
    }}],
  };
}

const roster = [{player_id: 'a', position: 'WR', team: 'NE'},
  {player_id: 'b', position: 'WR', team: 'NE'}];
const slots = [{slot_id: 'WR', eligible_positions: ['WR']}];
const simpleRules = {coefficients: {receiving_yards: 0.1, receptions: 1,
  receiving_tds: 6}};

test('share scenario conserves target counts and keeps official draws frozen', async () => {
  const {explore} = await scenarios;
  const official = snapshot();
  const before = JSON.stringify(official);
  const result = explore(official, roster, slots, simpleRules, {a: 'a', b: 'b'},
    {type: 'target-share', playerId: 'a', share: 0.8});
  assert.equal(JSON.stringify(official), before);
  assert.equal(result.assumptionLabel, 'Assume a receives 80% of team targets if active');
  assert.equal(result.scenarioProbability, null);
  assert.equal(result.officialLineup.WR, 'b');
  assert.equal(result.scenarioSnapshot.shards[0].players.a.draws[0].stats.targets, 8);
  assert.equal(result.scenarioSnapshot.shards[0].players.a.draws[0].stats.receptions, 5);
  assert.equal(result.scenarioSnapshot.shards[0].players.a.draws[0].stats.receiving_yards, 50);
  assert.equal(result.scenarioSnapshot.shards[0].players.b.draws[0].stats.targets, 2);
  for (let i = 0; i < 2; i++) {
    const players = result.scenarioSnapshot.shards[0].players;
    assert.equal(players.a.draws[i].stats.targets + players.b.draws[i].stats.targets, 10);
    assert.ok(players.a.draws[i].stats.receptions <= players.a.draws[i].stats.targets);
  }
});

test('availability scenarios preserve teams and active-normal restores a questionable player', async () => {
  const {explore} = await scenarios;
  const out = explore(snapshot(), roster, slots, simpleRules, {a: 'a', b: 'b'},
    {type: 'out', playerId: 'a'});
  assert.equal(out.scenarioSnapshot.shards[0].players.a.draws[0].stats.targets, 0);
  assert.equal(out.scenarioSnapshot.shards[0].players.b.draws[0].stats.targets, 10);
  const active = explore(snapshot(), roster, slots, simpleRules, {a: 'a', b: 'b'},
    {type: 'active-normal', playerId: 'a'});
  assert.equal(active.scenarioSnapshot.shards[0].players.a.draws[1].available, true);
  assert.ok(active.scenarioSnapshot.shards[0].players.a.draws[1].stats.targets > 0);
  assert.equal(active.scenarioSnapshot.shards[0].players.a.draws[1].stats.targets
    + active.scenarioSnapshot.shards[0].players.b.draws[1].stats.targets, 10);
});

test('share exploration reports an estimated flip threshold', async () => {
  const {explore} = await scenarios;
  const result = explore(snapshot(), roster, slots, simpleRules, {a: 'a', b: 'b'},
    {type: 'target-share', playerId: 'a', share: 0.8});
  assert.ok(result.flipThreshold > 0 && result.flipThreshold < 1);
});

test('unsupported scenario and incompatible share are rejected', async () => {
  const {explore} = await scenarios;
  assert.throws(() => explore(snapshot(), roster, slots, simpleRules,
    {a: 'a', b: 'b'}, {type: 'weather', playerId: 'a'}), /unsupported scenario/);
  const ineligible = snapshot();
  ineligible.shards[0].players.a.position = 'K';
  assert.throws(() => explore(ineligible, roster, slots, simpleRules,
    {a: 'a', b: 'b'}, {type: 'carry-share', playerId: 'a', share: 0.5}), /ineligible/);
  assert.throws(() => explore(snapshot(), roster, slots, simpleRules,
    {a: 'a', b: 'b'}, {type: 'target-share', playerId: 'a', share: 1.2}), /share/);
  assert.throws(() => explore(snapshot(),
    [{...roster[0], locked: true}, roster[1]], slots, simpleRules,
    {a: 'a', b: 'b'}, {type: 'out', playerId: 'a'}), /locked/);
});

test('carry-share reallocates rushing production at the same team volume', async () => {
  const {explore} = await scenarios;
  const rushing = snapshot();
  const shard = rushing.shards[0];
  for (const player of Object.values(shard.players)) player.position = 'RB';
  shard.team_opportunity[0].targets = 0;
  shard.team_opportunity[0].carries = 10;
  shard.team_opportunity[1].targets = 0;
  shard.team_opportunity[1].carries = 10;
  shard.players.a.draws[0].stats = {...stat(0, 0, 0), carries: 6,
    rushing_yards: 30, rushing_tds: 1};
  shard.players.b.draws[0].stats = {...stat(0, 0, 0), carries: 4,
    rushing_yards: 20, rushing_tds: 0};
  shard.players.b.draws[1].stats = {...stat(0, 0, 0), carries: 10,
    rushing_yards: 50, rushing_tds: 0};
  const rbRoster = roster.map((item) => ({...item, position: 'RB'}));
  const result = explore(rushing, rbRoster,
    [{slot_id: 'RB', eligible_positions: ['RB']}],
    {coefficients: {rushing_yards: 0.1, rushing_tds: 6}},
    {a: 'a', b: 'b'}, {type: 'carry-share', playerId: 'a', share: 0.8});
  const players = result.scenarioSnapshot.shards[0].players;
  assert.equal(players.a.draws[0].stats.carries, 8);
  assert.equal(players.a.draws[0].stats.rushing_yards, 40);
  assert.equal(players.b.draws[0].stats.carries, 2);
});

test('out kicker preserves team kicks and active-normal restores conditional kicks', async () => {
  const {explore} = await scenarios;
  const kicking = {manifest: {schema_version: 1, draw_count: 2}, shards: [
    {team: 'NE', team_opportunity: [
      {targets: 0, carries: 0, attempts: 0, other_attempts: 0, fg_att: 2, pat_att: 3},
      {targets: 0, carries: 0, attempts: 0, other_attempts: 0, fg_att: 0, pat_att: 0},
    ], players: {k: {player_id: 'k', team: 'NE', position: 'K', injury_status: 'Questionable',
      draws: [{available: true, stats: {fg_att: 2, fg_made: 2, fg_made_30_39: 2,
        fg_missed: 0, pat_att: 3, pat_made: 3, pat_missed: 0}},
      {available: false, stats: {fg_att: 0, fg_made: 0, fg_made_30_39: 0,
        fg_missed: 0, pat_att: 0, pat_made: 0, pat_missed: 0}}]} }},
    {team: 'NYJ', team_opportunity: [
      {targets: 0, carries: 0, attempts: 0, other_attempts: 0, fg_att: 1, pat_att: 1},
      {targets: 0, carries: 0, attempts: 0, other_attempts: 0, fg_att: 1, pat_att: 1},
    ], players: {reserve: {player_id: 'reserve', team: 'NYJ', position: 'K',
      injury_status: 'Unknown', draws: [
        {available: true, stats: {fg_att: 1, fg_made: 1, pat_att: 1, pat_made: 1}},
        {available: true, stats: {fg_att: 1, fg_made: 1, pat_att: 1, pat_made: 1}},
      ]}}},
  ]};
  const kickerRoster = [{player_id: 'k', position: 'K'},
    {player_id: 'reserve', position: 'K'}];
  const kickerSlots = [{slot_id: 'K', eligible_positions: ['K']}];
  const kickerRules = {coefficients: {fg_made: 3, pat_made: 1}};
  const out = explore(kicking, kickerRoster, kickerSlots, kickerRules,
    {a: 'k', b: 'reserve'}, {type: 'out', playerId: 'k'});
  assert.equal(out.scenarioLineup.K, 'reserve');
  assert.equal(out.scenarioSnapshot.shards[0].team_opportunity[0].unassigned_fg_att, 2);
  const active = explore(kicking, kickerRoster, kickerSlots, kickerRules,
    {a: 'k', b: 'reserve'}, {type: 'active-normal', playerId: 'k'});
  assert.equal(active.scenarioSnapshot.shards[0].players.k.draws[1].stats.fg_att, 2);
  assert.equal(active.scenarioSnapshot.shards[0].team_opportunity[1].fg_att, 2);
  const limited = explore(kicking, kickerRoster, kickerSlots, kickerRules,
    {a: 'k', b: 'reserve'},
    {type: 'active-limited', playerId: 'k', workloadFraction: 0.5});
  assert.equal(limited.scenarioSnapshot.shards[0].players.k.draws[0].stats.fg_att, 1);
});

test('exploration honors user-fixed slots and does not publish uncalibrated probabilities', async () => {
  const {explore} = await scenarios;
  const withDefense = [...roster, {player_id: 'dst', position: 'DST'}];
  const withFixedSlot = [{slot_id: 'DST', eligible_positions: ['DST'], modeled: false}, ...slots];
  const result = explore(snapshot(), withDefense, withFixedSlot, simpleRules,
    {a: 'a', b: 'b', locks: {DST: 'dst'}}, {type: 'out', playerId: 'a'});
  assert.equal(result.officialLineup.DST, 'dst');
  assert.equal(result.scenarioLineup.DST, 'dst');
  assert.equal(result.officialComparison.probabilityA, null);
  assert.equal(result.scenarioComparison.probabilityA, null);
});

test('zero target share removes receiving fumble exposure', async () => {
  const {explore} = await scenarios;
  const withFumble = snapshot();
  withFumble.shards[0].players.a.draws[0].stats.fumbles_lost_total = 1;
  const result = explore(withFumble, roster, slots, simpleRules,
    {a: 'a', b: 'b'}, {type: 'target-share', playerId: 'a', share: 0});
  assert.equal(result.scenarioSnapshot.shards[0].players.a.draws[0].stats.targets, 0);
  assert.equal(result.scenarioSnapshot.shards[0].players.a.draws[0].stats.fumbles_lost_total, 0);
});

test('flip threshold is absent when both compared players always start', async () => {
  const {explore} = await scenarios;
  const bothSlots = [{slot_id: 'WR1', eligible_positions: ['WR']},
    {slot_id: 'WR2', eligible_positions: ['WR']}];
  const result = explore(snapshot(), roster, bothSlots, simpleRules,
    {a: 'a', b: 'b'}, {type: 'target-share', playerId: 'a', share: 0.8});
  assert.equal(result.flipThreshold, null);
});

test('out assumption excludes a player even when every draw is already inactive', async () => {
  const {explore} = await scenarios;
  const allInactive = snapshot();
  for (const draw of allInactive.shards[0].players.a.draws) {
    draw.available = false;
    draw.stats = stat(0, 0, 0);
  }
  for (const [index, draw] of allInactive.shards[0].players.b.draws.entries()) {
    draw.stats = stat(10, 0, 0);
    allInactive.shards[0].team_opportunity[index].targets = 10;
  }
  const result = explore(allInactive, roster, slots, simpleRules,
    {a: 'a', b: 'b'}, {type: 'out', playerId: 'a'});
  assert.equal(result.scenarioLineup.WR, 'b');
});

test('active scenario restores pass volume when a zero-volume draw gains targets', async () => {
  const {explore} = await scenarios;
  const zero = snapshot();
  const totals = zero.shards[0].team_opportunity[1];
  totals.targets = 0;
  totals.attempts = 0;
  totals.other_attempts = 0;
  zero.shards[0].players.b.draws[1].stats = stat(0, 0, 0);
  const result = explore(zero, roster, slots, simpleRules,
    {a: 'a', b: 'b'}, {type: 'active-normal', playerId: 'a'});
  const restored = result.scenarioSnapshot.shards[0].team_opportunity[1];
  assert.ok(restored.targets > 0);
  assert.ok(restored.attempts >= restored.targets);
  assert.equal(restored.other_attempts, restored.attempts);
  assert.match(result.assumptionDetails, /team volume.*active draw/);
});
