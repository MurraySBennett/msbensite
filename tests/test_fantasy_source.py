import hashlib
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from fantasy.source import load_week


FIXTURES = Path(__file__).parent / 'fixtures' / 'fantasy'
CUTOFF = '2026-10-02T18:00:00Z'
SOURCE_ASSETS = {
    'stats_player_week_2026.csv': 'stats_player/stats_player_week_2026.csv',
    'roster_weekly_2026.csv': 'weekly_rosters/roster_weekly_2026.csv',
    'injuries_2026.csv': 'injuries/injuries_2026.csv',
    'games.csv': 'schedules/games.csv',
}


class FantasySourceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.cache = Path(self.temp.name)
        captures = {}
        for path in FIXTURES.glob('*.csv'):
            dest = self.cache / path.name
            shutil.copy2(path, dest)
            captures[path.name] = {
                'url': f'https://github.com/nflverse/nflverse-data/releases/download/{SOURCE_ASSETS[path.name]}',
                'retrieved_at': '2026-10-02T16:00:00Z',
                'sha256': hashlib.sha256(dest.read_bytes()).hexdigest(),
                'licence': 'CC-BY-4.0',
            }
        (self.cache / 'captures.json').write_text(json.dumps(captures))

    def test_joins_by_id_not_ambiguous_name_and_excludes_current_week_outcome(self):
        week = load_week(2026, 5, CUTOFF, self.cache)
        self.assertEqual({p.player_id for p in week.players}, {'00-0000001', '00-0000002', '00-0000003', '00-0000005'})
        self.assertEqual(len([p for p in week.players if p.name == 'Alex Smith']), 2)
        self.assertEqual(week.history['00-0000001'][0]['receiving_yards'], 72.0)
        self.assertEqual(len(week.history['00-0000001']), 1)
        self.assertEqual(week.injuries['00-0000001'].status, 'Questionable')
        self.assertNotIn('00-0000002', week.injuries)
        self.assertEqual(week.history['00-0000005'], [])

    def test_future_injury_update_is_not_backfilled(self):
        week = load_week(2026, 5, CUTOFF, self.cache)
        self.assertEqual(week.injuries['00-0000001'].modified_at, '2026-10-02T15:00:00Z')

    def test_capture_after_cutoff_is_rejected(self):
        captures = json.loads((self.cache / 'captures.json').read_text())
        captures['injuries_2026.csv']['retrieved_at'] = '2026-10-03T16:00:00Z'
        (self.cache / 'captures.json').write_text(json.dumps(captures))
        with self.assertRaisesRegex(ValueError, 'after cutoff'):
            load_week(2026, 5, CUTOFF, self.cache)

    def test_unlicensed_or_modified_input_fails_closed(self):
        captures = json.loads((self.cache / 'captures.json').read_text())
        captures['games.csv']['licence'] = 'unknown'
        (self.cache / 'captures.json').write_text(json.dumps(captures))
        with self.assertRaisesRegex(ValueError, 'licence'):
            load_week(2026, 5, CUTOFF, self.cache)
        captures['games.csv']['licence'] = 'CC-BY-4.0'
        (self.cache / 'captures.json').write_text(json.dumps(captures))
        (self.cache / 'games.csv').write_text('tampered')
        with self.assertRaisesRegex(ValueError, 'checksum'):
            load_week(2026, 5, CUTOFF, self.cache)

    def test_bye_player_stays_selectable_as_player_but_has_no_game(self):
        with (self.cache / 'stats_player_week_2026.csv').open('a') as stream:
            stream.write('00-0000004,Bye Runner,RB,2026,4,REG,BYE,NE,0,0,0,0,10,55,0,0,0,0,0,0\n')
        with (self.cache / 'roster_weekly_2026.csv').open('a') as stream:
            stream.write('2026,BYE,RB,ACT,Bye Runner,00-0000004,5,REG\n')
        captures = json.loads((self.cache / 'captures.json').read_text())
        for name in ('stats_player_week_2026.csv', 'roster_weekly_2026.csv'):
            path = self.cache / name
            captures[name]['sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
        (self.cache / 'captures.json').write_text(json.dumps(captures))
        week = load_week(2026, 5, CUTOFF, self.cache)
        self.assertIn('00-0000004', {p.player_id for p in week.players})
        self.assertNotIn('00-0000004', week.games_by_player)

    def test_historical_player_absent_from_current_roster_is_not_selectable(self):
        with (self.cache / 'stats_player_week_2026.csv').open('a') as stream:
            stream.write('00-0000999,Released Runner,RB,2026,4,REG,NE,NYJ,0,0,0,0,10,55,0,0,0,0,0,0\n')
        captures = json.loads((self.cache / 'captures.json').read_text())
        path = self.cache / 'stats_player_week_2026.csv'
        captures[path.name]['sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
        (self.cache / 'captures.json').write_text(json.dumps(captures))
        week = load_week(2026, 5, CUTOFF, self.cache)
        self.assertNotIn('00-0000999', {p.player_id for p in week.players})

    def test_upcoming_week_uses_latest_captured_roster_and_reports_its_week(self):
        path = self.cache / 'roster_weekly_2026.csv'
        path.write_text(path.read_text().replace(',5,REG\n', ',4,REG\n'))
        captures = json.loads((self.cache / 'captures.json').read_text())
        captures[path.name]['sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
        (self.cache / 'captures.json').write_text(json.dumps(captures))
        week = load_week(2026, 5, CUTOFF, self.cache)
        self.assertEqual(week.roster_week, 4)
        self.assertEqual(len(week.players), 4)

    def test_capture_with_wrong_release_asset_is_rejected(self):
        captures = json.loads((self.cache / 'captures.json').read_text())
        captures['games.csv']['url'] = 'https://github.com/nflverse/nflverse-data/releases/download/schedules/other.csv'
        (self.cache / 'captures.json').write_text(json.dumps(captures))
        with self.assertRaisesRegex(ValueError, 'URL'):
            load_week(2026, 5, CUTOFF, self.cache)


if __name__ == '__main__':
    unittest.main()
