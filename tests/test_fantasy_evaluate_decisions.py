"""Prospective decision scoring uses frozen choices and explicit observed rows."""

import copy
from dataclasses import replace
import json
import tempfile
import unittest
from pathlib import Path

from fantasy.decision import StatLine
from fantasy.evaluate_decisions import (evaluate_week, aggregate_results,
                                        write_outcome_snapshot)


def record():
    return {
        'schema_version': 1, 'season': 2026, 'week': 5,
        'data_cutoff_utc': '2026-10-02T18:00:00Z',
        'model_version': 'pilot-0.1', 'snapshot_sha256': 'a' * 64,
        'roster': [
            {'player_id': 'a', 'name': 'Alex', 'position': 'WR', 'team': 'AA'},
            {'player_id': 'b', 'name': 'Blair', 'position': 'WR', 'team': 'BB'},
            {'player_id': 'c', 'name': 'Casey', 'position': 'WR', 'team': 'CC'},
            {'player_id': 'k', 'name': 'Kicker', 'position': 'K', 'team': 'AA'},
            {'player_id': 'dst', 'name': 'Defense', 'position': 'DST', 'team': 'AA'},
        ],
        'slots': [
            {'slot_id': 'WR', 'eligible_positions': ['WR'], 'modeled': True},
            {'slot_id': 'K', 'eligible_positions': ['K'], 'modeled': True},
            {'slot_id': 'DST', 'eligible_positions': ['DST'], 'modeled': False,
             'fixed_player_id': 'dst'},
        ],
        'rules': {'coefficients': {'receptions': 1, 'receiving_yards': .1,
                                   'fg_made': 3, 'pat_made': 1}},
        'game_locks': {id: '2026-10-04T17:00:00Z' for id in ('a', 'b', 'c', 'k')},
        'initial': {'lineup': {'WR': 'a', 'K': 'k', 'DST': 'dst'},
                    'comparisons': [{'a': 'a', 'b': 'b', 'probability': .6}],
                    'external_forecast_seen': False, 'excluded_from_prospective': False},
        'advice': {'lineup': {'WR': 'b', 'K': 'k', 'DST': 'dst'},
                   'comparisons': [{'a': 'a', 'b': 'b', 'probabilityA': None}],
                   'calibrated': False,
                   'player_means': {'a': 11, 'b': 14, 'c': 8, 'k': 6}},
        'final': {'lineup': {'WR': 'c', 'K': 'k', 'DST': 'dst'},
                  'comparisons': [{'a': 'a', 'b': 'b', 'probability': .3}],
                  'override_reasons': {'WR': 'I expect Casey to get more work'},
                  'excluded_from_prospective': False},
        'prelock_final': {'lineup': {'WR': 'c', 'K': 'k', 'DST': 'dst'},
                          'comparisons': [{'a': 'a', 'b': 'b', 'probability': .3}],
                          'excluded_from_prospective': False},
    }


def outcomes():
    at = '2026-10-05T12:00:00Z'
    return {
        'a': StatLine('a', at, {'receptions': 5, 'receiving_yards': 50}),
        'b': StatLine('b', at, {'receptions': 8, 'receiving_yards': 80}),
        'c': StatLine('c', at, {'receptions': 3, 'receiving_yards': 30}),
        'k': StatLine('k', at, {'fg_made': 2, 'pat_made': 1}),
    }


def public_manifest():
    return {'schema_version': 1, 'season': 2026, 'week': 5,
            'games': {id: {'kickoff_utc': '2026-10-04T17:00:00Z'}
                      for id in ('a', 'b', 'c', 'k')}}


def outcome_key(manifest):
    digest = __import__('hashlib').sha256(
        (json.dumps(manifest, sort_keys=True, separators=(',', ':')) + '\n').encode()).hexdigest()
    return f'{manifest["season"]}-{manifest["week"]}:{digest}'


def result_source(retrieved_at='2026-10-05T12:00:00Z'):
    return {'name': 'fixture', 'url': 'https://example.invalid/final-fixture',
            'retrieved_at': retrieved_at, 'licence': 'fixture only',
            'raw_sha256': 'f' * 64, 'status': 'final'}


