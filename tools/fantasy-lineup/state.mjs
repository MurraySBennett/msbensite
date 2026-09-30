// Versioned browser-only records for a weekly fantasy decision.
import {SUPPORTED_STATS} from './decision.mjs';

const SCHEMA_VERSION = 1;
const STORAGE_KEY = 'fantasy-lineup:v1';
const MODELED_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K']);

function copy(value) { return structuredClone(value); }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function instant(value) {
  if (typeof value !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(value) ||
      !Number.isFinite(Date.parse(value))) throw new Error(`invalid UTC timestamp: ${value}`);
  return Date.parse(value);
}
function weekKey(season, week) { return `${season}-${week}`; }
function blankStore() { return {schema_version: SCHEMA_VERSION, config: null, weeks: {}}; }
function assertValid(result) {
  if (!result.valid) throw new Error(result.errors.join('; '));
}

export function validateConfig(config, manifest = null) {
  const errors = [];
  if (!object(config) || config.schema_version !== SCHEMA_VERSION) {
    return {valid: false, errors: ['unsupported config schema version']};
  }
  if (!Array.isArray(config.roster) || !config.roster.length) errors.push('roster is required');
  if (!Array.isArray(config.slots) || !config.slots.length) errors.push('starting slots are required');
  const roster = Array.isArray(config.roster) ? config.roster : [];
  const slots = Array.isArray(config.slots) ? config.slots : [];
  const ids = new Set();
  for (const player of roster) {
    if (!object(player) || typeof player.player_id !== 'string' || !player.player_id.trim()) {
      errors.push('player ID is required');
      continue;
    }
    if (ids.has(player.player_id)) errors.push(`duplicate player ID: ${player.player_id}`);
    ids.add(player.player_id);
    if (typeof player.name !== 'string' || !player.name.trim()) {
      errors.push(`name missing for player: ${player.player_id}`);
    }
    if (typeof player.position !== 'string' || !player.position.trim()) {
      errors.push(`position missing for player: ${player.player_id}`);
    }
  }
  const slotIds = new Set();
  const fixedIds = new Set();
  for (const slot of slots) {
    if (!object(slot) || typeof slot.slot_id !== 'string' || !slot.slot_id.trim()) {
      errors.push('invalid slot ID');
      continue;
    }
    if (slotIds.has(slot.slot_id)) errors.push(`duplicate slot ID: ${slot.slot_id}`);
    slotIds.add(slot.slot_id);
    if (!Array.isArray(slot.eligible_positions) || !slot.eligible_positions.length ||
        !slot.eligible_positions.every((position) => typeof position === 'string')) {
      errors.push(`invalid eligibility for slot: ${slot.slot_id}`);
      continue;
    }
    if (slot.modeled !== false && slot.eligible_positions.some((position) =>
      !MODELED_POSITIONS.has(position))) {
      errors.push(`unsupported position in modeled slot: ${slot.slot_id}`);
    }
    const candidates = roster.filter((player) =>
      slot.eligible_positions.includes(player.position));
    if (!candidates.length) errors.push(`no eligible player for slot: ${slot.slot_id}`);
    if (slot.modeled === false) {
      const fixed = roster.find((player) => player.player_id === slot.fixed_player_id);
      if (!fixed || !slot.eligible_positions.includes(fixed.position)) {
        errors.push(`user-fixed slot needs an eligible player: ${slot.slot_id}`);
      } else if (fixedIds.has(fixed.player_id)) {
        errors.push(`fixed player repeated: ${fixed.player_id}`);
      } else fixedIds.add(fixed.player_id);
    }
  }
  const coefficients = config.rules?.coefficients;
  if (!object(coefficients) || !Object.keys(coefficients).length) {
    errors.push('scoring coefficients are required');
  } else {
    const supported = manifest?.supported_stat_fields
      ? new Set(manifest.supported_stat_fields) : SUPPORTED_STATS;
    for (const [field, coefficient] of Object.entries(coefficients)) {
      if (!SUPPORTED_STATS.has(field) || !supported.has(field)) {
        errors.push(`unsupported scoring component: ${field}`);
      }
      if (!Number.isFinite(coefficient)) errors.push(`invalid scoring coefficient: ${field}`);
    }
  }
  return {valid: errors.length === 0, errors};
}

function readStore(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return blankStore();
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error('stored fantasy records are invalid JSON'); }
  validateEnvelope(parsed);
  return parsed;
}

