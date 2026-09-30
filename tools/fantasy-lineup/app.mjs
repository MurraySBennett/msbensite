import {SUPPORTED_STATS, scoreDraws, optimize, compare} from './decision.mjs';
import {explore} from './scenarios.mjs';
import {evaluateWeek, aggregateResults} from './evaluation.mjs';
import {validateConfig, beginWeek, saveInitial, freezeAdvice, saveFinal, saveWeek,
  readWeek, exportRecords, importRecords} from './state.mjs';

const ROOT = '/tools/fantasy-lineup/';
const CACHE_DB = 'fantasy-lineup-snapshot-v1';
const STORE_KEY = 'fantasy-lineup:v1';
const $ = id => document.getElementById(id);
let snapshot = null, record = null, config = null, model = null, pair = null;
const slotKinds = [['QB', ['QB'], 1], ['RB', ['RB'], 2], ['WR', ['WR'], 2],
  ['TE', ['TE'], 1], ['FLEX', ['RB', 'WR', 'TE'], 1],
  ['SUPERFLEX', ['QB', 'RB', 'WR', 'TE'], 0], ['K', ['K'], 1]];
const scoring = [
  ['receptions', 'Points per reception', 1], ['passing_yards', 'Passing yard', .04],
  ['passing_tds', 'Passing TD', 4], ['passing_interceptions', 'Interception', -2],
  ['rushing_yards', 'Rushing yard', .1], ['rushing_tds', 'Rushing TD', 6],
  ['receiving_yards', 'Receiving yard', .1], ['receiving_tds', 'Receiving TD', 6],
  ['fumbles_lost_total', 'Fumble lost', -2], ['fg_made', 'Field goal made', 3],
  ['pat_made', 'Extra point made', 1],
  ...[...SUPPORTED_STATS].filter(x => !['receptions', 'passing_yards', 'passing_tds',
    'passing_interceptions', 'rushing_yards', 'rushing_tds', 'receiving_yards',
    'receiving_tds', 'fumbles_lost_total', 'fg_made', 'pat_made'].includes(x))
    .map(x => [x, x.replaceAll('_', ' '), 0])];