class EvaluateDecisionTests(unittest.TestCase):
    def test_three_frozen_lineups_oracle_and_harmful_override(self):
        result = evaluate_week(record(), outcomes())
        self.assertEqual(result.status, 'complete')
        self.assertEqual(result.realized_points, {'initial': 17, 'model': 23,
                                                  'final': 13})
        self.assertEqual(result.oracle_points, 23)
        self.assertEqual(result.regret, {'initial': 6, 'model': 0, 'final': 10})
        self.assertEqual(result.override_direction, 'hurt')
        self.assertEqual(result.override_points, -10)
        self.assertEqual(result.fixed_slots_excluded, ['DST'])
        self.assertEqual(result.forecast_quality['roster_mae'], 1.5)
        self.assertEqual(result.forecast_quality['model_lineup_error'], -3)
        self.assertEqual(result.comparison_outcomes, [{'a': 'a', 'b': 'b', 'a_won': False,
                                                        'initial_probability': .6,
                                                        'final_probability': .3,
                                                        'model_probability': None}])
        self.assertTrue(result.prospective_eligible)

    def test_external_disclosure_keeps_points_but_excludes_unaided_inference(self):
        saved = record()
        saved['initial']['external_forecast_seen'] = True
        result = evaluate_week(saved, outcomes())
        self.assertEqual(result.realized_points['initial'], 17)
        self.assertFalse(result.prospective_eligible)
        self.assertIn('external forecast seen', result.exclusion_reasons)

    def test_late_revision_uses_prelock_final_for_prospective_comparison(self):
        saved = record()
        saved['final']['lineup']['WR'] = 'a'
        saved['final']['excluded_from_prospective'] = True
        result = evaluate_week(saved, outcomes())
        self.assertEqual(result.realized_points['final'], 13)
        self.assertEqual(result.latest_saved_final_points, 17)
        self.assertEqual(result.override_direction, 'hurt')
        self.assertTrue(any('latest revision was late' in note for note in result.notes))
        saved['prelock_final'] = None
        result = evaluate_week(saved, outcomes())
        self.assertIsNone(result.realized_points['final'])
        self.assertFalse(result.prospective_eligible)

    def test_missing_outcome_is_pending_and_never_imputed_as_zero(self):
        rows = outcomes()
        rows.pop('c')
        result = evaluate_week(record(), rows)
        self.assertEqual(result.status, 'pending')
        self.assertIn('c', result.missing_player_ids)
        self.assertIsNone(result.oracle_points)
        self.assertFalse(result.prospective_eligible)

    def test_score_correction_changes_result_without_mutating_record(self):
        saved = record()
        frozen = copy.deepcopy(saved)
        before = evaluate_week(saved, outcomes())
        corrected = outcomes()
        corrected['b'] = StatLine('b', '2026-10-06T12:00:00Z',
                                  {'receptions': 8, 'receiving_yards': 100})
        after = evaluate_week(saved, corrected)
        self.assertEqual(before.realized_points['model'], 23)
        self.assertEqual(after.realized_points['model'], 25)
        self.assertEqual(saved, frozen)

    def test_negative_observed_yards_are_valid_and_reduce_realized_points(self):
        saved = record()
        rows = outcomes()
        rows['a'] = StatLine('a', rows['a'].observed_at,
                             {'receptions': 1, 'receiving_yards': -5})
        self.assertEqual(evaluate_week(saved, rows).realized_points['initial'], 7.5)
        with tempfile.TemporaryDirectory() as temp:
            write_outcome_snapshot(public_manifest(), rows, Path(temp), result_source())

    def test_too_few_paired_weeks_suppress_interval_and_calibration(self):
        report = aggregate_results([evaluate_week(record(), outcomes())])
        self.assertEqual(report['paired_weeks'], 1)
        self.assertIsNone(report['paired_final_minus_model_ci95'])
        self.assertIsNone(report['calibration_bins'])
        self.assertIn('too few', report['inference_note'].lower())

    def test_enough_paired_weeks_show_interval_but_bins_need_each_bin_supported(self):
        first = evaluate_week(record(), outcomes())
        report = aggregate_results([replace(first, week=week) for week in range(1, 9)])
        self.assertEqual(report['paired_final_minus_model_ci95'], [-10, -10])
        self.assertIsNone(report['calibration_bins'])
        rows = []
        for index in range(21):
            pair = {**first.comparison_outcomes[0],
                    'final_probability': [.1, .5, .9][index % 3]}
            rows.append(replace(first, week=index + 1, comparison_outcomes=[pair]))
        self.assertEqual([bin['n'] for bin in aggregate_results(rows)['calibration_bins']],
                         [7, 7, 7])

    def test_unscheduled_roster_player_cannot_enter_hindsight_oracle(self):
        saved = record()
        saved['roster'].append({'player_id': 'bye', 'name': 'Bye',
                                'position': 'WR', 'team': 'DD'})
        self.assertEqual(evaluate_week(saved, outcomes()).oracle_points, 23)

    def test_fixed_only_record_has_zero_modeled_points_without_dividing_by_zero(self):
        saved = record()
        saved['roster'] = [saved['roster'][-1]]
        saved['slots'] = [saved['slots'][-1]]
        saved['game_locks'] = {}
        for field in ('initial', 'advice', 'final', 'prelock_final'):
            saved[field]['lineup'] = {'DST': 'dst'}
            saved[field]['comparisons'] = []
        saved['advice']['player_means'] = {}
        result = evaluate_week(saved, {})
        self.assertEqual(result.realized_points, {'initial': 0, 'model': 0,
                                                  'final': 0})
        self.assertIsNone(result.forecast_quality)

    def test_versioned_outcome_snapshot_retains_prior_correction_version(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)
            write_outcome_snapshot(public_manifest(), outcomes(), path,
                                   result_source())
            first = json.loads((path / 'current.json').read_text())
            corrected = outcomes()
            corrected['b'] = StatLine('b', '2026-10-06T12:00:00Z',
                                      {'receptions': 8, 'receiving_yards': 100})
            write_outcome_snapshot(public_manifest(), corrected, path,
                                   result_source('2026-10-06T12:00:00Z'))
            second = json.loads((path / 'current.json').read_text())
            self.assertNotEqual(first['manifest_sha256'], second['manifest_sha256'])
            self.assertTrue((path / first['manifest']).is_file())
            self.assertTrue((path / second['manifest']).is_file())
            self.assertNotIn('I expect Casey', (path / second['manifest']).read_text())
            week_path = json.loads((path / second['manifest']).read_text())['weeks'][outcome_key(public_manifest())]['path']
            week = json.loads((path / week_path).read_text())
            self.assertNotIn('Defense', (path / week_path).read_text())
            self.assertEqual(week['forecast_manifest_sha256'],
                             __import__('hashlib').sha256(
                                 (json.dumps(public_manifest(), sort_keys=True,
                                             separators=(',', ':')) + '\n').encode()).hexdigest())

    def test_bad_outcome_time_does_not_advance_current_pointer(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)
            source = result_source()
            write_outcome_snapshot(public_manifest(), outcomes(), path, source)
            before = (path / 'current.json').read_bytes()
            bad = outcomes()
            bad['a'] = StatLine('a', '2026-10-04T16:00:00Z', bad['a'].stats)
            with self.assertRaisesRegex(ValueError, 'observed time'):
                write_outcome_snapshot(public_manifest(), bad, path, source)
            self.assertEqual((path / 'current.json').read_bytes(), before)

    def test_corrupt_prior_outcome_cannot_be_carried_into_correction(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)
            write_outcome_snapshot(public_manifest(), outcomes(), path, result_source())
            before = (path / 'current.json').read_bytes()
            pointer = json.loads(before)
            manifest = json.loads((path / pointer['manifest']).read_text())
            week_file = path / manifest['weeks'][outcome_key(public_manifest())]['path']
            week_file.write_text('{}')
            with self.assertRaisesRegex(ValueError, 'outcome week checksum mismatch'):
                write_outcome_snapshot(public_manifest(), outcomes(), path,
                                       result_source('2026-10-06T12:00:00Z'))
            self.assertEqual((path / 'current.json').read_bytes(), before)

    def test_partial_public_outcome_keeps_affected_roster_pending(self):
        with tempfile.TemporaryDirectory() as temp:
            partial = outcomes()
            partial.pop('c')
            path = Path(temp)
            write_outcome_snapshot(public_manifest(), partial, path, result_source())
            pointer = json.loads((path / 'current.json').read_text())
            manifest = json.loads((path / pointer['manifest']).read_text())
            week = json.loads((path / manifest['weeks'][outcome_key(public_manifest())]['path']).read_text())
            self.assertEqual(week['missing_player_ids'], ['c'])
            self.assertEqual(evaluate_week(record(), partial).status, 'pending')
            unaffected = record()
            unaffected['roster'] = [p for p in unaffected['roster'] if p['player_id'] != 'c']
            unaffected['final']['lineup']['WR'] = 'a'
            unaffected['prelock_final']['lineup']['WR'] = 'a'
            self.assertEqual(evaluate_week(unaffected, partial).status, 'complete')

    def test_same_week_forecast_versions_keep_separate_outcome_descriptors(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)
            first = public_manifest()
            second = copy.deepcopy(first)
            second['model_version'] = 'new cut'
            write_outcome_snapshot(first, outcomes(), path, result_source())
            write_outcome_snapshot(second, outcomes(), path, result_source())
            pointer = json.loads((path / 'current.json').read_text())
            weeks = json.loads((path / pointer['manifest']).read_text())['weeks']
            self.assertEqual(set(weeks), {outcome_key(first), outcome_key(second)})

    def test_unfinalized_or_private_source_metadata_cannot_be_published(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)
            bad = result_source()
            bad['status'] = 'in progress'
            with self.assertRaisesRegex(ValueError, 'final'):
                write_outcome_snapshot(public_manifest(), outcomes(), path, bad)
            bad = result_source()
            bad['private_roster'] = ['a']
            with self.assertRaisesRegex(ValueError, 'source field'):
                write_outcome_snapshot(public_manifest(), outcomes(), path, bad)
            self.assertFalse((path / 'current.json').exists())


if __name__ == '__main__':
    unittest.main()
