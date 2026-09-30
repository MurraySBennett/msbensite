"""Issue-time rolling evaluation of the pilot model against recent-history scoring."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field, replace
from datetime import datetime, timedelta, timezone
import argparse
from hashlib import sha256
import json
import math
from pathlib import Path
import random
import re

from .decision import (Player, ScoringRules, Slot, StatLine, SUPPORTED_STATS,
                       best_lineup, rolling_baseline, score)
from .model import fit_predict
from .source import WeekInput, _source_urls, load_week


PPR_RULES = ScoringRules({
    'passing_yards': .04, 'passing_tds': 4, 'passing_interceptions': -2,
    'rushing_yards': .1, 'rushing_tds': 6, 'receptions': 1,
    'receiving_yards': .1, 'receiving_tds': 6, 'fumbles_lost_total': -2,
    'fg_made': 3, 'pat_made': 1,
})
FEATURE_GROUPS = ('recent_usage', 'opponent_position', 'past_score_clock',
                  'injury', 'weather', 'season_phase')
SIGNED_YARDAGE = frozenset(('passing_yards', 'rushing_yards', 'receiving_yards'))
SAFE_FEATURE_ORIGINS = frozenset(('pre_game_archive', 'prior_game_observation',
                                  'weather_forecast'))


@dataclass(frozen=True)
class FeatureRecord:
    group: str
    issued_at: str
    origin: str


@dataclass(frozen=True)
class BacktestCase:
    season: int
    week: int
    cutoff_utc: str
    outcomes: dict[str, StatLine]
    outcome_source: dict[str, str]
    provenance: str
    features: tuple[FeatureRecord, ...] = ()
    scenario_observations: dict[str, dict] = field(default_factory=dict)
    capture_dir: Path | None = None
    scenario_snapshot_path: Path | None = None
    scenario_snapshot_sha256: str | None = None


@dataclass(frozen=True)
class CutoffPolicy:
    cache_dir: Path
    cases: tuple[BacktestCase, ...]
    rules: ScoringRules = field(default_factory=lambda: PPR_RULES)
    draws: int = 256
    synthetic_rosters_per_week: int = 32


@dataclass(frozen=True)
class BacktestReport:
    seasons: list[int]
    seed: int
    cutoffs: list[dict]
    sample_sizes: dict
    overall: dict
    by_position: dict
    by_history: dict
    calibration: dict
    roster_regret: dict
    ablations: dict
    scenario_coverage: dict
    release_decision: str
    limitations: list[str]


def _instant(value: str) -> datetime:
    if not isinstance(value, str):
        raise ValueError('timestamp must be a string')
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError(f'timestamp lacks timezone: {value}')
    return parsed.astimezone(timezone.utc)


def validate_prelock_input(week: WeekInput,
                           features: tuple[FeatureRecord, ...] = ()) -> None:
    """Reject post-cutoff features even when a caller bypasses load_week."""
    cutoff = _instant(week.cutoff_utc)
    if not 1 <= week.week <= 18 or week.roster_week > week.week:
        raise ValueError('invalid forecast week or roster week')
    for name, capture in week.captures.items():
        if (_instant(capture['retrieved_at']) > cutoff or
                capture.get('licence') != 'CC-BY-4.0' or
                not re.fullmatch(r'[a-f0-9]{64}', capture.get('sha256', ''))):
            raise ValueError(f'source capture after cutoff or unverified: {name}')
    for player_id, rows in week.history.items():
        for row in rows:
            row_week = row.get('week')
            if (not isinstance(row_week, (int, float)) or
                    not math.isfinite(row_week) or int(row_week) != row_week or
                    row_week >= week.week or row_week < 1):
                raise ValueError(f'current-week stats in prelock input: {player_id}')
    for injury in week.injuries.values():
        if _instant(injury.modified_at) > cutoff:
            raise ValueError(f'injury after cutoff: {injury.player_id}')
    for game in week.games_by_player.values():
        if _instant(game.kickoff_utc) <= cutoff:
            raise ValueError('game at or before forecast cutoff')
    for feature in features:
        if feature.origin == 'observed_game_weather':
            raise ValueError('observed weather cannot be a pregame feature')
        if feature.group not in FEATURE_GROUPS or feature.origin not in SAFE_FEATURE_ORIGINS:
            raise ValueError(f'observed game or unsupported feature: {feature.group}')
        if _instant(feature.issued_at) > cutoff:
            raise ValueError(f'feature after cutoff: {feature.group}')


def compare_roster(players: list[Player], slots: list[Slot],
                   model_means: dict[str, float], baseline_means: dict[str, float],
                   realized: dict[str, float]) -> dict:
    """Evaluate both policies against the identical legal roster and oracle."""
    model = best_lineup(players, slots, model_means, {})
    baseline = best_lineup(players, slots, baseline_means, {})
    oracle = best_lineup(players, slots, realized, {})
    def total(lineup):
        return sum(realized[player_id] for player_id in lineup.assignments.values())
    oracle_points = total(oracle)
    return {'oracle_points': oracle_points,
            'model_regret': round(oracle_points - total(model), 6),
            'baseline_regret': round(oracle_points - total(baseline), 6),
            'disagreed': model.assignments != baseline.assignments,
            'model_lineup': model.assignments,
            'baseline_lineup': baseline.assignments}


def _quantile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    return ordered[math.floor((len(ordered) - 1) * fraction)]


def _metrics(rows: list[dict]) -> dict:
    if not rows:
        return {'paired_players': 0, 'model_mae': None, 'baseline_mae': None,
                'model_coverage80': None, 'baseline_coverage80': None,
                'model_brier10': None, 'baseline_brier10': None}
    n = len(rows)
    return {'paired_players': n,
            'model_mae': sum(abs(row['model_mean'] - row['actual']) for row in rows) / n,
            'baseline_mae': sum(abs(row['baseline_mean'] - row['actual']) for row in rows) / n,
            'model_coverage80': sum(row['model_low'] <= row['actual'] <= row['model_high']
                                    for row in rows) / n,
            'baseline_coverage80': sum(row['baseline_low'] <= row['actual'] <= row['baseline_high']
                                       for row in rows) / n,
            'model_brier10': sum((row['model_p10'] - row['event10']) ** 2 for row in rows) / n,
            'baseline_brier10': sum((row['baseline_p10'] - row['event10']) ** 2 for row in rows) / n}


def _model_only_metrics(rows: list[dict]) -> dict:
    if not rows:
        return {'model_only_players': 0, 'model_only_mae': None,
                'model_only_coverage80': None, 'model_only_brier10': None}
    n = len(rows)
    return {'model_only_players': n,
            'model_only_mae': sum(abs(row['model_mean'] - row['actual']) for row in rows) / n,
            'model_only_coverage80': sum(row['model_low'] <= row['actual'] <= row['model_high']
                                         for row in rows) / n,
            'model_only_brier10': sum((row['model_p10'] - row['event10']) ** 2
                                       for row in rows) / n}


def _baseline_rows(week: WeekInput, rules: ScoringRules) -> tuple[dict, dict]:
    history = []
    recent = {}
    cutoff = _instant(week.cutoff_utc)
    for player_id, rows in week.history.items():
        ordered = sorted(rows, key=lambda row: row['week'])[-3:]
        recent[player_id] = [score(StatLine(player_id, week.cutoff_utc, row), rules)
                             for row in ordered]
        for row in rows:
            # These timestamps order already captured weekly rows for Task 2's
            # baseline; they are never treated as evidence of source issue time.
            at = cutoff - timedelta(days=7 * (week.week - int(row['week'])))
            history.append(StatLine(player_id, at.isoformat(), row))
    return rolling_baseline(history, week.cutoff_utc, rules), recent


def sample_synthetic_rosters(week: WeekInput, common: set[str], count: int, seed: int):
    by_position = {position: [Player(player.player_id, player.position, player.team)
                              for player in week.players if player.player_id in common
                              and player.player_id in week.games_by_player and
                              player.position == position]
                   for position in ('QB', 'RB', 'WR', 'TE', 'K')}
    rng = random.Random(seed)
    if (len(by_position['QB']) >= 2 and len(by_position['RB']) >= 2 and
            len(by_position['WR']) >= 2 and by_position['TE'] and by_position['K']):
        positions = {'QB': 2, 'RB': 2, 'WR': 2, 'TE': 1, 'K': 1}
        slots = [Slot('QB', ('QB',)), Slot('RB', ('RB',)), Slot('WR', ('WR',)),
                 Slot('TE', ('TE',)), Slot('K', ('K',)),
                 Slot('FLEX', ('RB', 'WR', 'TE')),
                 Slot('SUPERFLEX', ('QB', 'RB', 'WR', 'TE'))]
    elif len(by_position['WR']) >= 2 and by_position['K']:
        positions = {'WR': 2, 'K': 1}
        slots = [Slot('WR', ('WR',)), Slot('K', ('K',))]
    else:
        return []
    rosters = []
    seen = set()
    for _ in range(max(count * 20, 20)):
        players = [player for position, number in positions.items()
                   for player in rng.sample(by_position[position], number)]
        player_ids = frozenset(player.player_id for player in players)
        if player_ids not in seen:
            seen.add(player_ids)
            rosters.append((players, slots))
            if len(rosters) == count:
                break
    return rosters


def _reviewed_path(root: Path, name: str) -> Path:
    path = Path(name)
    if path.is_absolute() or '..' in path.parts or not path.parts:
        raise ValueError('invalid reviewed final outcome path')
    resolved = (root / path).resolve()
    if not resolved.is_relative_to(root.resolve()):
        raise ValueError('reviewed final outcome path escapes archive')
    return resolved


def _validate_outcomes(case: BacktestCase, week: WeekInput,
                       rules: ScoringRules, archive: Path) -> None:
    source = case.outcome_source
    if (source.get('status') != 'final' or not source.get('licence') or
            not source.get('url', '').startswith('https://') or
            not re.fullmatch(r'[a-f0-9]{64}', source.get('raw_sha256', ''))):
        raise ValueError('final outcome source attribution required')
    retrieved = _instant(source['retrieved_at'])
    if case.provenance == 'historical archive':
        expected_url = _source_urls(case.season)[f'stats_player_week_{case.season}.csv']
        if source['url'] != expected_url:
            raise ValueError('approved final outcome URL required')
        if (source['licence'] != 'CC-BY-4.0' or
                not source.get('reviewer') or
                not source.get('reviewed_at') or
                _instant(source['reviewed_at']) < retrieved or
                not re.fullmatch(r'[a-f0-9]{64}',
                                 source.get('normalized_sha256', '')) or
                not source.get('raw_path') or not source.get('normalized_path')):
            raise ValueError('reviewed final outcome evidence required')
        raw = _reviewed_path(archive, source['raw_path'])
        normalized = _reviewed_path(archive, source['normalized_path'])
        if (sha256(raw.read_bytes()).hexdigest() != source['raw_sha256'] or
                sha256(normalized.read_bytes()).hexdigest() !=
                source['normalized_sha256']):
            raise ValueError('final outcome checksum mismatch')
        if json.loads(normalized.read_text()) != {
                player_id: asdict(row) for player_id, row in case.outcomes.items()}:
            raise ValueError('normalized final outcomes differ from reviewed file')
    expected = set(week.games_by_player)
    if set(case.outcomes) != expected:
        raise ValueError('outcome pool incomplete or differs from scheduled players')
    for player_id, row in case.outcomes.items():
        if (row.player_id != player_id or
                not _instant(week.games_by_player[player_id].kickoff_utc) <=
                _instant(row.observed_at) <= retrieved):
            raise ValueError(f'invalid final outcome time or player: {player_id}')
        if not set(rules.coefficients) <= set(row.stats):
            raise ValueError(f'missing scoring stat in final outcome: {player_id}')
        if (set(row.stats) - SUPPORTED_STATS or
                any(not isinstance(value, (int, float)) or isinstance(value, bool) or
                    not math.isfinite(value) or
                    (value < 0 and field not in SIGNED_YARDAGE)
                    for field, value in row.stats.items())):
            raise ValueError(f'invalid final stat: {player_id}')


def _validate_frozen_scenario(case: BacktestCase, week: WeekInput,
                              forecast, archive: Path) -> None:
    if not case.scenario_observations:
        return
    path, digest = case.scenario_snapshot_path, case.scenario_snapshot_sha256
    if (path is None or not isinstance(digest, str) or
            not re.fullmatch(r'[a-f0-9]{64}', digest)):
        raise ValueError('frozen pregame snapshot required for scenario coverage')
    path = Path(path).resolve()
    if not path.is_relative_to(archive.resolve()):
        raise ValueError('frozen pregame snapshot must be in the cutoff archive')
    content = path.read_bytes()
    if sha256(content).hexdigest() != digest:
        raise ValueError('frozen pregame snapshot checksum mismatch')
    manifest = json.loads(content)
    generated = _instant(manifest['generated_at'])
    if (manifest.get('schema_version') != 1 or
            (manifest.get('season'), manifest.get('week')) !=
            (week.season, week.week) or
            manifest.get('cutoff_utc') != week.cutoff_utc or
            manifest.get('seed') != forecast.seed or
            manifest.get('draw_count') != forecast.draw_count or
            manifest.get('sources') != week.captures or
            manifest.get('games') != forecast.games or
            generated < max(_instant(item['retrieved_at']) for item in week.captures.values()) or
            generated > min(_instant(game.kickoff_utc)
                            for game in week.games_by_player.values())):
        raise ValueError('frozen pregame snapshot does not match forecast and issue window')
    root = path.parent.parent.parent
    seen = set()
    for descriptor in manifest['shards']:
        shard_path = _reviewed_path(root, descriptor['path'])
        shard = shard_path.read_bytes()
        if sha256(shard).hexdigest() != descriptor['sha256']:
            raise ValueError('frozen pregame snapshot shard checksum mismatch')
        parsed = json.loads(shard)
        if parsed['team_opportunity'] != forecast.team_opportunity[descriptor['team']]:
            raise ValueError('frozen pregame team draws differ')
        for player_id, player in parsed['players'].items():
            if player_id in seen or player_id not in forecast.players or\
                    player != asdict(forecast.players[player_id]):
                raise ValueError('frozen pregame player draws differ')
            seen.add(player_id)
    if seen != set(forecast.players):
        raise ValueError('frozen pregame player pool incomplete')


def run_backtest(seasons: list[int], cutoff_policy: CutoffPolicy,
                 seed: int) -> BacktestReport:
    """Score archived cutoff cases only; absent archives yield zero evidence."""
    if cutoff_policy.draws < 1 or cutoff_policy.synthetic_rosters_per_week < 1:
        raise ValueError('draws and roster count must be positive')
    cases = sorted((case for case in cutoff_policy.cases if case.season in seasons),
                   key=lambda case: (case.season, case.week))
    if len({(case.season, case.week) for case in cases}) != len(cases):
        raise ValueError('duplicate historical week')
    if len({case.provenance for case in cases}) > 1:
        raise ValueError('mixed fixture and historical cases cannot share evidence metrics')
    if any(case.provenance == 'historical archive' and case.scenario_observations
           for case in cases):
        raise ValueError('real scenario coverage needs a reviewed participation source adapter')
    archive_paths = [Path(case.capture_dir).resolve() for case in cases
                     if case.provenance == 'historical archive' and case.capture_dir is not None]
    if len(archive_paths) != len(set(archive_paths)):
        raise ValueError('historical weeks need distinct per-cutoff archives')
    paired_rows, all_rows, roster_rows, cutoffs = [], [], [], []
    disagreement_weeks = 0
    ablations = {name: {'status': 'prospective only', 'n': 0,
                        'mean_delta_mae': None, 'changed_lineups': 0}
                 for name in FEATURE_GROUPS}
    ablations['season_phase']['status'] = 'not modeled'
    scenario_rows = []
    usage_rows = []
    fixture_weeks = 0
    for index, case in enumerate(cases):
        if case.provenance not in ('historical archive', 'synthetic fixture'):
            raise ValueError('unknown backtest provenance')
        if case.provenance == 'historical archive' and case.capture_dir is None:
            raise ValueError('historical case requires a per-cutoff archive')
        cache = Path(case.capture_dir or cutoff_policy.cache_dir)
        if not (cache / 'captures.json').is_file() or any(
                not (cache / name).is_file() for name in _source_urls(case.season)):
            raise ValueError('missing archived captures for historical cutoff')
        week = load_week(case.season, case.week, case.cutoff_utc, cache)
        validate_prelock_input(week, case.features)
        _validate_outcomes(case, week, cutoff_policy.rules, cache)
        if case.provenance != 'historical archive':
            fixture_weeks += 1
        forecast = fit_predict(week, seed + index, cutoff_policy.draws)
        _validate_frozen_scenario(case, week, forecast, cache)
        means, distributions = {}, {}
        for player_id, player in forecast.players.items():
            values = [score(StatLine(player_id, case.cutoff_utc, draw.stats),
                            cutoff_policy.rules) for draw in player.draws]
            distributions[player_id] = values
            means[player_id] = sum(values) / len(values)
        baseline, recent = _baseline_rows(week, cutoff_policy.rules)
        actual = {player_id: score(row, cutoff_policy.rules)
                  for player_id, row in case.outcomes.items()}
        common = set(means) & set(baseline) & set(actual)
        for player in week.players:
            player_id = player.player_id
            if player_id not in means or player_id not in actual:
                continue
            samples = distributions[player_id]
            row = {'position': player.position, 'paired': player_id in common,
                   'history_band': ('zero' if not week.history[player_id] else
                                    'sparse' if len(week.history[player_id]) < 3 else 'established'),
                   'actual': actual[player_id], 'model_mean': means[player_id],
                   'model_low': _quantile(samples, .1),
                   'model_high': _quantile(samples, .9),
                   'model_p10': sum(value >= 10 for value in samples) / len(samples),
                   'event10': actual[player_id] >= 10}
            all_rows.append(row)
            if player_id not in common:
                continue
            baseline_samples = recent[player_id]
            paired_rows.append({**row, 'baseline_mean': baseline[player_id],
                                'baseline_low': _quantile(baseline_samples, .1),
                                'baseline_high': _quantile(baseline_samples, .9),
                                'baseline_p10': sum(value >= 10 for value in baseline_samples)
                                / len(baseline_samples)})
        sampled = sample_synthetic_rosters(week, common,
                                           cutoff_policy.synthetic_rosters_per_week,
                                           seed + index)
        week_roster_rows = [compare_roster(players, slots, means, baseline, actual)
                            for players, slots in sampled]
        roster_rows.extend(week_roster_rows)
        disagreement_weeks += int(any(row['disagreed'] for row in week_roster_rows))
        cutoffs.append({'season': case.season, 'week': case.week,
                        'cutoff_utc': case.cutoff_utc, 'source_captures':
                        {name: {field: entry[field] for field in
                                ('url', 'retrieved_at', 'sha256', 'licence')}
                         for name, entry in week.captures.items()},
                        'outcome_source': {field: value for field, value in
                                           case.outcome_source.items() if field not in
                                           ('raw_path', 'normalized_path')},
                        'provenance': case.provenance,
                        'eligible_players': len(means), 'paired_players': len(common),
                        'synthetic_rosters': len(sampled)})
        for group in ('recent_usage', 'injury'):
            if group == 'recent_usage' and not any(week.history.values()):
                continue
            if group == 'injury' and not week.injuries:
                continue
            if group == 'recent_usage':
                stripped = {player_id: [{k: v for k, v in row.items()
                                         if k not in ('targets', 'carries', 'attempts')}
                                        for row in rows]
                            for player_id, rows in week.history.items()}
                ablated_week = replace(week, history=stripped)
            else:
                ablated_week = replace(week, injuries={})
            ablated = fit_predict(ablated_week, seed + index, cutoff_policy.draws)
            ablated_means = {player_id: sum(score(
                StatLine(player_id, case.cutoff_utc, draw.stats), cutoff_policy.rules)
                for draw in player.draws) / len(player.draws)
                for player_id, player in ablated.players.items()}
            original_mae = sum(abs(means[id] - actual[id]) for id in common) / len(common) if common else None
            ablated_mae = (sum(abs(ablated_means[id] - actual[id]) for id in common) / len(common)
                           if common else None)
            if original_mae is not None:
                item = ablations[group]
                item['status'] = 'evaluated'
                item['n'] += 1
                item['mean_delta_mae'] = ((item['mean_delta_mae'] or 0) +
                                          ablated_mae - original_mae)
                item['changed_lineups'] += sum(
                    best_lineup(players, slots, means, {}).assignments !=
                    best_lineup(players, slots, ablated_means, {}).assignments
                    for players, slots in sampled)
        for player_id, observed in case.scenario_observations.items():
            if player_id not in forecast.players:
                raise ValueError(f'scenario observation player not forecast: {player_id}')
            if type(observed.get('available')) is not bool:
                raise ValueError('scenario availability must be Boolean')
            if any(not isinstance(observed[field], (int, float)) or
                   isinstance(observed[field], bool) or
                   not math.isfinite(observed[field]) or observed[field] < 0
                   for field in ('targets', 'carries') if field in observed):
                raise ValueError('invalid scenario usage observation')
            if not (_instant(week.games_by_player[player_id].kickoff_utc) <=
                    _instant(observed['observed_at']) <=
                    _instant(case.outcome_source['retrieved_at'])):
                raise ValueError('scenario observation outside final result window')
            draws = forecast.players[player_id].draws
            availability = sum(draw.available for draw in draws) / len(draws)
            scenario_rows.append((availability, observed['available']))
            if observed['available']:
                active_draws = [draw for draw in draws if draw.available]
                for field in ('targets', 'carries'):
                    if field in observed and active_draws:
                        values = [draw.stats[field] for draw in active_draws]
                        usage_rows.append(_quantile(values, .1) <= observed[field] <=
                                          _quantile(values, .9))
    for group in ('recent_usage', 'injury'):
        item = ablations[group]
        if item['n']:
            item['mean_delta_mae'] /= item['n']
    groups = {'zero': [], 'sparse': [], 'established': []}
    for row in paired_rows:
        groups[row['history_band']].append(row)
    by_history = {name: {**_metrics(rows), **_model_only_metrics([
        row for row in all_rows if row['history_band'] == name and not row['paired']])}
                  for name, rows in groups.items()}
    by_position = {position: {**_metrics([row for row in paired_rows
                                         if row['position'] == position]),
                              **_model_only_metrics([row for row in all_rows
                                                     if row['position'] == position and
                                                     not row['paired']])}
                   for position in ('QB', 'RB', 'WR', 'TE', 'K')}
    calibration = {'n': len(paired_rows), 'event': 'realized PPR points >= 10',
                   'model_brier': _metrics(paired_rows)['model_brier10'],
                   'baseline_brier': _metrics(paired_rows)['baseline_brier10'],
                   'bins': None}
    if len(paired_rows) >= 20:
        bins = []
        for low, high in ((0, 1/3), (1/3, 2/3), (2/3, 1.000001)):
            selected = [row for row in paired_rows if low <= row['model_p10'] < high]
            if len(selected) < 5:
                bins = []
                break
            bins.append({'range': [low, min(high, 1)], 'n': len(selected),
                         'mean_forecast': sum(row['model_p10'] for row in selected) / len(selected),
                         'observed_rate': sum(row['event10'] for row in selected) / len(selected)})
        if bins:
            calibration['bins'] = bins
    roster_regret = {'n': len(roster_rows),
                     'model_mean': (sum(row['model_regret'] for row in roster_rows) /
                                    len(roster_rows) if roster_rows else None),
                     'baseline_mean': (sum(row['baseline_regret'] for row in roster_rows) /
                                       len(roster_rows) if roster_rows else None),
                     'disagreements': sum(row['disagreed'] for row in roster_rows),
                     'disagreement_weeks': disagreement_weeks,
                     'inference_note': ('Too few model/baseline lineup disagreements for a policy claim.'
                                        if disagreement_weeks < 8 else
                                        'Synthetic rosters within a week are dependent; descriptive only.')}
    real_weeks = len(cases) - fixture_weeks
    return BacktestReport(sorted(set(seasons)), seed, cutoffs,
                          {'weeks': len(cases), 'real_weeks': real_weeks,
                           'fixture_weeks': fixture_weeks, 'model_players': len(all_rows),
                           'paired_players': len(paired_rows),
                           'baseline_missing_players': len(all_rows) - len(paired_rows),
                           'synthetic_rosters': len(roster_rows)},
                          {**_metrics(paired_rows),
                           **{'model_all_mae': (_model_only_metrics(all_rows)['model_only_mae'])}},
                          by_position, by_history,
                          calibration, roster_regret, ablations,
                          {'n': len(scenario_rows),
                           'availability_brier': (sum((probability - actual) ** 2
                                                      for probability, actual in scenario_rows) /
                                                  len(scenario_rows) if scenario_rows else None),
                           'usage_n': len(usage_rows),
                           'usage_coverage80': (sum(usage_rows) / len(usage_rows)
                                                if usage_rows else None)},
                          'insufficient real evidence' if real_weeks < 8 else
                          'requires baseline and calibration review',
                          ['No historical result is inferred from a fixture.',
                           'Only captures retrieved before each cutoff are admissible.',
                           'Baseline intervals use up to three prior player scores and are unstable when sparse.',
                           'Synthetic roster samples are not actual league rosters.'])


def _cli() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seasons', type=int, nargs='+', required=True)
    parser.add_argument('--cache', type=Path, default=Path('.cache/fantasy'))
    parser.add_argument('--cases', type=Path, help='JSON catalog of archived cutoffs and final outcomes')
    parser.add_argument('--seed', type=int, default=7026)
    parser.add_argument('--draws', type=int, default=256)
    parser.add_argument('--rosters', type=int, default=32)
    args = parser.parse_args()
    cases = []
    if args.cases:
        for item in json.loads(args.cases.read_text()):
            outcomes = {player_id: StatLine(**row) for player_id, row in item['outcomes'].items()}
            features = tuple(FeatureRecord(**record) for record in item.get('features', []))
            cases.append(BacktestCase(item['season'], item['week'], item['cutoff_utc'],
                                      outcomes, item['outcome_source'], item['provenance'],
                                      features, item.get('scenario_observations', {}),
                                      Path(item['capture_dir']) if item.get('capture_dir') else None,
                                      Path(item['scenario_snapshot_path']) if item.get('scenario_snapshot_path') else None,
                                      item.get('scenario_snapshot_sha256')))
    report = run_backtest(args.seasons, CutoffPolicy(args.cache, tuple(cases),
                          draws=args.draws, synthetic_rosters_per_week=args.rosters), args.seed)
    print(json.dumps(asdict(report), indent=2, sort_keys=True, allow_nan=False))


if __name__ == '__main__':
    _cli()
