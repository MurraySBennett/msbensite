"""Score stat components and choose a legal lineup for modeled slots."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from functools import lru_cache


SUPPORTED_STATS = frozenset((
    'completions', 'attempts', 'passing_yards', 'passing_tds',
    'passing_interceptions', 'passing_2pt_conversions', 'carries',
    'rushing_yards', 'rushing_tds', 'rushing_2pt_conversions',
    'targets', 'receptions', 'receiving_yards', 'receiving_tds',
    'receiving_2pt_conversions', 'fumbles_lost_total', 'fg_made',
    'fg_att', 'fg_missed', 'fg_made_0_19', 'fg_made_20_29',
    'fg_made_30_39', 'fg_made_40_49', 'fg_made_50_59',
    'fg_made_60_', 'pat_made', 'pat_att', 'pat_missed',
))


class UnsupportedRule(ValueError):
    pass


class NoLegalLineup(ValueError):
    pass


@dataclass(frozen=True)
class StatLine:
    player_id: str
    observed_at: str
    stats: dict[str, float]


@dataclass(frozen=True)
class ScoringRules:
    coefficients: dict[str, float]


@dataclass(frozen=True)
class Player:
    player_id: str
    position: str
    team: str = ''
    on_bye: bool = False
    locked: bool = False


@dataclass(frozen=True)
class Slot:
    slot_id: str
    eligible_positions: tuple[str, ...]
    modeled: bool = True


@dataclass
class Lineup:
    assignments: dict[str, str] = field(default_factory=dict)


def score(stats: StatLine, rules: ScoringRules) -> float:
    unknown = set(rules.coefficients) - SUPPORTED_STATS
    if unknown:
        raise UnsupportedRule(f'unsupported scoring component: {", ".join(sorted(unknown))}')
    return sum(coefficient * stats.stats.get(component, 0.0)
               for component, coefficient in rules.coefficients.items())


def legal_lineups(players: list[Player], slots: list[Slot],
                  locked: dict[str, str]) -> list[Lineup]:
    if len({player.player_id for player in players}) != len(players):
        raise ValueError('duplicate player ID')
    if len({slot.slot_id for slot in slots}) != len(slots):
        raise ValueError('duplicate slot ID')
    if set(locked) - {slot.slot_id for slot in slots}:
        raise NoLegalLineup('locked assignment names an unknown slot')
    by_id = {player.player_id: player for player in players}
    results: list[Lineup] = []

    def assign(index: int, chosen: dict[str, str], used: set[str]) -> None:
        if index == len(slots):
            results.append(Lineup(chosen.copy()))
            return
        slot = slots[index]
        if not slot.modeled and slot.slot_id not in locked:
            return
        candidates = ([by_id[locked[slot.slot_id]]] if slot.slot_id in locked
                      and locked[slot.slot_id] in by_id else
                      [] if slot.slot_id in locked else players)
        for player in sorted(candidates, key=lambda item: item.player_id):
            if (player.player_id in used or player.position not in slot.eligible_positions
                    or player.on_bye or (player.locked and slot.slot_id not in locked)):
                continue
            chosen[slot.slot_id] = player.player_id
            assign(index + 1, chosen, used | {player.player_id})
            del chosen[slot.slot_id]

    assign(0, {}, set())
    if not results:
        raise NoLegalLineup('no legal lineup for slots: '
                            + ', '.join(slot.slot_id for slot in slots))
    return results


def best_lineup(players: list[Player], slots: list[Slot],
                mean_points: dict[str, float], locked: dict[str, str]) -> Lineup:
    if len({player.player_id for player in players}) != len(players):
        raise ValueError('duplicate player ID')
    if len({slot.slot_id for slot in slots}) != len(slots):
        raise ValueError('duplicate slot ID')
    if set(locked) - {slot.slot_id for slot in slots}:
        raise NoLegalLineup('locked assignment names an unknown slot')
    ordered = sorted(players, key=lambda player: player.player_id)
    by_id = {player.player_id: index for index, player in enumerate(ordered)}
    candidates: list[list[int]] = []
    for slot in slots:
        if not slot.modeled and slot.slot_id not in locked:
            raise NoLegalLineup(f'user-fixed slot needs a player: {slot.slot_id}')
        pool = ([by_id[locked[slot.slot_id]]] if slot.slot_id in locked
                and locked[slot.slot_id] in by_id else
                [] if slot.slot_id in locked else range(len(ordered)))
        eligible = [index for index in pool
                    if ordered[index].position in slot.eligible_positions
                    and not ordered[index].on_bye
                    and (not ordered[index].locked or slot.slot_id in locked)]
        if slot.modeled:
            for index in eligible:
                if ordered[index].player_id not in mean_points:
                    raise ValueError(f'missing forecast for player: {ordered[index].player_id}')
        candidates.append(eligible)

    @lru_cache(None)
    def solve(slot_index: int, used: int) -> tuple[float, tuple[str, ...]] | None:
        if slot_index == len(slots):
            return 0.0, ()
        best: tuple[float, tuple[str, ...]] | None = None
        slot = slots[slot_index]
        for index in candidates[slot_index]:
            bit = 1 << index
            if used & bit:
                continue
            tail = solve(slot_index + 1, used | bit)
            if tail is None:
                continue
            player_id = ordered[index].player_id
            candidate = (tail[0] + (mean_points[player_id] if slot.modeled else 0.0),
                         (player_id,) + tail[1])
            if (best is None or candidate[0] > best[0]
                    or (candidate[0] == best[0] and candidate[1] < best[1])):
                best = candidate
        return best

    result = solve(0, 0)
    if result is None:
        raise NoLegalLineup('no legal lineup for slots: '
                            + ', '.join(slot.slot_id for slot in slots))
    return Lineup(dict(zip((slot.slot_id for slot in slots), result[1])))


def _instant(value: str) -> datetime:
    instant = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if instant.tzinfo is None:
        raise ValueError(f'timestamp lacks timezone: {value}')
    return instant.astimezone(timezone.utc)


def rolling_baseline(history: list[StatLine], cutoff_utc: str,
                     rules: ScoringRules, window: int = 3) -> dict[str, float]:
    if window < 1:
        raise ValueError('baseline window must be positive')
    cutoff = _instant(cutoff_utc)
    grouped: dict[str, list[StatLine]] = {}
    for row in history:
        if _instant(row.observed_at) < cutoff:
            grouped.setdefault(row.player_id, []).append(row)
    return {player_id: sum(score(row, rules) for row in sorted(rows,
             key=lambda row: _instant(row.observed_at), reverse=True)[:window])
             / min(window, len(rows)) for player_id, rows in grouped.items()}
