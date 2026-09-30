// Conditional sensitivity calculations; never mutates the published forecast.
import {scoreDraws, optimize, compare} from './decision.mjs';

const SHARE_TYPES = new Set(['target-share', 'carry-share']);
const TYPES = new Set(['out', 'active-normal', 'active-limited', ...SHARE_TYPES]);
const RECEIVERS = new Set(['RB', 'WR', 'TE']);
const RUNNERS = new Set(['QB', 'RB', 'WR', 'TE']);
const MODELED = new Set(['QB', 'RB', 'WR', 'TE', 'K']);

function clone(snapshot) {
  return structuredClone(snapshot);
}

function indexPlayers(snapshot) {
  const result = new Map();
  for (const shard of snapshot.shards) {
    for (const [id, player] of Object.entries(shard.players)) {
      if (result.has(id)) throw new Error(`duplicate player ID: ${id}`);
      result.set(id, {player, shard});
    }
  }
  return result;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function points(snapshot, roster, rules) {
  const players = indexPlayers(snapshot);
  const draws = {};
  const means = {};
  for (const item of roster) {
    const found = players.get(item.player_id);
    if (!found) {
      if (!MODELED.has(item.position)) continue;
      if (!item.on_bye) throw new Error(`missing forecast for player: ${item.player_id}`);
      continue;
    }
    draws[item.player_id] = scoreDraws(found.player.draws, rules);
    means[item.player_id] = mean(draws[item.player_id]);
  }
  return {draws, means};
}

function eligibleRoster(roster, snapshot) {
  const players = indexPlayers(snapshot);
  return roster.map((item) => ({...item,
    on_bye: Boolean(item.on_bye) || players.get(item.player_id)?.player.assumed_out ||
      players.get(item.player_id)?.player.injury_status?.toLowerCase() === 'out',
  }));
}

function zeroStats(stats) {
  return Object.fromEntries(Object.keys(stats).map((field) => [field, 0]));
}

function roundTenth(value) {
  return Math.round(value * 10) / 10;
}

function rate(stats, numerator, denominator, fallback) {
  return stats[denominator] > 0 ? stats[numerator] / stats[denominator] : fallback;
}

function rescale(draw, field, count, donor = draw.stats) {
  const stats = draw.stats;
  stats[field] = count;
  if (field === 'targets') {
    stats.receptions = Math.min(count, Math.round(count * rate(donor, 'receptions', 'targets', .65)));
    stats.receiving_yards = roundTenth(stats.receptions *
      rate(donor, 'receiving_yards', 'receptions', 10));
    stats.receiving_tds = Math.min(stats.receptions, Math.round(stats.receptions *
      rate(donor, 'receiving_tds', 'receptions', .06)));
    stats.receiving_2pt_conversions = Math.min(stats.receptions,
      Math.round(stats.receptions * rate(donor, 'receiving_2pt_conversions', 'receptions', .008)));
  } else if (field === 'carries') {
    stats.rushing_yards = roundTenth(count * rate(donor, 'rushing_yards', 'carries', 4.2));
    stats.rushing_tds = Math.min(count, Math.round(count * rate(donor, 'rushing_tds', 'carries', .035)));
    stats.rushing_2pt_conversions = Math.min(count,
      Math.round(count * rate(donor, 'rushing_2pt_conversions', 'carries', .004)));
  } else if (field === 'attempts') {
    stats.completions = Math.min(count, Math.round(count * rate(donor, 'completions', 'attempts', .65)));
    stats.passing_yards = roundTenth(stats.completions *
      rate(donor, 'passing_yards', 'completions', 11));
    stats.passing_tds = Math.min(count, Math.round(count * rate(donor, 'passing_tds', 'attempts', .05)));
    stats.passing_interceptions = Math.min(count,
      Math.round(count * rate(donor, 'passing_interceptions', 'attempts', .025)));
    stats.passing_2pt_conversions = Math.min(count,
      Math.round(count * rate(donor, 'passing_2pt_conversions', 'attempts', .002)));
  } else if (field === 'fg_att') {
    stats.fg_made = Math.min(count, Math.round(count * rate(donor, 'fg_made', 'fg_att', .85)));
    const buckets = ['fg_made_0_19', 'fg_made_20_29', 'fg_made_30_39',
      'fg_made_40_49', 'fg_made_50_59', 'fg_made_60_'];
    const weights = buckets.map((bucket) => donor[bucket] || 0);
    const allocated = allocate(stats.fg_made, buckets, weights.some(Boolean) ? weights : [1, 3, 4, 3, 2, .2]);
    for (const bucket of buckets) stats[bucket] = allocated[bucket];
    stats.fg_missed = count - stats.fg_made;
  } else if (field === 'pat_att') {
    stats.pat_made = Math.min(count, Math.round(count * rate(donor, 'pat_made', 'pat_att', .95)));
    stats.pat_missed = count - stats.pat_made;
  }
  if (['targets', 'carries', 'attempts'].includes(field)) {
    const donorTouches = (donor.receptions || 0) + (donor.carries || 0) +
      (donor.attempts || 0);
    const touches = (stats.receptions || 0) + (stats.carries || 0) +
      (stats.attempts || 0);
    stats.fumbles_lost_total = Math.min(touches, Math.round(touches *
      (donorTouches ? (donor.fumbles_lost_total || 0) / donorTouches : .004)));
  }
}

function allocate(total, ids, weights) {
  if (!ids.length && total) throw new Error('cannot conserve team opportunity without teammates');
  const sum = weights.reduce((a, b) => a + b, 0);
  const shares = ids.map((id, index) => ({id, exact: total * (sum ? weights[index] / sum : 1 / ids.length)}));
  const result = Object.fromEntries(shares.map(({id, exact}) => [id, Math.floor(exact)]));
  let left = total - Object.values(result).reduce((a, b) => a + b, 0);
  shares.sort((a, b) => (b.exact % 1) - (a.exact % 1) || a.id.localeCompare(b.id));
  for (const {id} of shares) {
    if (!left) break;
    result[id]++;
    left--;
  }
  return result;
}

function candidates(shard, index, field, excludedId) {
  const allowed = field === 'targets' ? RECEIVERS : field === 'carries' ? RUNNERS : null;
  return Object.entries(shard.players).filter(([id, player]) =>
    id !== excludedId && player.draws[index].available &&
    (!allowed || allowed.has(player.position)) &&
    (field !== 'attempts' || player.position === 'QB') &&
    (!['fg_att', 'pat_att'].includes(field) || player.position === 'K'));
}

function redistribute(shard, index, selectedId, field, desired, donor) {
  const totals = shard.team_opportunity[index];
  const total = totals[field];
  if (desired < 0 || desired > total || !Number.isInteger(desired)) {
    throw new Error(`invalid ${field} share`);
  }
  const selected = shard.players[selectedId].draws[index];
  const others = candidates(shard, index, field, selectedId);
  const remaining = total - desired;
  const sink = field === 'attempts' ? 'other_attempts' : `unassigned_${field}`;
  const useSink = !others.length || (totals[sink] || 0) > 0;
  const ids = others.map(([id]) => id);
  const weights = others.map(([, player]) => player.draws[index].stats[field] || 0);
  if (useSink) {
    ids.push(sink);
    weights.push(totals[sink] || 0);
  }
  const allocated = allocate(remaining, ids, weights);
  rescale(selected, field, desired, donor || {...selected.stats});
  for (const [id, player] of others) {
    const draw = player.draws[index];
    rescale(draw, field, allocated[id], {...draw.stats});
  }
  totals[sink] = allocated[sink] || 0;
}

function activeShare(player, shard, field) {
  const observed = player.draws.map((draw, index) => draw.available &&
    shard.team_opportunity[index][field] > 0
    ? draw.stats[field] / shard.team_opportunity[index][field] : null)
    .filter((value) => value !== null);
  if (!observed.length) {
    if (shard.team_opportunity.every((total) => total[field] === 0)) return 0;
    throw new Error('no active draw supports this scenario');
  }
  return mean(observed);
}

function alter(snapshot, assumption) {
  const original = indexPlayers(snapshot).get(assumption.playerId);
  if (!original) throw new Error(`unknown player ID: ${assumption.playerId}`);
  const altered = {...snapshot, shards: snapshot.shards.map((shard) =>
    shard === original.shard ? clone(shard) : shard)};
  const selected = indexPlayers(altered).get(assumption.playerId);
  const {player, shard} = selected;
  const type = assumption.type;
  if (!TYPES.has(type)) throw new Error(`unsupported scenario: ${type}`);
  if (SHARE_TYPES.has(type)) {
    if (!RECEIVERS.has(player.position) ||
        (type === 'carry-share' && player.position === 'TE' &&
         !player.draws.some((draw) => draw.stats.carries > 0))) {
      throw new Error('ineligible player for share scenario');
    }
    if (!Number.isFinite(assumption.share) || assumption.share < 0 || assumption.share > 1) {
      throw new Error('share must be between 0 and 1');
    }
  }
  if ((type === 'active-normal' || type === 'active-limited') &&
      player.injury_status?.toLowerCase() === 'out') {
    throw new Error('ruled-out player cannot be forced active');
  }
  if (type === 'active-limited' && (!Number.isFinite(assumption.workloadFraction) ||
      assumption.workloadFraction <= 0 || assumption.workloadFraction >= 1)) {
    throw new Error('workloadFraction must be between 0 and 1');
  }
  const fields = player.position === 'QB' ? ['attempts', 'carries']
    : player.position === 'K' ? ['fg_att', 'pat_att'] : ['targets', 'carries'];
  const normal = (type === 'active-normal' || type === 'active-limited')
    ? Object.fromEntries(fields.map((field) => [field, activeShare(player, shard, field)])) : null;
  const donors = player.draws.filter((draw) => draw.available);
  const donorIndices = player.draws.map((draw, index) => draw.available ? index : null)
    .filter((index) => index !== null);
  if (type === 'out') player.assumed_out = true;
  for (let index = 0; index < player.draws.length; index++) {
    const draw = player.draws[index];
    if (type === 'out') {
      if (!draw.available) continue;
      for (const field of fields) redistribute(shard, index, player.player_id, field, 0);
      draw.available = false;
      draw.stats = zeroStats(draw.stats);
      continue;
    }
    if (SHARE_TYPES.has(type)) {
      if (!draw.available) continue;
      const field = type === 'target-share' ? 'targets' : 'carries';
      const desired = Math.round(shard.team_opportunity[index][field] * assumption.share);
      redistribute(shard, index, player.player_id, field, desired);
      continue;
    }
    if (!draw.available) {
      if (!donors.length) throw new Error('no active draw supports this scenario');
      draw.available = true;
      draw.stats = clone(donors[index % donors.length].stats);
      for (const field of fields) {
        if (shard.team_opportunity[index][field] === 0) {
          shard.team_opportunity[index][field] =
            shard.team_opportunity[donorIndices[index % donorIndices.length]][field];
          if (field === 'targets') {
            const totals = shard.team_opportunity[index];
            const donorTotals = shard.team_opportunity[donorIndices[index % donorIndices.length]];
            const attempts = Math.max(totals.attempts, donorTotals.attempts, totals.targets);
            totals.other_attempts += attempts - totals.attempts;
            totals.attempts = attempts;
          }
        }
      }
    }
    for (const field of fields) {
      const share = normal[field] * (type === 'active-limited' ? assumption.workloadFraction : 1);
      const desired = Math.round(shard.team_opportunity[index][field] * share);
      redistribute(shard, index, player.player_id, field, desired, {...draw.stats});
    }
  }
  return altered;
}

function label(assumption) {
  const id = assumption.playerId;
  switch (assumption.type) {
    case 'out': return `Assume ${id} is out`;
    case 'active-normal': return `Assume ${id} plays a normal workload`;
    case 'active-limited': return `Assume ${id} plays ${Math.round(assumption.workloadFraction * 100)}% of normal workload`;
    case 'target-share': return `Assume ${id} receives ${Math.round(assumption.share * 100)}% of team targets if active`;
    case 'carry-share': return `Assume ${id} receives ${Math.round(assumption.share * 100)}% of team carries if active`;
    default: throw new Error('unsupported scenario');
  }
}

function threshold(snapshot, roster, slots, rules, comparison, assumption) {
  if (!SHARE_TYPES.has(assumption.type) || slots.length !== 1 ||
      slots[0].modeled === false || comparison.locks?.[slots[0].slot_id]) return null;
  let original = null;
  for (let step = 0; step <= 20; step++) {
    const share = step / 20;
    let variant;
    try {
      variant = alter(snapshot, {...assumption, share});
    } catch (error) {
      if (/cannot conserve/.test(error.message)) continue;
      throw error;
    }
    const scored = points(variant, roster, rules);
    const pick = optimize(eligibleRoster(roster, variant), slots,
      scored.means, comparison.locks || {})[slots[0].slot_id];
    if (step === 0) {
      if (![comparison.a, comparison.b].includes(pick)) return null;
      original = pick;
    } else if (pick !== original) {
      return [comparison.a, comparison.b].includes(pick) ? share : null;
    }
  }
  return null;
}

export function explore(snapshot, roster, slots, rules, comparison, assumption) {
  if (snapshot?.manifest?.schema_version !== 1 || !Array.isArray(snapshot.shards)) {
    throw new Error('unsupported snapshot schema');
  }
  if (!comparison || comparison.a === comparison.b) throw new Error('two different comparison IDs required');
  const affected = roster.find((player) => player.player_id === assumption?.playerId);
  if (!affected) throw new Error(`scenario player missing from roster: ${assumption?.playerId}`);
  if (affected.locked || affected.on_bye) throw new Error('scenario player is locked or on bye');
  const baseline = points(snapshot, roster, rules);
  if (!baseline.draws[comparison.a] || !baseline.draws[comparison.b]) {
    throw new Error('comparison player missing from roster');
  }
  const locks = comparison.locks || {};
  const officialLineup = optimize(eligibleRoster(roster, snapshot), slots, baseline.means, locks);
  const scenarioSnapshot = alter(snapshot, assumption);
  const conditional = points(scenarioSnapshot, roster, rules);
  const scenarioLineup = optimize(eligibleRoster(roster, scenarioSnapshot), slots,
    conditional.means, locks);
  const officialComparison = compare(baseline.draws[comparison.a], baseline.draws[comparison.b]);
  const scenarioComparison = compare(conditional.draws[comparison.a], conditional.draws[comparison.b]);
  return {
    officialLineup, scenarioLineup,
    officialComparison: {...officialComparison, probabilityA: null},
    scenarioComparison: {...scenarioComparison, probabilityA: null},
    assumptionLabel: label(assumption), scenarioProbability: null, calibrated: false,
    assumptionDetails: ['active-normal', 'active-limited'].includes(assumption.type)
      ? 'Conditional model sensitivity: when a frozen draw had zero team volume, use matched active draw team volume; this is not a measured or causal effect.'
      : 'Conditional model sensitivity: modeled team opportunities are reallocated within each draw; this is not a measured or causal effect.',
    flipThreshold: threshold(snapshot, roster, slots, rules, comparison, assumption),
    scenarioSnapshot,
  };
}
