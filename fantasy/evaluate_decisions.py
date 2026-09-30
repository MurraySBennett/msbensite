"""Score frozen personal decisions against explicit, versioned final stats."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
import json
import math
import os
from pathlib import Path
import random
import re
import tempfile

from .decision import (Player, ScoringRules, Slot, StatLine, SUPPORTED_STATS,
                       best_lineup, score)


SIGNED_YARDAGE = frozenset(('passing_yards', 'rushing_yards', 'receiving_yards'))


def _valid_stat(field: str, value: float) -> bool:
    return (field in SUPPORTED_STATS and isinstance(value, (int, float)) and
            not isinstance(value, bool) and math.isfinite(value) and
            (value >= 0 or field in SIGNED_YARDAGE))


@dataclass(frozen=True)
class WeekResult:
    season: int
    week: int
    status: str
    missing_player_ids: list[str]
    realized_points: dict[str, float | None]
    latest_saved_final_points: float | None
    oracle_points: float | None
    regret: dict[str, float | None]
    override_points: float | None
    override_direction: str | None
    fixed_slots_excluded: list[str]
    forecast_quality: dict[str, float] | None
    comparison_outcomes: list[dict]
    prospective_eligible: bool
    exclusion_reasons: list[str]
    notes: list[str]


def _instant(value: str) -> datetime:
    if not isinstance(value, str):
        raise ValueError('timestamp must be a string')
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError(f'timestamp lacks timezone: {value}')
    return result.astimezone(timezone.utc)


def _eligible(record: dict) -> list[dict]:
    modeled = {position for slot in record['slots'] if slot.get('modeled', True)
               for position in slot['eligible_positions']}
    return [player for player in record['roster'] if player['position'] in modeled
            and not player.get('on_bye') and player['player_id'] in record['game_locks']]


def _lineup_points(record: dict, lineup: dict | None, points: dict[str, float]) -> float | None:
    if lineup is None:
        return None
    slots = record['slots']
    if set(lineup) != {slot['slot_id'] for slot in slots} or len(set(lineup.values())) != len(slots):
        raise ValueError('saved lineup is incomplete or repeats a player')
    players = {player['player_id']: player for player in record['roster']}
    total = 0.0
    for slot in slots:
        player_id = lineup[slot['slot_id']]
        player = players.get(player_id)
        if not player or player['position'] not in slot['eligible_positions']:
            raise ValueError(f'ineligible saved player in {slot["slot_id"]}')
        if not slot.get('modeled', True):
            if player_id != slot.get('fixed_player_id'):
                raise ValueError(f'fixed slot changed: {slot["slot_id"]}')
            continue
        if player_id not in points:
            raise ValueError(f'missing observed points for {player_id}')
        total += points[player_id]
    return round(total, 6)


def evaluate_week(record: dict, outcomes: dict[str, StatLine]) -> WeekResult:
    """Return pending until every oracle-eligible player has an observed stat row.

    A late saved final remains visible, but only prelock_final is compared
    prospectively. An externally informed initial choice is scored but excluded
    from the unaided human/model inference.
    """
    if record.get('schema_version') != 1 or not isinstance(record.get('roster'), list):
        raise ValueError('unsupported week record')
    roster = _eligible(record)
    ids = {player['player_id'] for player in roster}
    missing = sorted(ids - outcomes.keys())
    fixed = [slot['slot_id'] for slot in record['slots'] if slot.get('modeled') is False]
    exclusions = []
    initial = record.get('initial')
    advice = record.get('advice')
    final = record.get('final')
    prelock = record.get('prelock_final')
    if not initial:
        exclusions.append('unaided choice skipped')
    elif initial.get('external_forecast_seen'):
        exclusions.append('external forecast seen')
    if initial and initial.get('excluded_from_prospective'):
        exclusions.append('initial choice was late')
    if not advice:
        exclusions.append('model advice missing')
    if not prelock:
        exclusions.append('prelock final missing')
    notes = []
    if final and final.get('excluded_from_prospective'):
        notes.append('latest revision was late; prelock final is used for comparison')
    if missing:
        exclusions.append('outcomes incomplete')
        return WeekResult(record['season'], record['week'], 'pending', missing,
                          {'initial': None, 'model': None, 'final': None}, None,
                          None, {'initial': None, 'model': None, 'final': None},
                          None, None, fixed, None, [], False, exclusions, notes)

    rules = ScoringRules(record['rules']['coefficients'])
    for player_id in ids:
        row = outcomes[player_id]
        if not isinstance(row, StatLine) or row.player_id != player_id:
            raise ValueError(f'invalid outcome row: {player_id}')
        if _instant(row.observed_at) < _instant(record['game_locks'][player_id]):
            raise ValueError(f'outcome precedes game lock: {player_id}')
        if any(not _valid_stat(field, value) for field, value in row.stats.items()):
            raise ValueError(f'invalid outcome stat: {player_id}')
    points = {id: score(outcomes[id], rules) for id in ids}
    modeled_positions = {position for slot in record['slots'] if slot.get('modeled', True)
                         for position in slot['eligible_positions']}
    modeled_players = [Player(item['player_id'], item['position'], item.get('team', ''),
                              item.get('on_bye', False) or
                              (item['player_id'] not in record['game_locks'] and
                               item['position'] in modeled_positions))
                       for item in record['roster']]
    slots = [Slot(item['slot_id'], tuple(item['eligible_positions']),
                  item.get('modeled', True)) for item in record['slots']]
    locks = {item['slot_id']: item['fixed_player_id'] for item in record['slots']
             if item.get('modeled') is False}
    oracle = best_lineup(modeled_players, slots, points, locks)
    oracle_points = _lineup_points(record, oracle.assignments, points)
    realized = {
        'initial': _lineup_points(record, initial['lineup'], points) if initial else None,
        'model': _lineup_points(record, advice['lineup'], points) if advice else None,
        'final': _lineup_points(record, prelock['lineup'], points) if prelock else None,
    }
    latest_points = _lineup_points(record, final['lineup'], points) if final else None
    regret = {key: round(oracle_points - value, 6) if value is not None else None
              for key, value in realized.items()}
    change = (round(realized['final'] - realized['model'], 6)
              if realized['final'] is not None and realized['model'] is not None else None)
    direction = ('helped' if change > 0 else 'hurt' if change < 0 else 'same') if change is not None else None
    means = advice.get('player_means') if advice else None
    quality = None
    if ids and isinstance(means, dict) and all(id in means and math.isfinite(means[id]) for id in ids):
        predicted_model = sum(means[id] for slot in record['slots']
                              if slot.get('modeled', True)
                              for id in [advice['lineup'][slot['slot_id']]])
        quality = {'roster_mae': round(sum(abs(means[id] - points[id]) for id in ids) / len(ids), 6),
                   'model_lineup_error': round(predicted_model - realized['model'], 6)}
    comparisons = []
    for item in initial.get('comparisons', []) if initial else []:
        if item['a'] not in points or item['b'] not in points:
            continue
        final_match = next((candidate for candidate in (prelock or {}).get('comparisons', [])
                            if candidate['a'] == item['a'] and candidate['b'] == item['b']), None)
        model_match = next((candidate for candidate in (advice or {}).get('comparisons', [])
                            if candidate['a'] == item['a'] and candidate['b'] == item['b']), None)
        comparisons.append({'a': item['a'], 'b': item['b'], 'a_won': points[item['a']] > points[item['b']],
                            'initial_probability': item['probability'],
                            'final_probability': final_match['probability'] if final_match else None,
                            'model_probability': model_match.get('probabilityA') if model_match else None})
    return WeekResult(record['season'], record['week'], 'complete', [], realized,
                      latest_points, oracle_points, regret, change, direction,
                      fixed, quality, comparisons, not exclusions, exclusions, notes)


def aggregate_results(results: list[WeekResult]) -> dict:
    """Descriptive personal-pilot report; intervals require eight paired weeks."""
    paired = [result for result in results if result.status == 'complete'
              and result.prospective_eligible and result.override_points is not None]
    differences = [result.override_points for result in paired]
    report = {'paired_weeks': len(differences),
              'paired_final_minus_model_mean': (sum(differences) / len(differences)
                                                if differences else None),
              'paired_final_minus_model_ci95': None,
              'calibration_bins': None,
              'inference_note': 'Too few eligible paired weeks for an interval or calibration report.'}
    if len(differences) >= 8:
        rng = random.Random(7026)
        draws = sorted(sum(rng.choice(differences) for _ in differences) / len(differences)
                       for _ in range(4000))
        report['paired_final_minus_model_ci95'] = [draws[100], draws[3899]]
        report['inference_note'] = 'Descriptive personal-pilot interval; not a population effect.'
    forecasts = [pair for result in paired for pair in result.comparison_outcomes
                 if pair['final_probability'] is not None]
    if len(forecasts) >= 20:
        bins = []
        for low, high in ((0, 1/3), (1/3, 2/3), (2/3, 1.000001)):
            rows = [row for row in forecasts if low <= row['final_probability'] < high]
            if len(rows) < 5:
                break
            bins.append({'range': [low, min(high, 1)], 'n': len(rows),
                         'mean_forecast': sum(row['final_probability'] for row in rows) / len(rows),
                         'observed_rate': sum(row['a_won'] for row in rows) / len(rows)})
        if len(bins) == 3:
            report['calibration_bins'] = bins
    return report


def _payload(value: dict) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False) + '\n').encode()


def _hash(value: bytes) -> str:
    return sha256(value).hexdigest()


def _read_current(output: Path) -> dict:
    pointer_file = output / 'current.json'
    if not pointer_file.exists():
        return {'schema_version': 1, 'weeks': {}}
    pointer = json.loads(pointer_file.read_bytes())
    path = pointer['manifest']
    if not path.startswith('versions/') or '..' in Path(path).parts:
        raise ValueError('invalid outcome pointer path')
    content = (output / path).read_bytes()
    if _hash(content) != pointer['manifest_sha256']:
        raise ValueError('existing outcome manifest checksum mismatch')
    manifest = json.loads(content)
    if manifest['schema_version'] != 1 or not isinstance(manifest['weeks'], dict):
        raise ValueError('invalid existing outcome manifest')
    for descriptor in manifest['weeks'].values():
        week_path = descriptor.get('path') if isinstance(descriptor, dict) else None
        if not isinstance(week_path, str) or not re.fullmatch(
                r'versions/[a-f0-9]{20}/week-\d{4}-(?:[1-9]|1[0-8])\.json', week_path):
            raise ValueError('invalid existing outcome week path')
        if _hash((output / week_path).read_bytes()) != descriptor.get('sha256'):
            raise ValueError('existing outcome week checksum mismatch')
    return manifest


def write_outcome_snapshot(forecast_manifest: dict, outcomes: dict[str, StatLine],
                           output: Path, source: dict) -> None:
    """Publish public-player outcomes, never personal rosters or saved choices.

    The input manifest is Task 3's public forecast manifest. Missing scheduled
    players are listed explicitly; observed zeroes require actual stat rows.
    """
    public_fields = {'name', 'url', 'retrieved_at', 'licence', 'raw_sha256', 'status'}
    if not isinstance(source, dict) or set(source) - public_fields:
        raise ValueError('unsupported public source field')
    if source.get('status') != 'final':
        raise ValueError('outcome source must explicitly attest final results')
    if (not all(isinstance(source.get(field), str) and source[field].strip()
                for field in public_fields) or
            not source['url'].startswith('https://') or
            not re.fullmatch(r'[a-f0-9]{64}', source['raw_sha256'])):
        raise ValueError('outcome source URL, licence, retrieval and raw SHA-256 required')
    retrieved = _instant(source['retrieved_at'])
    if forecast_manifest.get('schema_version') != 1 or not isinstance(
            forecast_manifest.get('games'), dict):
        raise ValueError('unsupported public forecast manifest')
    required = set(forecast_manifest['games'])
    if not required or not outcomes or set(outcomes) - required:
        raise ValueError('outcome player pool differs from forecast manifest')
    missing = sorted(required - set(outcomes))
    for id in outcomes:
        row = outcomes[id]
        lock = forecast_manifest['games'][id]['kickoff_utc']
        if not isinstance(row, StatLine) or row.player_id != id or\
                _instant(row.observed_at) > retrieved or\
                _instant(row.observed_at) < _instant(lock):
            raise ValueError(f'invalid observed time or player ID: {id}')
        if not isinstance(row.stats, dict) or\
                any(not _valid_stat(field, value) for field, value in row.stats.items()):
            raise ValueError(f'invalid outcome stat: {id}')
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    previous = _read_current(output)
    forecast_hash = _hash(_payload(forecast_manifest))
    week_key = f'{forecast_manifest["season"]}-{forecast_manifest["week"]}'
    manifest_key = f'{week_key}:{forecast_hash}'
    week_bytes = _payload({'schema_version': 1, 'season': forecast_manifest['season'],
                           'week': forecast_manifest['week'],
                           'forecast_manifest_sha256': forecast_hash,
                           'source': {field: source[field] for field in sorted(public_fields)},
                           'missing_player_ids': missing,
                           'players': {id: {'player_id': id, 'observed_at': outcomes[id].observed_at,
                                            'stats': outcomes[id].stats} for id in sorted(outcomes)}})
    version = _hash(week_bytes)[:20]
    week_path = f'versions/{version}/week-{week_key}.json'
    week_file = output / week_path
    week_file.parent.mkdir(parents=True, exist_ok=True)
    if week_file.exists() and week_file.read_bytes() != week_bytes:
        raise ValueError('existing outcome version differs')
    if not week_file.exists():
        week_file.write_bytes(week_bytes)
    weeks = {**previous['weeks'], manifest_key: {'path': week_path, 'sha256': _hash(week_bytes)}}
    manifest_bytes = _payload({'schema_version': 1, 'generated_at': source['retrieved_at'],
                               'weeks': weeks})
    manifest_version = _hash(manifest_bytes)[:20]
    manifest_path = f'versions/{manifest_version}/manifest.json'
    manifest_file = output / manifest_path
    manifest_file.parent.mkdir(parents=True, exist_ok=True)
    if manifest_file.exists() and manifest_file.read_bytes() != manifest_bytes:
        raise ValueError('existing outcome manifest version differs')
    if not manifest_file.exists():
        manifest_file.write_bytes(manifest_bytes)
    pointer = _payload({'schema_version': 1, 'manifest': manifest_path,
                        'manifest_sha256': _hash(manifest_bytes)})
    with tempfile.NamedTemporaryFile(dir=output, prefix='.outcome-', delete=False) as handle:
        handle.write(pointer)
        temporary = Path(handle.name)
    try:
        os.replace(temporary, output / 'current.json')
    finally:
        temporary.unlink(missing_ok=True)