function node(tag, text = '', attrs = {}) {
  const element = document.createElement(tag);
  element.textContent = text;
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  return element;
}
function notice(message) { $('notice').textContent = message; }
function errorAt(id, error) { $(id).textContent = error.message || String(error); }
function show(view) {
  for (const section of document.querySelectorAll('.pilot-view')) section.hidden = section.id !== view;
  for (const button of document.querySelectorAll('[data-view]')) {
    if (button.dataset.view === view) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  }
  $(`${view}-title`).focus?.();
}
function displayName(player) { return `${player.name} · ${player.team} ${player.position} · ${player.player_id}`; }
function allPlayers() { return snapshot.shards.flatMap(shard => Object.values(shard.players)); }
function byId(id) { return allPlayers().find(player => player.player_id === id); }
function iso(value) { return value ? new Date(value).toLocaleString() : 'Unknown'; }
function safePath(path) { return /^versions\/[a-zA-Z0-9-]+\/[a-zA-Z0-9.-]+\.json$/.test(path); }
function validateSnapshot(candidate) {
  const {manifest, shards} = candidate;
  if (manifest.schema_version !== 1 || !Number.isInteger(manifest.season) ||
      !Number.isInteger(manifest.week) || !Number.isFinite(Date.parse(manifest.cutoff_utc)) ||
      !Number.isFinite(Date.parse(manifest.generated_at)) ||
      typeof manifest.model_version !== 'string' || !manifest.model_version ||
      !manifest.games || typeof manifest.games !== 'object' ||
      !manifest.sources || typeof manifest.sources !== 'object' ||
      !Number.isInteger(manifest.draw_count) || manifest.draw_count < 1 ||
      !Array.isArray(manifest.supported_stat_fields) || !Array.isArray(shards) || !shards.length) {
    throw new Error('invalid snapshot manifest');
  }
  const ids = new Set();
  for (const shard of shards) {
    if (!Array.isArray(shard.team_opportunity) || shard.team_opportunity.length !== manifest.draw_count) throw new Error('invalid team draws');
    for (const [id, player] of Object.entries(shard.players || {})) {
    if (ids.has(id) || id !== player.player_id || player.team !== shard.team ||
        typeof player.name !== 'string' || typeof player.position !== 'string' ||
        !Array.isArray(player.draws) || player.draws.length !== manifest.draw_count ||
        !manifest.games[id] || !Number.isFinite(Date.parse(manifest.games[id].kickoff_utc)) ||
        player.injury_issued_at && (!Number.isFinite(Date.parse(player.injury_issued_at)) ||
          Date.parse(player.injury_issued_at) > Date.parse(manifest.cutoff_utc)) ||
        player.draws.some(draw => typeof draw.available !== 'boolean' || !draw.stats ||
          Object.values(draw.stats).some(value => !Number.isFinite(value) || value < 0))) {
      throw new Error(`invalid snapshot player: ${id}`);
    }
    ids.add(id);
    }
  }
}
function cacheSnapshot(value, key = 'last-good') {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('snapshots');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('snapshots', value === undefined ? 'readonly' : 'readwrite');
      const store = transaction.objectStore('snapshots');
      const operation = value === undefined ? store.get(key) : null;
      if (value !== undefined) {
        store.put(value, 'last-good');
        store.put(value, value.manifest.manifest_sha256);
      }
      transaction.oncomplete = () => { resolve(value === undefined ? operation.result : value); db.close(); };
      transaction.onerror = () => { reject(transaction.error); db.close(); };
    };
  });
}
async function verifiedJson(path, expectedHash, base = ROOT) {
  if (!safePath(path)) throw new Error('invalid snapshot path');
  const response = await fetch(base + path, {cache: 'no-store'});
  if (!response.ok) throw new Error(`snapshot request failed: ${response.status}`);
  const bytes = await response.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  if (hex !== expectedHash) throw new Error('snapshot checksum failed');
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function loadSnapshot() {
  try {
    const response = await fetch(ROOT + 'current.json', {cache: 'no-store'});
    if (!response.ok) throw new Error(`snapshot pointer unavailable: ${response.status}`);
    const pointer = await response.json();
    if (pointer.schema_version !== 1 || !/^[a-f0-9]{64}$/.test(pointer.manifest_sha256)) throw new Error('invalid snapshot pointer');
    const manifest = await verifiedJson(pointer.manifest, pointer.manifest_sha256);
    if (manifest.schema_version !== 1 || !Array.isArray(manifest.shards) || !manifest.shards.length) throw new Error('invalid snapshot manifest');
    const shards = await Promise.all(manifest.shards.map(async part => {
      const shard = await verifiedJson(part.path, part.sha256);
      if (shard.team !== part.team || Object.keys(shard.players || {}).length !== part.player_count) throw new Error('invalid snapshot shard');
      return shard;
    }));
    const candidate = {manifest: {...manifest, manifest_sha256: pointer.manifest_sha256}, shards};
    validateSnapshot(candidate);
    snapshot = candidate;
    try { await cacheSnapshot(snapshot); }
    catch (error) { notice(`Verified snapshot loaded, but its offline cache could not be saved (${error.message}).`); }
  } catch (error) {
    try {
      const cached = await cacheSnapshot();
      if (cached?.manifest?.schema_version === 1 && Array.isArray(cached.shards)) snapshot = cached;
    } catch { /* Keep records available even if the cache is malformed. */ }
    notice(snapshot ? `Latest snapshot failed (${error.message}). Using the last good dated snapshot.` :
      `Snapshot unavailable (${error.message}). Saved records are still available in Results.`);
  }
}
function renderSetup() {
  if (!snapshot) { $('snapshot-meta').textContent = 'No verified snapshot is available. You can still open Results.'; return; }
  const manifest = snapshot.manifest;
  $('snapshot-meta').textContent = `Season ${manifest.season}, week ${manifest.week}. Data cutoff ${iso(manifest.cutoff_utc)}; generated ${iso(manifest.generated_at)}. Injury status is reported only when a dated source has it.`;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}').config; }
  catch { notice('Stored records are damaged. Results and Import remain available for recovery.'); }
  const selected = new Set(saved?.roster?.map(p => p.player_id) || []);
  $('roster-options').replaceChildren(...allPlayers().sort((a, b) => displayName(a).localeCompare(displayName(b))).map(player => {
    const label = node('label', '', {class: 'check-row'});
    const input = node('input', '', {type: 'checkbox', name: 'roster', value: player.player_id});
    input.checked = selected.has(player.player_id);
    label.append(input, document.createTextNode(`${displayName(player)} · injury ${player.injury_status || 'Unknown'} (issued ${iso(player.injury_issued_at)})`));
    return label;
  }));
  $('slot-counts').replaceChildren(...slotKinds.map(([kind, , initial]) => {
    const wrap = node('div');
    const label = node('label', `${kind} slots`, {for: `slot-${kind}`});
    const input = node('input', '', {id: `slot-${kind}`, type: 'number', min: '0', max: '4', step: '1'});
    input.value = saved ? saved.slots.filter(slot => slot.slot_id === kind || slot.slot_id.startsWith(`${kind}-`)).length : initial;
    wrap.append(label, input); return wrap;
  }));
  $('fixed-dst').value = saved?.roster?.find(p => p.position === 'DST')?.name || '';
  $('scoring-fields').replaceChildren(...scoring.map(([field, labelText, value]) => {
    const wrap = node('div');
    const label = node('label', `${labelText} (${field})`, {for: `score-${field}`});
    const input = node('input', '', {id: `score-${field}`, type: 'number', step: 'any'});
    input.value = saved?.rules?.coefficients?.[field] ?? value;
    wrap.append(label, input); return wrap;
  }));
}
function configFromForm() {
  if (!$('scoring-confirmed').checked) throw new Error('Confirm the scoring values against your league rules.');
  const ids = [...document.querySelectorAll('input[name=roster]:checked')].map(input => input.value);
  const roster = ids.map(id => { const player = byId(id); return {player_id: id, name: player.name, position: player.position, team: player.team}; });
  const slots = [];
  for (const [kind, eligible] of slotKinds) {
    const count = Number($(`slot-${kind}`).value);
    if (!Number.isInteger(count) || count < 0 || count > 4) throw new Error(`Invalid ${kind} slot count.`);
    for (let i = 1; i <= count; i++) slots.push({slot_id: `${kind}-${i}`, eligible_positions: eligible, modeled: true});
  }
  const fixedName = $('fixed-dst').value.trim();
  if (fixedName) {
    const id = `fixed-dst:${fixedName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    roster.push({player_id: id, name: fixedName, team: fixedName, position: 'DST'});
    slots.push({slot_id: 'DST-1', eligible_positions: ['DST'], modeled: false, fixed_player_id: id});
  }
  const coefficients = Object.fromEntries(scoring.map(([field]) => [field, Number($(`score-${field}`).value)]));
  if ($('other-scoring').value.trim()) throw new Error(`Unsupported scoring component: ${$('other-scoring').value.trim()}. Advice cannot be generated for this rule.`);
  for (const [field] of scoring) if ($(`score-${field}`).value.trim() === '') throw new Error(`Enter a coefficient for ${field}; use 0 if unused.`);
  const result = {schema_version: 1, roster, slots, rules: {coefficients}};
  const validation = validateConfig(result, snapshot.manifest);
  if (!validation.valid) throw new Error(validation.errors.join('; '));
  return result;
}
function rosterForDecision() {
  const now = Date.now();
  return record.roster.map(player => ({...player,
    locked: Boolean(record.game_locks[player.player_id] && Date.parse(record.game_locks[player.player_id]) <= now),
    on_bye: player.on_bye || byId(player.player_id)?.injury_status?.toLowerCase() === 'out'}));
}
function pointModel() {
  const draws = {}, means = {};
  for (const player of rosterForDecision()) {
    if (player.position === 'DST' || player.on_bye) continue;
    const forecast = byId(player.player_id);
    if (!forecast) throw new Error(`Missing forecast for ${displayName(player)}.`);
    draws[player.player_id] = scoreDraws(forecast.draws, record.rules);
    means[player.player_id] = draws[player.player_id].reduce((a, b) => a + b, 0) / draws[player.player_id].length;
  }
  return {draws, means};
}
function optionsFor(slot, retainedId = null) {
  return record.roster.filter(player => slot.eligible_positions.includes(player.position) &&
    !player.on_bye && byId(player.player_id)?.injury_status?.toLowerCase() !== 'out' &&
    (player.player_id === retainedId || !(record.game_locks[player.player_id] &&
      Date.parse(record.game_locks[player.player_id]) <= Date.now())));
}
function lineupFields(target, prefix, chosen = {}) {
  $(target).replaceChildren();
  const grid = node('div', '', {class: 'lineup-grid'});
  for (const slot of record.slots) {
    const wrap = node('div');
    const label = node('label', slot.slot_id, {for: `${prefix}-${slot.slot_id}`});
    const select = node('select', '', {id: `${prefix}-${slot.slot_id}`, 'data-slot': slot.slot_id});
    select.append(node('option', 'Select player', {value: ''}));
    for (const player of optionsFor(slot, chosen[slot.slot_id])) select.append(node('option', displayName(player), {value: player.player_id}));
    select.value = chosen[slot.slot_id] || slot.fixed_player_id || '';
    if (slot.modeled === false) select.disabled = true;
    wrap.append(label, select); grid.append(wrap);
  }
  $(target).append(grid);
}
function readLineup(prefix) { return Object.fromEntries(record.slots.map(slot =>
  [slot.slot_id, slot.fixed_player_id || $(`${prefix}-${slot.slot_id}`).value])); }
function validateLineupHere(lineup) {
  if (Object.values(lineup).some(id => !id)) throw new Error('Fill every starting slot.');
  if (new Set(Object.values(lineup)).size !== Object.values(lineup).length) throw new Error('A player can start only once.');
}
function swapsFor(lineup) {
  const started = new Set(Object.values(lineup));
  return record.slots.filter(slot => slot.modeled !== false && lineup[slot.slot_id]).map(slot => ({
    slot, starter: record.roster.find(p => p.player_id === lineup[slot.slot_id]),
    bench: optionsFor(slot).filter(p => !started.has(p.player_id)),
  })).filter(item => item.starter && item.bench.length);
}
function choosePair(lineup) {
  const first = swapsFor(lineup)[0];
  return first ? {a: first.starter.player_id, b: first.bench[0].player_id} : null;
}
function updatePairChoices() {
  const lineup = readLineup('initial');
  const swaps = swapsFor(lineup);
  const previousSlot = $('comparison-slot')?.value;
  const previousBench = $('comparison-b')?.value;
  $('initial-pair').replaceChildren();
  if (!swaps.length) {
    pair = null;
    $('initial-pair').textContent = 'Choose a lineup with an eligible bench alternative to record a close call.';
    $('initial-probability').disabled = true;
    return;
  }
  const slotLabel = node('label', 'Starter to compare (A)', {for: 'comparison-slot'});
  const slotSelect = node('select', '', {id: 'comparison-slot'});
  for (const item of swaps) slotSelect.append(node('option', `${item.slot.slot_id}: ${displayName(item.starter)}`, {value: item.slot.slot_id}));
  slotSelect.value = swaps.some(item => item.slot.slot_id === previousSlot) ? previousSlot : swaps[0].slot.slot_id;
  const benchLabel = node('label', 'Eligible bench alternative (B)', {for: 'comparison-b'});
  const benchSelect = node('select', '', {id: 'comparison-b'});
  function updateBench() {
    const item = swaps.find(entry => entry.slot.slot_id === slotSelect.value);
    benchSelect.replaceChildren(...item.bench.map(p => node('option', displayName(p), {value: p.player_id})));
    benchSelect.value = item.bench.some(p => p.player_id === previousBench) ? previousBench : item.bench[0].player_id;
    pair = {a: item.starter.player_id, b: benchSelect.value};
  }
  slotSelect.addEventListener('change', updateBench);
  benchSelect.addEventListener('change', () => {
    const item = swaps.find(entry => entry.slot.slot_id === slotSelect.value);
    pair = {a: item.starter.player_id, b: benchSelect.value};
  });
  $('initial-pair').append(slotLabel, slotSelect, benchLabel, benchSelect);
  $('initial-probability').disabled = false;
  updateBench();
}
function pairLabel() { return pair ? `A: ${displayName(record.roster.find(p => p.player_id === pair.a))}; B: ${displayName(record.roster.find(p => p.player_id === pair.b))}.` : 'No eligible comparison pair.'; }
function comparisonChoice(id) {
  if (!pair) return [];
  const percent = Number($(id).value);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100 || $(id).value === '') throw new Error('Enter a chance from 0 to 100%.');
  return [{...pair, probability: percent / 100}];
}
function renderPick() {
  const context = node('ul', '', {class: 'context-list'});
  for (const player of record.roster.filter(p => p.position !== 'DST')) {
    const forecast = byId(player.player_id);
    const game = snapshot.manifest.games[player.player_id];
    context.append(node('li', `${displayName(player)} — injury ${forecast?.injury_status || 'Unknown'}; report issued ${iso(forecast?.injury_issued_at)}; lock ${iso(game?.kickoff_utc)}.`));
  }
  $('pick-context').replaceChildren(node('p', `Source cutoff ${iso(record.data_cutoff_utc)}. No projected points are shown until you freeze or skip your pick.`), context);
  lineupFields('initial-slots', 'initial', record.initial?.lineup || {});
  updatePairChoices();
}
function fmt(value) { return Number(value).toFixed(1); }
function range(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = p => { const n = (sorted.length - 1) * p, low = Math.floor(n), high = Math.ceil(n); return sorted[low] + (sorted[high] - sorted[low]) * (n - low); };
  return `${fmt(at(.1))} to ${fmt(at(.9))}`;
}
function makeAdvice() {
  model = pointModel();
  const roster = rosterForDecision();
  const locks = Object.fromEntries(record.slots.filter(slot => slot.modeled === false).map(slot => [slot.slot_id, slot.fixed_player_id]));
  const lineup = optimize(roster, record.slots, model.means, locks);
  if (!record.initial) pair = choosePair(lineup);
  const comparisons = pair ? [{...pair, probabilityA: null}] : [];
  record = freezeAdvice(record, {lineup, comparisons, calibrated: false,
    model_version: record.model_version, player_means: model.means}, new Date().toISOString());
  saveWeek(record, localStorage);
}
function renderCompare() {
  pair = record.initial?.comparisons?.[0] || record.advice.comparisons?.[0] || choosePair(record.advice.lineup);
  model = pointModel();
  const card = $('advice-card'); card.replaceChildren();
  const lineup = record.advice.lineup;
  card.append(node('h3', 'Frozen model lineup'));
  const list = node('ul');
  for (const slot of record.slots) list.append(node('li', `${slot.slot_id}: ${displayName(record.roster.find(p => p.player_id === lineup[slot.slot_id]))}${slot.modeled === false ? ' (user fixed; excluded from forecast)' : ''}`));
  card.append(list);
  const total = model.draws[Object.values(lineup).find(id => model.draws[id])]?.map((_, i) =>
    Object.entries(lineup).reduce((sum, [slotId, id]) => sum + (record.slots.find(s => s.slot_id === slotId).modeled === false ? 0 : model.draws[id][i]), 0)) || [];
  const dl = node('dl');
  const rows = [
    ['Expected points', total.length ? `${fmt(total.reduce((a, b) => a + b, 0) / total.length)} modeled points` : 'Unavailable'],
    ['80% interval', total.length ? `${range(total)} modeled points (raw, uncalibrated)` : 'Unavailable'],
    ['P(A>B)', 'Unavailable until calibration; no validated win probability'],
    ['Decision band', 'Uncertain — calibration and backtest pending'],
    ['Source cutoff', iso(record.data_cutoff_utc)], ['Advice frozen', iso(record.advice.frozen_at)],
    ['Model', record.model_version], ['Source capture', Object.entries(record.sources).map(([name, source]) =>
      `${name}: ${iso(source?.retrieved_at || source?.captured_at || source?.cutoff_utc)}`).join('; ') || 'Unknown'],
    ['Lock time', record.roster.filter(p => p.position !== 'DST').map(p => `${p.name}: ${iso(record.game_locks[p.player_id])}`).join('; ')],
    ['Injury status', record.roster.filter(p => p.position !== 'DST').map(p => { const f = byId(p.player_id); return `${p.name}: ${f?.injury_status || 'Unknown'} (issued ${iso(f?.injury_issued_at)})`; }).join('; ')],
  ];
  if (pair && model.draws[pair.a] && model.draws[pair.b]) {
    const result = compare(model.draws[pair.a], model.draws[pair.b]);
    rows.splice(3, 0, ['A versus B', `${pairLabel()} Expected A minus B: ${fmt(result.meanDifference)} points; 80% raw interval ${fmt(result.interval80[0])} to ${fmt(result.interval80[1])}.`]);
  }
  for (const [term, value] of rows) dl.append(node('dt', term), node('dd', value));
  card.append(dl, node('a', 'Read methods and evidence', {href: 'methods.html'}));
  lineupFields('final-slots', 'final', record.final?.lineup || lineup);
  $('final-pair').textContent = pairLabel();
  $('scenario-player').replaceChildren(...record.roster.filter(p => p.position !== 'DST' && !p.on_bye).map(p => node('option', displayName(p), {value: p.player_id})));
  updateOverrideFields();
}
function updateOverrideFields() {
  const old = Object.fromEntries([...$('override-fields').querySelectorAll('input')].map(input => [input.dataset.slot, input.value]));
  $('override-fields').replaceChildren(...record.slots.filter(slot =>
    $(`final-${slot.slot_id}`)?.value !== record.advice.lineup[slot.slot_id]).map(slot => {
    const wrap = node('div');
    const label = node('label', `Why change ${slot.slot_id}?`, {for: `reason-${slot.slot_id}`});
    const input = node('input', '', {id: `reason-${slot.slot_id}`, 'data-slot': slot.slot_id});
    input.value = old[slot.slot_id] || record.final?.override_reasons?.[slot.slot_id] || '';
    wrap.append(label, input); return wrap;
  }));
}
async function loadOutcomes(weeks) {
  const base = ROOT + 'outcomes/';
  const response = await fetch(base + 'current.json', {cache: 'no-store'});
  if (!response.ok) throw new Error(`outcome pointer unavailable: ${response.status}`);
  const pointer = await response.json();
  if (pointer.schema_version !== 1 || !/^[a-f0-9]{64}$/.test(pointer.manifest_sha256)) throw new Error('invalid outcome pointer');
  const manifest = await verifiedJson(pointer.manifest, pointer.manifest_sha256, base);
  if (manifest.schema_version !== 1 || !manifest.weeks || typeof manifest.weeks !== 'object') throw new Error('invalid outcome manifest');
  const loaded = new Map();
  for (const week of weeks) {
    const key = `${week.season}-${week.week}`;
    const manifestKey = `${key}:${week.snapshot_sha256}`;
    const descriptor = manifest.weeks[manifestKey];
    if (!descriptor) {
      if (Object.keys(manifest.weeks).some(candidate => candidate.startsWith(`${key}:`)))
        loaded.set(key, {error: 'different forecast snapshot'});
      continue;
    }
    try {
      const outcome = await verifiedJson(descriptor.path, descriptor.sha256, base);
      if (outcome.schema_version !== 1 || outcome.season !== week.season || outcome.week !== week.week) throw new Error('outcome week mismatch');
      loaded.set(key, {outcome, sha256: descriptor.sha256});
    } catch (error) { loaded.set(key, {error: error.message}); }
  }
  return loaded;
}
function resultsCard(item, observed) {
  const block = node('article', '', {class: 'advice-card'});
  block.append(node('h3', `Season ${item.season}, week ${item.week}`),
    node('p', `Cutoff ${iso(item.data_cutoff_utc)}. Unaided pick: ${item.unaided_skipped ? 'skipped' : item.initial ? 'saved' : 'pending'}. Model advice: ${item.advice ? 'frozen' : 'pending'}. Final pick: ${item.final ? 'saved' : 'pending'}.`));
  if (!observed || observed.error) {
    block.append(node('p', `Pending outcome data.${observed?.error ? ` Outcome file could not be verified: ${observed.error}.` : ''}`));
    return {block, result: null};
  }
  if (!item.snapshot_sha256 || observed.outcome.forecast_manifest_sha256 !== item.snapshot_sha256 ||
      observed.outcome.source?.status !== 'final') {
    block.append(node('p', 'Pending outcome data. Outcome file could not be verified against this frozen forecast or as final results.'));
    return {block, result: null};
  }
  let result;
  try { result = evaluateWeek(item, observed.outcome); }
  catch (error) {
    block.append(node('p', `Pending outcome data. Evaluation failed: ${error.message}.`));
    return {block, result: null};
  }
  if (result.status === 'pending') {
    block.append(node('p', `Pending outcome data for player IDs: ${result.missing_player_ids.join(', ')}. No missing score was treated as zero.`));
    return {block, result};
  }
  const points = result.realized_points;
  block.append(node('h4', 'Realized points'),
    node('p', `Unaided: ${points.initial == null ? 'not measured' : fmt(points.initial)}; model: ${points.model == null ? 'unavailable' : fmt(points.model)}; prelock final: ${points.final == null ? 'unavailable' : fmt(points.final)}.`),
    node('p', `Best legal modeled-slot lineup from this frozen roster: ${fmt(result.oracle_points)} points. Oracle regret — unaided ${result.regret.initial == null ? 'unavailable' : fmt(result.regret.initial)}, model ${result.regret.model == null ? 'unavailable' : fmt(result.regret.model)}, prelock final ${result.regret.final == null ? 'unavailable' : fmt(result.regret.final)}.`),
    node('p', result.fixed_slots_excluded.length ? `User-fixed slots excluded from these totals: ${result.fixed_slots_excluded.join(', ')}.` : 'All configured slots are modeled.'),
    node('p', result.override_direction ? `Final override ${result.override_direction}: ${result.override_points > 0 ? '+' : ''}${fmt(result.override_points)} realized points versus model.` : 'No prospective final versus model difference available.'));
  if (item.final?.excluded_from_prospective)
    block.append(node('p', `Latest saved final: ${fmt(result.latest_saved_final_points)} points, recorded late; the prelock final above remains the prospective choice.`));
  block.append(node('h4', 'Forecast quality'),
    node('p', result.forecast_quality ?
      `Roster mean absolute point error: ${fmt(result.forecast_quality.roster_mae)}. Model lineup predicted minus realized: ${fmt(result.forecast_quality.model_lineup_error)} points.` :
      'Unavailable for this record: no frozen player point estimates were saved.'));
  block.append(node('h4', 'Research inference'), node('p', result.prospective_eligible ?
    'Eligible for the personal-pilot paired comparison. One week cannot establish a general effect.' :
    `Excluded from unaided versus model inference: ${result.exclusion_reasons.join('; ')}.`));
  block.append(node('p', `Source ${observed.outcome.source?.name} (${observed.outcome.source?.licence}); version ${observed.sha256.slice(0, 12)}; retrieved ${iso(observed.outcome.source?.retrieved_at)}. A corrected outcome version can update these realized values without changing frozen picks.`));
  return {block, result};
}
async function renderResults() {
  $('saved-weeks').replaceChildren();
  let store;
  try { store = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); }
  catch { $('saved-weeks').textContent = 'Stored records cannot be read.'; return; }
  const weeks = Object.values(store.weeks || {}).sort((a, b) => b.season - a.season || b.week - a.week);
  if (!weeks.length) { $('saved-weeks').textContent = 'No saved weeks yet.'; return; }
  let observed = new Map();
  try { observed = await loadOutcomes(weeks); }
  catch (error) { $('saved-weeks').append(node('p', `Outcome snapshot unavailable (${error.message}). Saved choices remain available below.`)); }
  const results = [];
  for (const item of weeks) {
    const {block, result} = resultsCard(item, observed.get(`${item.season}-${item.week}`));
    $('saved-weeks').append(block);
    if (result) results.push(result);
  }
  const report = aggregateResults(results);
  const summary = node('section', '', {class: 'pilot-summary'});
  summary.append(node('h3', 'Personal-pilot summary'),
    node('p', `Eligible paired weeks: ${report.paired_weeks}. ${report.inference_note}`));
  if (report.paired_final_minus_model_ci95)
    summary.append(node('p', `Final minus model mean: ${fmt(report.paired_final_minus_model_mean)} points; 95% descriptive bootstrap interval ${fmt(report.paired_final_minus_model_ci95[0])} to ${fmt(report.paired_final_minus_model_ci95[1])}.`));
  if (report.calibration_bins) summary.append(node('p', `Final comparison probability calibration bins: ${report.calibration_bins.map(bin => `${Math.round(bin.range[0] * 100)}–${Math.round(bin.range[1] * 100)}%: ${bin.n} predictions, ${Math.round(bin.observed_rate * 100)}% observed`).join('; ')}.`));
  $('saved-weeks').append(summary);
}
function wireEvents() {
  for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', async () => {
    const view = button.dataset.view;
    if (view === 'results') await renderResults();
    if (view === 'pick' && record) renderPick();
    if (view === 'compare' && record?.advice) renderCompare();
    if (view === 'setup' || view === 'results' || view === 'pick' && record || view === 'compare' && record?.advice) show(view);
    else notice('Finish the earlier steps first.');
  });
  $('setup-form').addEventListener('submit', event => {
    event.preventDefault(); $('setup-errors').textContent = '';
    try {
      config = configFromForm();
      const existing = readWeek(snapshot.manifest.season, snapshot.manifest.week, localStorage);
      if (existing && (JSON.stringify(existing.roster.map(({on_bye, ...player}) => player)) !== JSON.stringify(config.roster) ||
          JSON.stringify(existing.slots) !== JSON.stringify(config.slots) ||
          JSON.stringify(existing.rules) !== JSON.stringify(config.rules))) {
        throw new Error('This week already has a frozen roster or scoring setup. Restore its saved configuration before continuing.');
      }
      record = beginWeek(config, snapshot.manifest, localStorage);
      if (record.advice) { renderCompare(); show('compare'); }
      else { renderPick(); show('pick'); }
    } catch (error) { errorAt('setup-errors', error); }
  });
  $('pick-form').addEventListener('submit', event => {
    event.preventDefault(); $('pick-errors').textContent = '';
    try {
      if (!record) throw new Error('Set up your roster first.');
      const lineup = readLineup('initial'); validateLineupHere(lineup);
      updatePairChoices();
      record = saveInitial(record, {lineup, comparisons: comparisonChoice('initial-probability'), external_forecast_seen: $('external-forecast').checked}, new Date().toISOString());
      saveWeek(record, localStorage); makeAdvice(); renderCompare(); show('compare');
    } catch (error) { errorAt('pick-errors', error); }
  });
  $('skip-pick').addEventListener('click', () => {
    $('pick-errors').textContent = '';
    try { if (!record) throw new Error('Set up your roster first.'); makeAdvice(); renderCompare(); show('compare'); }
    catch (error) { errorAt('pick-errors', error); }
  });
  $('initial-slots').addEventListener('change', updatePairChoices);
  $('final-slots').addEventListener('change', updateOverrideFields);
  $('final-form').addEventListener('submit', async event => {
    event.preventDefault(); $('final-errors').textContent = '';
    try {
      const lineup = readLineup('final'); validateLineupHere(lineup);
      const reasons = Object.fromEntries([...$('override-fields').querySelectorAll('input')].map(input => [input.dataset.slot, input.value]));
      record = saveFinal(record, {lineup, comparisons: comparisonChoice('final-probability'), override_reasons: reasons}, new Date().toISOString());
      saveWeek(record, localStorage); notice('Final pick saved in this browser.'); await renderResults(); show('results');
    } catch (error) { errorAt('final-errors', error); }
  });
  $('scenario-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const type = $('scenario-type').value, playerId = $('scenario-player').value;
      const fraction = Number($('scenario-value').value) / 100;
      const assumption = {type, playerId};
      if (type === 'active-limited') assumption.workloadFraction = fraction;
      if (type === 'target-share' || type === 'carry-share') assumption.share = fraction;
      const scenario = explore(snapshot, rosterForDecision(), record.slots, record.rules,
        {...(pair || {a: playerId, b: record.roster.find(p => p.player_id !== playerId)?.player_id}),
          locks: Object.fromEntries(record.slots.filter(s => s.modeled === false).map(s => [s.slot_id, s.fixed_player_id]))}, assumption);
      const result = $('scenario-result');
      result.replaceChildren(node('p', `${scenario.assumptionLabel}. Expected A minus B: ${fmt(scenario.scenarioComparison.meanDifference)} modeled points; raw 80% interval ${fmt(scenario.scenarioComparison.interval80[0])} to ${fmt(scenario.scenarioComparison.interval80[1])}.`),
        node('p', scenario.assumptionDetails), node('h3', 'Conditional legal lineup'));
      const list = node('ul');
      for (const [slotId, id] of Object.entries(scenario.scenarioLineup))
        list.append(node('li', `${slotId}: ${displayName(record.roster.find(p => p.player_id === id))}`));
      result.append(list, node('p', scenario.flipThreshold == null ?
        'No lineup flip threshold estimated for this comparison.' :
        `Estimated lineup flip threshold: ${Math.round(scenario.flipThreshold * 100)}% share under this assumption.`),
      node('p', 'Official frozen advice is unchanged. Probability unavailable until calibration.'));
    } catch (error) { errorAt('scenario-result', error); }
  });
  $('export-records').addEventListener('click', () => {
    try { const url = URL.createObjectURL(exportRecords(localStorage)); const link = node('a', '', {href: url, download: 'fantasy-lineup-private-records.json'}); link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    catch (error) { notice(error.message); }
  });
  $('import-records').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try { const result = importRecords(await file.text(), localStorage); notice(`Imported ${result.imported_weeks} weeks.`); await renderResults(); }
    catch (error) { notice(`Import failed: ${error.message}. Existing records were kept.`); }
  });
}
wireEvents();
await loadSnapshot();
if (snapshot) {
  try { record = readWeek(snapshot.manifest.season, snapshot.manifest.week, localStorage); }
  catch { notice('Stored records are damaged. Results and Import remain available for recovery.'); }
  if (record && record.snapshot_sha256 !== snapshot.manifest.manifest_sha256) {
    try {
      const frozen = await cacheSnapshot(undefined, record.snapshot_sha256);
      if (!frozen || frozen.manifest.manifest_sha256 !== record.snapshot_sha256) throw new Error('frozen snapshot is unavailable');
      validateSnapshot(frozen);
      snapshot = frozen;
      notice('This saved week uses its original dated snapshot. A newer same-week forecast cannot rewrite frozen advice.');
    } catch {
      snapshot = null;
      notice('The original snapshot for this saved week is unavailable. Saved records remain in Results; advice values cannot be reconstructed from a newer forecast.');
    }
  }
}
if (snapshot && Date.now() - Date.parse(snapshot.manifest.cutoff_utc) > 24 * 60 * 60 * 1000) {
  $('notice').textContent += `${$('notice').textContent ? ' ' : ''}The snapshot inputs are more than 24 hours old. Check injury and lock times before relying on this advice.`;
}
renderSetup();
if (snapshot) {
  if (record?.advice) { renderCompare(); show('compare'); }
  else if (record) { renderPick(); show('pick'); }
}
