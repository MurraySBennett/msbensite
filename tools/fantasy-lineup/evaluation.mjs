// Realized scoring is separate from the frozen forecast and local decision record.
import {scoreDraws, optimize} from './decision.mjs';

function eligible(record) {
  const positions = new Set(record.slots.filter(slot => slot.modeled !== false)
    .flatMap(slot => slot.eligible_positions));
  return record.roster.filter(player => positions.has(player.position) &&
    !player.on_bye && record.game_locks[player.player_id]);
}
function validateLineup(record, lineup, points) {
  if (!lineup) return null;
  if (Object.keys(lineup).length !== record.slots.length ||
      new Set(Object.values(lineup)).size !== record.slots.length) throw new Error('invalid saved lineup');
  let total = 0;
  for (const slot of record.slots) {
    const id = lineup[slot.slot_id];
    const player = record.roster.find(item => item.player_id === id);
    if (!player || !slot.eligible_positions.includes(player.position)) throw new Error(`ineligible saved slot: ${slot.slot_id}`);
    if (slot.modeled === false) {
      if (id !== slot.fixed_player_id) throw new Error(`fixed slot changed: ${slot.slot_id}`);
    } else {
      if (!Number.isFinite(points[id])) throw new Error(`missing observed points: ${id}`);
      total += points[id];
    }
  }
  return Math.round(total * 1e6) / 1e6;
}
export function evaluateWeek(record, outcome) {
  if (record?.schema_version !== 1 || outcome?.schema_version !== 1 ||
      outcome.season !== record.season || outcome.week !== record.week ||
      !outcome.players || typeof outcome.players !== 'object') throw new Error('outcome/record week mismatch');
  const roster = eligible(record), ids = roster.map(player => player.player_id);
  const missing = ids.filter(id => !outcome.players[id]).sort();
  const fixed = record.slots.filter(slot => slot.modeled === false).map(slot => slot.slot_id);
  const initial = record.initial, advice = record.advice, final = record.final, prelock = record.prelock_final;
  const reasons = [], notes = [];
  if (!initial) reasons.push('unaided choice skipped');
  else if (initial.external_forecast_seen) reasons.push('external forecast seen');
  if (initial?.excluded_from_prospective) reasons.push('initial choice was late');
  if (!advice) reasons.push('model advice missing');
  if (!prelock) reasons.push('prelock final missing');
  if (final?.excluded_from_prospective) notes.push('latest revision was late; prelock final is used for comparison');
  if (missing.length) {
    reasons.push('outcomes incomplete');
    return {season: record.season, week: record.week, status: 'pending', missing_player_ids: missing,
      realized_points: {initial: null, model: null, final: null}, latest_saved_final_points: null,
      oracle_points: null, regret: {initial: null, model: null, final: null}, override_points: null,
      override_direction: null, fixed_slots_excluded: fixed, forecast_quality: null,
      comparison_outcomes: [], prospective_eligible: false, exclusion_reasons: reasons, notes};
  }
  const points = {};
  for (const id of ids) {
    const row = outcome.players[id];
    if (row.player_id !== id || !Number.isFinite(Date.parse(row.observed_at)) ||
        Date.parse(row.observed_at) < Date.parse(record.game_locks[id])) throw new Error(`invalid outcome time or ID: ${id}`);
    points[id] = scoreDraws([{available: true, stats: row.stats}], record.rules)[0];
  }
  const locks = Object.fromEntries(record.slots.filter(slot => slot.modeled === false)
    .map(slot => [slot.slot_id, slot.fixed_player_id]));
  const modeledPositions = new Set(record.slots.filter(slot => slot.modeled !== false)
    .flatMap(slot => slot.eligible_positions));
  const oracleRoster = record.roster.map(player => ({...player,
    on_bye: Boolean(player.on_bye) ||
      (modeledPositions.has(player.position) && !record.game_locks[player.player_id])}));
  const oracle = optimize(oracleRoster, record.slots, points, locks);
  const oraclePoints = validateLineup(record, oracle, points);
  const realized = {
    initial: validateLineup(record, initial?.lineup, points),
    model: validateLineup(record, advice?.lineup, points),
    final: validateLineup(record, prelock?.lineup, points),
  };
  const latest = validateLineup(record, final?.lineup, points);
  const regret = Object.fromEntries(Object.entries(realized).map(([key, value]) =>
    [key, value == null ? null : Math.round((oraclePoints - value) * 1e6) / 1e6]));
  const change = realized.final == null || realized.model == null ? null :
    Math.round((realized.final - realized.model) * 1e6) / 1e6;
  const means = advice?.player_means;
  const quality = ids.length && means && ids.every(id => Number.isFinite(means[id])) ? {
    roster_mae: Math.round(ids.reduce((sum, id) => sum + Math.abs(means[id] - points[id]), 0) / ids.length * 1e6) / 1e6,
    model_lineup_error: Math.round((record.slots.filter(slot => slot.modeled !== false)
      .reduce((sum, slot) => sum + means[advice.lineup[slot.slot_id]], 0) - realized.model) * 1e6) / 1e6,
  } : null;
  const comparisons = (initial?.comparisons || []).filter(pair =>
    Number.isFinite(points[pair.a]) && Number.isFinite(points[pair.b])).map(pair => {
    const same = candidate => candidate.a === pair.a && candidate.b === pair.b;
    return {a: pair.a, b: pair.b, a_won: points[pair.a] > points[pair.b],
      initial_probability: pair.probability,
      final_probability: prelock?.comparisons?.find(same)?.probability ?? null,
      model_probability: advice?.comparisons?.find(same)?.probabilityA ?? null};
  });
  return {season: record.season, week: record.week, status: 'complete', missing_player_ids: [],
    realized_points: realized, latest_saved_final_points: latest, oracle_points: oraclePoints,
    regret, override_points: change, override_direction: change == null ? null :
      change > 0 ? 'helped' : change < 0 ? 'hurt' : 'same', fixed_slots_excluded: fixed,
    forecast_quality: quality, comparison_outcomes: comparisons,
    prospective_eligible: reasons.length === 0, exclusion_reasons: reasons, notes};
}

