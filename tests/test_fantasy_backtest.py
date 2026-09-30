"""Backtests must preserve the pre-kickoff information boundary."""

from dataclasses import asdict, replace
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

from fantasy.backtest import (BacktestCase, CutoffPolicy, FeatureRecord,
                              PPR_RULES, compare_roster, run_backtest,
                              sample_synthetic_rosters, validate_prelock_input)
from fantasy.decision import Player, ScoringRules, Slot, StatLine
from fantasy.model import fit_predict
from fantasy.snapshot import write_snapshot
from fantasy.source import GameInput, InjuryInput, PlayerInput, WeekInput, load_week


FIXTURES = Path(__file__).parent / 'fixtures' / 'fantasy'
CUTOFF = '2026-10-02T18:00:00Z'
ASSETS = {
    'stats_player_week_2026.csv': 'stats_player/stats_player_week_2026.csv',
    'roster_weekly_2026.csv': 'weekly_rosters/roster_weekly_2026.csv',
    'injuries_2026.csv': 'injuries/injuries_2026.csv',
    'games.csv': 'schedules/games.csv',
}


def outcomes():
    observed = '2026-10-05T12:00:00Z'
    def row(player_id, fields):
        return StatLine(player_id, observed,
                        {**{field: 0 for field in PPR_RULES.coefficients}, **fields})
    return {
        '00-0000001': row('00-0000001', {'receptions': 5, 'receiving_yards': 50}),
        '00-0000002': row('00-0000002', {'receptions': 8, 'receiving_yards': 80}),
        '00-0000003': row('00-0000003', {'fg_made': 1, 'pat_made': 3}),
        '00-0000005': row('00-0000005', {'carries': 6, 'rushing_yards': 50}),
    }


def case():
    return BacktestCase(2026, 5, CUTOFF, outcomes(),
                        {'name': 'fixture', 'url': 'https://example.invalid/final',
                         'retrieved_at': '2026-10-05T13:00:00Z', 'licence': 'fixture only',
                         'raw_sha256': 'a' * 64, 'status': 'final'},
                        'synthetic fixture')


class FantasyBacktestTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.cache = Path(temp.name)
        captures = {}
        for name, asset in ASSETS.items():
            path = self.cache / name
            shutil.copy2(FIXTURES / name, path)
            captures[name] = {
                'url': f'https://github.com/nflverse/nflverse-data/releases/download/{asset}',
                'retrieved_at': '2026-10-02T16:00:00Z',
                'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                'licence': 'CC-BY-4.0',
            }
        (self.cache / 'captures.json').write_text(json.dumps(captures))

    def policy(self, *cases):
        return CutoffPolicy(self.cache, tuple(cases), draws=24,
                            synthetic_rosters_per_week=4)

    def reviewed_case(self):
        raw = self.cache / 'final-source.csv'
        raw.write_text('reviewed fixture source bytes\n')
        normal = self.cache / 'final-normalized.json'
        normal.write_text(json.dumps({player_id: asdict(row)
                                      for player_id, row in outcomes().items()}, sort_keys=True))
        source = {**case().outcome_source,
                  'url': 'https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_2026.csv',
                  'raw_path': raw.name, 'raw_sha256': hashlib.sha256(raw.read_bytes()).hexdigest(),
                  'normalized_path': normal.name,
                  'normalized_sha256': hashlib.sha256(normal.read_bytes()).hexdigest(),
                  'licence': 'CC-BY-4.0',
                  'reviewer': 'fixture reviewer', 'reviewed_at': '2026-10-05T14:00:00Z'}
        return replace(case(), provenance='historical archive',
                       capture_dir=self.cache, outcome_source=source)

    def test_rejects_current_week_stat_in_a_claimed_prelock_input(self):
        week = load_week(2026, 5, CUTOFF, self.cache)
        history = {key: list(rows) for key, rows in week.history.items()}
        history['00-0000001'].append({'week': 5.0, 'receiving_yards': 100.0})
        with self.assertRaisesRegex(ValueError, 'current-week stats'):
            validate_prelock_input(replace(week, history=history))

    def test_rejects_postcutoff_injury_and_observed_game_weather(self):
        week = load_week(2026, 5, CUTOFF, self.cache)
        injuries = dict(week.injuries)
        injuries['00-0000001'] = InjuryInput('00-0000001', 'Out', '', '',
                                             '2026-10-03T16:00:00Z')
        with self.assertRaisesRegex(ValueError, 'injury after cutoff'):
            validate_prelock_input(replace(week, injuries=injuries))
        with self.assertRaisesRegex(ValueError, 'observed weather'):
            run_backtest([2026], self.policy(replace(case(), features=(
                FeatureRecord('weather', '2026-10-04T21:00:00Z', 'observed_game_weather'),
            ))), seed=4)
        with self.assertRaisesRegex(ValueError, 'observed game'):
            run_backtest([2026], self.policy(replace(case(), features=(
                FeatureRecord('past_score_clock', '2026-10-02T17:00:00Z',
                              'observed_game_score'),
            ))), seed=4)

    def test_paired_fixture_report_has_real_counts_and_sparse_exclusion(self):
        report = run_backtest([2026], self.policy(case()), seed=4)
        self.assertEqual(report.sample_sizes['weeks'], 1)
        self.assertEqual(report.sample_sizes['model_players'], 4)
        self.assertEqual(report.sample_sizes['paired_players'], 3)
        self.assertEqual(report.sample_sizes['baseline_missing_players'], 1)
        self.assertEqual(report.sample_sizes['synthetic_rosters'], 1)
        self.assertEqual(report.roster_regret['disagreement_weeks'], 1)
        self.assertEqual(report.cutoffs[0]['outcome_source']['raw_sha256'], 'a' * 64)
        self.assertEqual(report.cutoffs[0]['source_captures']['games.csv']['licence'],
                         'CC-BY-4.0')
        self.assertAlmostEqual(report.overall['baseline_mae'], 7.033333, places=5)
        self.assertIn('WR', report.by_position)
        self.assertIn('K', report.by_position)
        self.assertEqual(report.by_position['QB']['paired_players'], 0)
        self.assertEqual(report.by_history['zero']['paired_players'], 0)
        self.assertIsNotNone(report.by_history['zero']['model_only_mae'])
        self.assertEqual(report.ablations['recent_usage']['status'], 'evaluated')
        self.assertEqual(report.ablations['weather']['status'], 'prospective only')
        self.assertEqual(report.scenario_coverage['n'], 0)
        self.assertEqual(report.scenario_coverage['usage_n'], 0)
        self.assertEqual(report.release_decision, 'insufficient real evidence')

    def test_real_case_requires_separate_capture_and_verified_outcome_files(self):
        with self.assertRaisesRegex(ValueError, 'per-cutoff archive'):
            run_backtest([2026], self.policy(replace(
                case(), provenance='historical archive')), seed=4)
        with self.assertRaisesRegex(ValueError, 'reviewed final outcome'):
            run_backtest([2026], self.policy(replace(
                case(), provenance='historical archive', capture_dir=self.cache,
                outcome_source={**case().outcome_source,
                    'url': 'https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_2026.csv'})), seed=4)

    def test_reviewed_case_checks_raw_and_normalized_hashes(self):
        reviewed = self.reviewed_case()
        report = run_backtest([2026], self.policy(reviewed), seed=4)
        self.assertEqual(report.sample_sizes['real_weeks'], 1)
        unapproved = replace(reviewed, outcome_source={**reviewed.outcome_source,
                           'url': 'https://example.invalid/final'})
        with self.assertRaisesRegex(ValueError, 'approved final outcome URL'):
            run_backtest([2026], self.policy(unapproved), seed=4)
        (self.cache / 'final-source.csv').write_text('corrupted')
        with self.assertRaisesRegex(ValueError, 'final outcome checksum'):
            run_backtest([2026], self.policy(reviewed), seed=4)

    def test_cli_replays_reviewed_case_from_its_own_archive(self):
        reviewed = self.reviewed_case()
        catalog = self.cache / 'catalog.json'
        catalog.write_text(json.dumps([{**asdict(reviewed),
                                        'capture_dir': str(reviewed.capture_dir)}]))
        command = [sys.executable, '-m', 'fantasy.backtest', '--seasons', '2026',
                   '--cases', str(catalog), '--cache', str(self.cache / 'unused'),
                   '--seed', '4', '--draws', '24', '--rosters', '4']
        first = subprocess.run(command, text=True, capture_output=True)
        self.assertEqual(first.returncode, 0, first.stderr)
        second = subprocess.run(command, text=True, capture_output=True)
        self.assertEqual(first.stdout, second.stdout)
        self.assertEqual(json.loads(first.stdout)['sample_sizes']['real_weeks'], 1)

    def test_two_rolling_cutoffs_cannot_reuse_one_archive_directory(self):
        reviewed = self.reviewed_case()
        later = replace(reviewed, week=6, cutoff_utc='2026-10-09T18:00:00Z')
        with self.assertRaisesRegex(ValueError, 'distinct per-cutoff archives'):
            run_backtest([2026], self.policy(reviewed, later), seed=4)

    def test_fixture_and_historical_cases_cannot_share_evidence_metrics(self):
        reviewed = self.reviewed_case()
        synthetic = replace(case(), week=6, cutoff_utc='2026-10-09T18:00:00Z')
        with self.assertRaisesRegex(ValueError, 'mixed fixture and historical'):
            run_backtest([2026], self.policy(reviewed, synthetic), seed=4)

    def test_real_scenario_observations_need_a_reviewed_participation_adapter(self):
        reviewed = self.reviewed_case()
        observed = {'00-0000001': {'observed_at': '2026-10-05T12:00:00Z',
                                   'available': True, 'targets': 8}}
        with self.assertRaisesRegex(ValueError, 'reviewed participation source'):
            run_backtest([2026], self.policy(replace(
                reviewed, scenario_observations=observed)), seed=4)

    def test_incomplete_or_invalid_final_stats_cannot_be_scored_as_zero(self):
        rows = outcomes()
        player = rows['00-0000001']
        stats = dict(player.stats)
        del stats['receiving_yards']
        rows[player.player_id] = replace(player, stats=stats)
        with self.assertRaisesRegex(ValueError, 'missing scoring stat'):
            run_backtest([2026], self.policy(replace(case(), outcomes=rows)), seed=4)
        stats['receiving_yards'] = 50
        stats['receptions'] = -1
        rows[player.player_id] = replace(player, stats=stats)
        with self.assertRaisesRegex(ValueError, 'invalid final stat'):
            run_backtest([2026], self.policy(replace(case(), outcomes=rows)), seed=4)

    def test_no_stat_roster_player_needs_an_explicit_reviewed_zero_row(self):
        rows = outcomes()
        missing = dict(rows)
        del missing['00-0000005']
        with self.assertRaisesRegex(ValueError, 'outcome pool incomplete'):
            run_backtest([2026], self.policy(replace(case(), outcomes=missing)), seed=4)
        rows['00-0000005'] = replace(rows['00-0000005'],
                                     stats={field: 0 for field in PPR_RULES.coefficients})
        self.assertEqual(run_backtest([2026], self.policy(replace(
            case(), outcomes=rows)), seed=4).sample_sizes['model_players'], 4)

    def test_same_roster_and_oracle_score_both_policies(self):
        players = [Player('a', 'WR'), Player('b', 'WR')]
        slots = [Slot('WR', ('WR',))]
        paired = compare_roster(players, slots, {'a': 20, 'b': 10},
                                {'a': 10, 'b': 20}, {'a': 5, 'b': 15})
        self.assertEqual(paired['oracle_points'], 15)
        self.assertEqual(paired['model_regret'], 10)
        self.assertEqual(paired['baseline_regret'], 0)
        self.assertTrue(paired['disagreed'])

    def test_seeded_synthetic_roster_includes_legal_kicker_and_superflex(self):
        positions = ('QB', 'QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'K')
        players = [PlayerInput(str(index), f'Player {index}', 'AA', position)
                   for index, position in enumerate(positions)]
        game = GameInput('fixture', 'AA', 'BB', '2026-10-04T17:00:00Z')
        week = WeekInput(2026, 5, 5, CUTOFF, players,
                         {player.player_id: game for player in players},
                         {player.player_id: [] for player in players}, {}, {})
        rosters = sample_synthetic_rosters(week, {p.player_id for p in players}, 2, 4)
        self.assertEqual(len(rosters), 2)
        self.assertEqual({slot.slot_id for slot in rosters[0][1]},
                         {'QB', 'RB', 'WR', 'TE', 'K', 'FLEX', 'SUPERFLEX'})
        points = {player.player_id: float(index) for index, player in enumerate(players)}
        self.assertGreaterEqual(compare_roster(rosters[0][0], rosters[0][1],
                                               points, points, points)['oracle_points'], 0)
        self.assertEqual(rosters, sample_synthetic_rosters(
            week, {p.player_id for p in players}, 2, 4))

    def test_empty_backtest_never_divides_by_zero_or_claims_calibration(self):
        report = run_backtest([2023, 2024, 2025], self.policy(), seed=7026)
        self.assertEqual(report.sample_sizes['weeks'], 0)
        self.assertIsNone(report.overall['model_mae'])
        self.assertIsNone(report.overall['baseline_mae'])
        self.assertIsNone(report.calibration['bins'])
        self.assertEqual(report.calibration['n'], 0)
        self.assertEqual(report.roster_regret['disagreements'], 0)
        self.assertIn('too few', report.roster_regret['inference_note'].lower())
        self.assertEqual(report.release_decision, 'insufficient real evidence')

    def test_frozen_availability_and_usage_scenarios_are_checked_after_game(self):
        observed = {'00-0000001': {'observed_at': '2026-10-05T12:00:00Z',
                                   'available': True, 'targets': 8}}
        with self.assertRaisesRegex(ValueError, 'frozen pregame snapshot'):
            run_backtest([2026], self.policy(replace(
                case(), scenario_observations=observed)), seed=4)
        forecast = fit_predict(load_week(2026, 5, CUTOFF, self.cache), seed=4, draws=24)
        forecast = replace(forecast, generated_at='2026-10-02T18:01:00Z')
        snapshot = self.cache / 'snapshot'
        write_snapshot(forecast, snapshot)
        pointer = json.loads((snapshot / 'current.json').read_text())
        frozen = replace(case(), scenario_observations=observed,
                         scenario_snapshot_path=snapshot / pointer['manifest'],
                         scenario_snapshot_sha256=pointer['manifest_sha256'])
        report = run_backtest([2026], self.policy(frozen), seed=4)
        self.assertEqual(report.scenario_coverage['n'], 1)
        self.assertEqual(report.scenario_coverage['usage_n'], 1)
        self.assertGreaterEqual(report.scenario_coverage['usage_coverage80'], 0)
        self.assertLessEqual(report.scenario_coverage['usage_coverage80'], 1)
        bad = {'00-0000001': {**observed['00-0000001'], 'available': 'false'}}
        with self.assertRaisesRegex(ValueError, 'scenario availability'):
            run_backtest([2026], self.policy(replace(
                frozen, scenario_observations=bad)), seed=4)


if __name__ == '__main__':
    unittest.main()
