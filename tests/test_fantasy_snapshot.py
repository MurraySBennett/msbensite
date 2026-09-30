from dataclasses import replace
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from fantasy.model import fit_predict
from fantasy.snapshot import write_snapshot
from fantasy.source import load_week


FIXTURES = Path(__file__).parent / 'fixtures' / 'fantasy'


class FantasySnapshotTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        cache = root / 'cache'
        cache.mkdir()
        assets = {
            'stats_player_week_2026.csv': 'stats_player/stats_player_week_2026.csv',
            'roster_weekly_2026.csv': 'weekly_rosters/roster_weekly_2026.csv',
            'injuries_2026.csv': 'injuries/injuries_2026.csv',
            'games.csv': 'schedules/games.csv',
        }
        captures = {}
        for name, asset in assets.items():
            shutil.copy2(FIXTURES / name, cache / name)
            captures[name] = {
                'url': f'https://github.com/nflverse/nflverse-data/releases/download/{asset}',
                'retrieved_at': '2026-10-02T16:00:00Z',
                'sha256': hashlib.sha256((cache / name).read_bytes()).hexdigest(),
                'licence': 'CC-BY-4.0',
            }
        (cache / 'captures.json').write_text(json.dumps(captures))
        self.forecast = fit_predict(load_week(2026, 5, '2026-10-02T18:00:00Z', cache),
                                    seed=4, draws=8)
        self.output = root / 'published'

    def test_snapshot_has_complete_hashed_team_shards_and_cutoffs(self):
        write_snapshot(self.forecast, self.output)
        pointer = json.loads((self.output / 'current.json').read_text())
        manifest = json.loads((self.output / pointer['manifest']).read_text())
        self.assertEqual(manifest['schema_version'], 1)
        self.assertEqual(manifest['cutoff_utc'], '2026-10-02T18:00:00Z')
        self.assertEqual(manifest['roster_week'], 5)
        self.assertEqual(manifest['draw_count'], 8)
        self.assertEqual(set(manifest['games']), set(self.forecast.players))
        actual_ids = set()
        for shard in manifest['shards']:
            payload = (self.output / shard['path']).read_bytes()
            self.assertEqual(hashlib.sha256(payload).hexdigest(), shard['sha256'])
            actual_ids.update(json.loads(payload)['players'])
        self.assertEqual(actual_ids, set(self.forecast.players))

    def test_malformed_forecast_does_not_replace_last_good_pointer(self):
        write_snapshot(self.forecast, self.output)
        original = (self.output / 'current.json').read_bytes()
        with self.assertRaisesRegex(ValueError, 'draw count'):
            write_snapshot(replace(self.forecast, draw_count=9), self.output)
        self.assertEqual((self.output / 'current.json').read_bytes(), original)

    def test_bad_component_and_partial_version_do_not_replace_pointer(self):
        from fantasy.model import PlayerDraw
        write_snapshot(self.forecast, self.output)
        original = (self.output / 'current.json').read_bytes()
        player = self.forecast.players['00-0000001']
        draws = list(player.draws)
        stats = dict(draws[0].stats)
        stats['receptions'] = stats['targets'] + 1
        draws[0] = PlayerDraw(True, stats)
        players = dict(self.forecast.players)
        players[player.player_id] = replace(player, draws=draws)
        with self.assertRaisesRegex(ValueError, 'receptions'):
            write_snapshot(replace(self.forecast, players=players), self.output)
        self.assertEqual((self.output / 'current.json').read_bytes(), original)
        pointer = json.loads(original)
        manifest_path = self.output / pointer['manifest']
        manifest = json.loads(manifest_path.read_text())
        (self.output / manifest['shards'][0]['path']).unlink()
        with self.assertRaisesRegex(ValueError, 'existing snapshot'):
            write_snapshot(self.forecast, self.output)
        self.assertEqual((self.output / 'current.json').read_bytes(), original)

    def test_source_and_injury_cutoff_are_checked_before_publish(self):
        write_snapshot(self.forecast, self.output)
        original = (self.output / 'current.json').read_bytes()
        captures = {key: dict(value) for key, value in self.forecast.captures.items()}
        first = next(iter(captures))
        captures[first]['retrieved_at'] = '2026-10-03T00:00:00Z'
        with self.assertRaisesRegex(ValueError, 'source after cutoff'):
            write_snapshot(replace(self.forecast, captures=captures), self.output)
        self.assertEqual((self.output / 'current.json').read_bytes(), original)

    def test_operator_update_publishes_all_fixture_players(self):
        result = subprocess.run([
            sys.executable, '-m', 'fantasy.update', '--season', '2026', '--week', '5',
            '--cutoff', '2026-10-02T18:00:00Z', '--output', str(self.output),
            '--cache', str(Path(self.temp.name) / 'cache'), '--seed', '4', '--draws', '8',
        ], capture_output=True, text=True, check=False)
        self.assertEqual(result.returncode, 0, result.stderr)
        pointer = json.loads((self.output / 'current.json').read_text())
        manifest = json.loads((self.output / pointer['manifest']).read_text())
        self.assertEqual(manifest['draw_count'], 8)
        self.assertEqual(sum(shard['player_count'] for shard in manifest['shards']),
                         len(self.forecast.players))

    def test_existing_manifest_tampering_cannot_be_republished(self):
        write_snapshot(self.forecast, self.output)
        pointer = (self.output / 'current.json').read_bytes()
        manifest_path = self.output / json.loads(pointer)['manifest']
        manifest = json.loads(manifest_path.read_text())
        manifest['model_version'] = 'tampered'
        manifest_path.write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, 'existing snapshot'):
            write_snapshot(self.forecast, self.output)
        self.assertEqual((self.output / 'current.json').read_bytes(), pointer)


if __name__ == '__main__':
    unittest.main()
