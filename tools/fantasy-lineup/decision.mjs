// Scoring and legal lineup selection for the frozen fantasy snapshot.

export const SUPPORTED_STATS = new Set([
  'completions', 'attempts', 'passing_yards', 'passing_tds',
  'passing_interceptions', 'passing_2pt_conversions', 'carries',
  'rushing_yards', 'rushing_tds', 'rushing_2pt_conversions',
  'targets', 'receptions', 'receiving_yards', 'receiving_tds',
  'receiving_2pt_conversions', 'fumbles_lost_total', 'fg_made',
  'fg_att', 'fg_missed', 'fg_made_0_19', 'fg_made_20_29',
  'fg_made_30_39', 'fg_made_40_49', 'fg_made_50_59',
  'fg_made_60_', 'pat_made', 'pat_att', 'pat_missed',
]);

export function scoreDraws(playerDraws, rules) {
  if (!Array.isArray(playerDraws) || !playerDraws.length) {
    throw new Error('player draws are required');
  }
  const coefficients = rules?.coefficients;
  if (!coefficients || typeof coefficients !== 'object' || Array.isArray(coefficients)) {
    throw new Error('scoring coefficients are required');
  }
  for (const [field, coefficient] of Object.entries(coefficients)) {
    if (!SUPPORTED_STATS.has(field)) throw new Error(`unsupported scoring component: ${field}`);
    if (!Number.isFinite(coefficient)) throw new Error(`invalid scoring coefficient: ${field}`);
  }
  return playerDraws.map((draw) => {
    if (!draw || typeof draw.stats !== 'object') throw new Error('invalid player draw');
    if (draw.available === false) return 0;
    return Object.entries(coefficients).reduce((total, [field, coefficient]) => {
      const value = draw.stats[field] ?? 0;
      if (!Number.isFinite(value) || value < 0) throw new Error(`invalid stat: ${field}`);
      return total + coefficient * value;
    }, 0);
  });
}

function lexLess(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

export function optimize(roster, slots, means, locks = {}) {
  if (!Array.isArray(roster) || !Array.isArray(slots)) throw new Error('roster and slots required');
  if (new Set(roster.map((p) => p.player_id)).size !== roster.length) {
    throw new Error('duplicate player ID');
  }
  if (new Set(slots.map((s) => s.slot_id)).size !== slots.length) {
    throw new Error('duplicate slot ID');
  }
  const slotIds = new Set(slots.map((s) => s.slot_id));
  for (const slotId of Object.keys(locks)) {
    if (!slotIds.has(slotId)) throw new Error(`unknown locked slot: ${slotId}`);
  }
  for (const player of roster) {
    if (player.locked && player.locked_slot) {
      for (const [slotId, playerId] of Object.entries(locks)) {
        if (playerId === player.player_id && slotId !== player.locked_slot) {
          throw new Error(`started player must remain in original slot: ${player.player_id}`);
        }
      }
    }
  }
  const ordered = [...roster].sort((a, b) => a.player_id.localeCompare(b.player_id));
  const byId = new Map(ordered.map((player, index) => [player.player_id, index]));
  const choices = slots.map((slot) => {
    if (slot.modeled === false && !(slot.slot_id in locks)) {
      throw new Error(`user-fixed slot needs a player: ${slot.slot_id}`);
    }
    const pool = slot.slot_id in locks
      ? (byId.has(locks[slot.slot_id]) ? [byId.get(locks[slot.slot_id])] : [])
      : ordered.map((_, index) => index);
    const eligible = pool.filter((index) => {
      const player = ordered[index];
      return slot.eligible_positions.includes(player.position) && !player.on_bye &&
        (!player.locked || slot.slot_id in locks);
    });
    if (slot.modeled !== false) {
      for (const index of eligible) {
        if (!Number.isFinite(means?.[ordered[index].player_id])) {
          throw new Error(`missing forecast for player: ${ordered[index].player_id}`);
        }
      }
    }
    return eligible;
  });

  const memo = new Map();
  function solve(slotIndex, used) {
    if (slotIndex === slots.length) return {score: 0, ids: []};
    const key = `${slotIndex}:${used}`;
    if (memo.has(key)) return memo.get(key);
    let best = null;
    for (const index of choices[slotIndex]) {
      const bit = 1n << BigInt(index);
      if (used & bit) continue;
      const tail = solve(slotIndex + 1, used | bit);
      if (!tail) continue;
      const id = ordered[index].player_id;
      const candidate = {
        score: tail.score + (slots[slotIndex].modeled === false ? 0 : means[id]),
        ids: [id, ...tail.ids],
      };
      if (!best || candidate.score > best.score ||
          (candidate.score === best.score && lexLess(candidate.ids, best.ids))) {
        best = candidate;
      }
    }
    memo.set(key, best);
    return best;
  }
  const selected = solve(0, 0n);
  if (!selected) throw new Error(`no legal lineup for slots: ${slots.map((s) => s.slot_id).join(', ')}`);
  return Object.fromEntries(slots.map((slot, index) => [slot.slot_id, selected.ids[index]]));
}

function quantile(sorted, p) {
  const location = (sorted.length - 1) * p;
  const low = Math.floor(location);
  const high = Math.ceil(location);
  return sorted[low] + (sorted[high] - sorted[low]) * (location - low);
}

export function compare(drawsA, drawsB) {
  if (!Array.isArray(drawsA) || !Array.isArray(drawsB) ||
      !drawsA.length || drawsA.length !== drawsB.length) {
    throw new Error('matching draw counts are required');
  }
  const differences = drawsA.map((value, index) => {
    if (!Number.isFinite(value) || !Number.isFinite(drawsB[index])) {
      throw new Error('non-finite point draw');
    }
    return value - drawsB[index];
  });
  const ordered = [...differences].sort((a, b) => a - b);
  return {
    meanDifference: differences.reduce((sum, value) => sum + value, 0) / differences.length,
    interval80: [quantile(ordered, 0.1), quantile(ordered, 0.9)],
    probabilityA: differences.filter((value) => value > 0).length / differences.length,
  };
}