function writeStore(store, storage) {
  // A single localStorage.setItem is atomic in browsers, including quota failure.
  storage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function validateEnvelope(value) {
  if (!object(value) || value.schema_version !== SCHEMA_VERSION) {
    throw new Error('unsupported storage schema version');
  }
  if (value.config !== null) assertValid(validateConfig(value.config));
  if (!object(value.weeks)) throw new Error('invalid week records');
  for (const [key, record] of Object.entries(value.weeks)) {
    if (!/^\d{4}-([1-9]|1[0-8])$/.test(key) || !object(record) ||
        record.schema_version !== SCHEMA_VERSION ||
        key !== weekKey(record.season, record.week) ||
        !Array.isArray(record.roster) || !Array.isArray(record.slots) ||
        !object(record.rules) || !object(record.game_locks) ||
        !object(record.sources) || !Array.isArray(record.revisions)) {
      throw new Error(`invalid week record: ${key}`);
    }
    instant(record.data_cutoff_utc);
    instant(record.generated_at);
    if (record.initial) validateChoice(record.initial, record);
    if (record.advice) {
      validateLineup(record.advice.lineup, record);
      validateModelComparisons(record.advice.comparisons, record,
        record.advice.calibrated === true);
      if (record.advice.player_means !== undefined &&
          (!object(record.advice.player_means) || Object.entries(record.advice.player_means).some(
            ([id, value]) => !record.roster.some((player) => player.player_id === id) ||
              !Number.isFinite(value)))) {
        throw new Error('invalid frozen player means');
      }
      if (record.initial && !samePairs(record.initial.comparisons,
        record.advice.comparisons)) {
        throw new Error('model advice must use the same comparison as the unaided choice');
      }
    }
    if (record.final) validateChoice(record.final, record);
    if (record.prelock_final) validateChoice(record.prelock_final, record);
    if (record.initial && record.final && !samePairs(record.initial.comparisons,
      record.final.comparisons)) {
      throw new Error('final must use the same comparison as the unaided choice');
    }
  }
}

export function saveConfig(config, storage) {
  assertValid(validateConfig(config));
  const store = readStore(storage);
  store.config = copy(config);
  writeStore(store, storage);
}

export function beginWeek(config, manifest, storage) {
  assertValid(validateConfig(config, manifest));
  if (manifest?.schema_version !== SCHEMA_VERSION ||
      !Number.isInteger(manifest.season) || !Number.isInteger(manifest.week) ||
      !object(manifest.games) || !object(manifest.sources) ||
      typeof manifest.model_version !== 'string') {
    throw new Error('invalid snapshot manifest');
  }
  instant(manifest.cutoff_utc);
  instant(manifest.generated_at);
  const store = readStore(storage);
  const key = weekKey(manifest.season, manifest.week);
  if (store.weeks[key]) return copy(store.weeks[key]);
  const record = {
    schema_version: SCHEMA_VERSION, season: manifest.season, week: manifest.week,
    created_at: new Date().toISOString(), data_cutoff_utc: manifest.cutoff_utc,
    generated_at: manifest.generated_at, model_version: manifest.model_version,
    snapshot_sha256: manifest.manifest_sha256 || null,
    sources: copy(manifest.sources),
    game_locks: Object.fromEntries(Object.entries(manifest.games).map(
      ([id, game]) => [id, game.kickoff_utc])),
    roster: config.roster.map((player) => ({...copy(player),
      on_bye: Boolean(player.on_bye) ||
        (MODELED_POSITIONS.has(player.position) && !manifest.games[player.player_id])})),
    slots: copy(config.slots), rules: copy(config.rules),
    initial: null, unaided_skipped: false, advice: null,
    final: null, prelock_final: null, revisions: [],
  };
  validateEnvelope({schema_version: SCHEMA_VERSION, config, weeks: {[key]: record}});
  store.config = copy(config);
  store.weeks[key] = record;
  writeStore(store, storage);
  return copy(record);
}

function validateLineup(lineup, record) {
  if (!object(lineup)) throw new Error('lineup is required');
  const slotIds = new Set(record.slots.map((slot) => slot.slot_id));
  if (Object.keys(lineup).length !== slotIds.size ||
      Object.keys(lineup).some((slotId) => !slotIds.has(slotId))) {
    throw new Error('lineup must fill exactly the configured slots');
  }
  const chosen = new Set();
  for (const slot of record.slots) {
    const id = lineup[slot.slot_id];
    const player = record.roster.find((item) => item.player_id === id);
    if (!player || !slot.eligible_positions.includes(player.position) || player.on_bye) {
      throw new Error(`ineligible lineup player in slot: ${slot.slot_id}`);
    }
    if (chosen.has(id)) throw new Error(`duplicate lineup player: ${id}`);
    if (slot.modeled === false && id !== slot.fixed_player_id) {
      throw new Error(`user-fixed player changed: ${slot.slot_id}`);
    }
    chosen.add(id);
  }
}

function validateComparisons(comparisons, record) {
  if (!Array.isArray(comparisons) || comparisons.length > 2) {
    throw new Error('up to two comparisons are allowed');
  }
  const ids = new Set(record.roster.map((player) => player.player_id));
  for (const item of comparisons) {
    if (!object(item) || item.a === item.b || !ids.has(item.a) || !ids.has(item.b) ||
        !Number.isFinite(item.probability) || item.probability < 0 || item.probability > 1) {
      throw new Error('invalid comparison probability or player ID');
    }
  }
}

function samePairs(left, right) {
  return left.length === right.length && left.every((item, index) =>
    item.a === right[index].a && item.b === right[index].b);
}

function validateModelComparisons(comparisons, record, calibrated) {
  const ids = new Set(record.roster.map((player) => player.player_id));
  if (!Array.isArray(comparisons) || comparisons.length > 2 ||
      comparisons.some((item) => !object(item) || item.a === item.b ||
        !ids.has(item.a) || !ids.has(item.b) ||
        (item.probabilityA != null && (!calibrated ||
          !Number.isFinite(item.probabilityA) || item.probabilityA < 0 ||
          item.probabilityA > 1)))) {
    throw new Error('uncalibrated or invalid model comparison');
  }
}

function validateChoice(choice, record) {
  validateLineup(choice.lineup, record);
  validateComparisons(choice.comparisons, record);
}

function flags(lineup, record, when) {
  return Object.fromEntries(Object.values(lineup).map((id) => {
    const locked = record.game_locks[id] !== undefined &&
      instant(record.game_locks[id]) <= when;
    return [id, {locked, excluded: locked}];
  }));
}

export function saveInitial(record, choice, nowUtc) {
  if (record.advice || record.initial) throw new Error('unaided choice already frozen');
  const updated = copy(record);
  validateChoice(choice, updated);
  const when = instant(nowUtc);
  const playerFlags = flags(choice.lineup, updated, when);
  updated.initial = {...copy(choice), recorded_at: nowUtc,
    external_forecast_seen: choice.external_forecast_seen === true,
    player_flags: playerFlags,
    excluded_from_prospective: Object.values(playerFlags).some((flag) => flag.excluded)};
  return updated;
}

export function freezeAdvice(record, forecast, nowUtc) {
  if (record.advice) throw new Error('advice already frozen');
  const when = instant(nowUtc);
  if (Object.values(record.game_locks).some((lock) => instant(lock) <= when)) {
    throw new Error('cannot freeze new advice after a game lock');
  }
  if (forecast?.model_version && forecast.model_version !== record.model_version) {
    throw new Error('model version differs from frozen snapshot');
  }
  validateLineup(forecast?.lineup, record);
  const comparisons = forecast.comparisons || (forecast.comparison ? [forecast.comparison] : []);
  validateModelComparisons(comparisons, record, forecast.calibrated === true);
  if (forecast.player_means !== undefined &&
      (!object(forecast.player_means) || Object.entries(forecast.player_means).some(
        ([id, value]) => !record.roster.some((player) => player.player_id === id) ||
          !Number.isFinite(value)))) {
    throw new Error('invalid frozen player means');
  }
  if (record.initial && !samePairs(record.initial.comparisons, comparisons)) {
    throw new Error('model advice must use the same comparison as the unaided choice');
  }
  const updated = copy(record);
  updated.unaided_skipped = updated.initial === null;
  updated.advice = {lineup: copy(forecast.lineup),
    comparison: comparisons[0] ? copy(comparisons[0]) : null,
    comparisons: copy(comparisons),
    calibrated: forecast.calibrated === true,
    ...(forecast.player_means === undefined ? {} : {player_means: copy(forecast.player_means)}),
    frozen_at: nowUtc, data_cutoff_utc: record.data_cutoff_utc,
    model_version: record.model_version, snapshot_sha256: record.snapshot_sha256};
  return updated;
}

export function saveFinal(record, finalChoice, nowUtc) {
  if (!record.advice) throw new Error('freeze advice before saving a final choice');
  validateChoice(finalChoice, record);
  if (record.initial && !samePairs(record.initial.comparisons, finalChoice.comparisons)) {
    throw new Error('final probability must use the same comparison as the unaided choice');
  }
  const reasons = finalChoice.override_reasons || {};
  for (const slot of record.slots) {
    if (finalChoice.lineup[slot.slot_id] !== record.advice.lineup[slot.slot_id] &&
        (typeof reasons[slot.slot_id] !== 'string' || !reasons[slot.slot_id].trim())) {
      throw new Error(`override reason required for slot: ${slot.slot_id}`);
    }
  }
  const updated = copy(record);
  const when = instant(nowUtc);
  const relevantLineups = [updated.initial?.lineup, updated.advice?.lineup,
    updated.final?.lineup, finalChoice.lineup].filter(Boolean);
  const playerFlags = Object.fromEntries(relevantLineups.flatMap((lineup) =>
    Object.entries(flags(lineup, updated, when))));
  const late = Object.values(playerFlags).some((flag) => flag.excluded);
  const saved = {...copy(finalChoice), recorded_at: nowUtc,
    player_flags: playerFlags, excluded_from_prospective: late};
  if (updated.final) updated.revisions.push(copy(updated.final));
  updated.final = saved;
  if (!late) updated.prelock_final = copy(saved);
  return updated;
}

export function saveWeek(record, storage) {
  const key = weekKey(record.season, record.week);
  validateEnvelope({schema_version: SCHEMA_VERSION, config: null, weeks: {[key]: record}});
  const store = readStore(storage);
  const previous = store.weeks[key];
  if (previous) {
    for (const field of ['data_cutoff_utc', 'generated_at', 'model_version',
      'snapshot_sha256', 'sources', 'game_locks', 'roster', 'slots', 'rules']) {
      if (JSON.stringify(previous[field]) !== JSON.stringify(record[field])) {
        throw new Error(`frozen ${field} cannot be rewritten`);
      }
    }
    for (const field of ['initial', 'advice']) {
      if (previous[field] && JSON.stringify(previous[field]) !== JSON.stringify(record[field])) {
        throw new Error(`frozen ${field} cannot be rewritten`);
      }
    }
    if (previous.revisions.length > record.revisions.length ||
        previous.revisions.some((revision, index) =>
          JSON.stringify(revision) !== JSON.stringify(record.revisions[index]))) {
      throw new Error('revision history cannot be erased or rewritten');
    }
    if (previous.final && JSON.stringify(previous.final) !== JSON.stringify(record.final) &&
        JSON.stringify(record.revisions[previous.revisions.length]) !==
          JSON.stringify(previous.final)) {
      throw new Error('revision history must retain the previous final choice');
    }
    if (previous.prelock_final &&
        JSON.stringify(previous.prelock_final) !== JSON.stringify(record.prelock_final)) {
      const candidate = record.prelock_final;
      if (!candidate || candidate.excluded_from_prospective ||
          JSON.stringify(candidate) !== JSON.stringify(record.final) ||
          !previous.final ||
          JSON.stringify(record.revisions[previous.revisions.length]) !==
            JSON.stringify(previous.final) ||
          Object.values(candidate.lineup).some((id) =>
            record.game_locks[id] && instant(record.game_locks[id]) <= instant(candidate.recorded_at))) {
        throw new Error('frozen prelock final cannot be rewritten');
      }
    }
  }
  store.weeks[key] = copy(record);
  writeStore(store, storage);
}

export function readWeek(season, week, storage) {
  const record = readStore(storage).weeks[weekKey(season, week)];
  return record ? copy(record) : null;
}

export function exportRecords(storage) {
  const store = readStore(storage);
  const exported = {...store,
    disclosure: 'Includes roster, scoring rules, picks, probabilities, reasons, source times and model advice. Keep this file private.'};
  return new Blob([JSON.stringify(exported, null, 2) + '\n'],
    {type: 'application/json'});
}

export function importRecords(fileText, storage) {
  let imported;
  try { imported = JSON.parse(fileText); } catch { throw new Error('invalid JSON import'); }
  validateEnvelope(imported);
  // Validate the complete candidate before the one storage write.
  const candidate = {schema_version: SCHEMA_VERSION, config: copy(imported.config),
    weeks: copy(imported.weeks)};
  writeStore(candidate, storage);
  return {imported_weeks: Object.keys(candidate.weeks).length};
}