export function aggregateResults(results) {
  const paired = results.filter(item => item.status === 'complete' && item.prospective_eligible &&
    Number.isFinite(item.override_points));
  const differences = paired.map(item => item.override_points);
  const report = {paired_weeks: differences.length,
    paired_final_minus_model_mean: differences.length ? differences.reduce((a, b) => a + b, 0) / differences.length : null,
    paired_final_minus_model_ci95: null, calibration_bins: null,
    inference_note: 'Too few eligible paired weeks for an interval or calibration report.'};
  if (differences.length >= 8) {
    let seed = 7026;
    const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 2 ** 32; };
    const draws = Array.from({length: 4000}, () =>
      differences.reduce(sum => sum + differences[Math.floor(random() * differences.length)], 0) / differences.length).sort((a, b) => a - b);
    report.paired_final_minus_model_ci95 = [draws[100], draws[3899]];
    report.inference_note = 'Descriptive personal-pilot interval; not a population effect.';
  }
  const forecasts = paired.flatMap(item => item.comparison_outcomes).filter(pair =>
    Number.isFinite(pair.final_probability));
  if (forecasts.length >= 20) {
    const bins = [[0, 1/3], [1/3, 2/3], [2/3, 1.000001]].map(([low, high]) => {
      const rows = forecasts.filter(row => low <= row.final_probability && row.final_probability < high);
      return rows.length < 5 ? null : {range: [low, Math.min(high, 1)], n: rows.length,
        mean_forecast: rows.reduce((sum, row) => sum + row.final_probability, 0) / rows.length,
        observed_rate: rows.filter(row => row.a_won).length / rows.length};
    });
    if (bins.every(Boolean)) report.calibration_bins = bins;
  }
  return report;
}
