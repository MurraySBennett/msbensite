import hashlib
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from fantasy.model import fit_predict
from fantasy.source import load_week


FIXTURES = Path(__file__).parent / 'fixtures' / 'fantasy'


class FantasyModelTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        cache = Path(self.temp.name)
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
        self.week = load_week(2026, 5, '2026-10-02T18:00:00Z', cache)

    def test_fixed_seed_preserves_shared_team_draws_and_opportunity(self):
        forecast = fit_predict(self.week, seed=17, draws=80)
        repeat = fit_predict(self.week, seed=17, draws=80)
        self.assertEqual(forecast.players, repeat.players)
        self.assertEqual(forecast.team_opportunity, repeat.team_opportunity)
        for draw_index, totals in enumerate(forecast.team_opportunity['NE']):
            self.assertEqual(sum(player.draws[draw_index].stats['targets']
                                 for player in forecast.players.values()
                                 if player.team == 'NE'), totals['targets'])
            self.assertEqual(sum(player.draws[draw_index].stats['carries']
                                 for player in forecast.players.values()
                                 if player.team == 'NE'), totals['carries'])
        self.assertGreater(len({draw['targets'] for draw in forecast.team_opportunity['NE']}), 1)

    def test_questionable_player_can_miss_and_kicker_components_are_bounded(self):
        forecast = fit_predict(self.week, seed=11, draws=100)
        questionable = forecast.players['00-0000001'].draws
        self.assertTrue(any(not draw.available for draw in questionable))
        self.assertTrue(any(draw.available for draw in questionable))
        self.assertTrue(all(all(value == 0 for value in draw.stats.values())
                            for draw in questionable if not draw.available))
        kicker = forecast.players['00-0000003'].draws
        self.assertTrue(all(0 <= draw.stats['fg_made'] <= draw.stats['fg_att']
                            and 0 <= draw.stats['pat_made'] <= draw.stats['pat_att']
                            for draw in kicker))

    def test_sparse_player_has_nonzero_uncertainty_without_prior_games(self):
        forecast = fit_predict(self.week, seed=7, draws=100)
        rookie = forecast.players['00-0000005'].draws
        self.assertGreater(len({draw.stats['rushing_yards'] for draw in rookie}), 1)
        self.assertEqual(forecast.cutoff_utc, self.week.cutoff_utc)
        with self.assertRaisesRegex(ValueError, 'draws'):
            fit_predict(self.week, seed=7, draws=0)

    def test_unknown_status_is_explicit_and_out_player_is_zero(self):
        from dataclasses import replace
        from fantasy.source import InjuryInput
        forecast = fit_predict(self.week, seed=3, draws=40)
        self.assertEqual(forecast.players['00-0000005'].injury_status, 'Unknown')
        self.assertIsNone(forecast.players['00-0000005'].injury_issued_at)
        self.assertEqual(forecast.players['00-0000001'].injury_issued_at,
                         '2026-10-02T15:00:00Z')
        injuries = dict(self.week.injuries)
        injuries['00-0000001'] = InjuryInput('00-0000001', 'Out', '', '',
                                           '2026-10-02T15:00:00Z')
        out = fit_predict(replace(self.week, injuries=injuries), seed=3, draws=40)
        self.assertTrue(all(not draw.available and not any(draw.stats.values())
                            for draw in out.players['00-0000001'].draws))

    def test_all_team_opportunities_and_counts_are_conserved(self):
        forecast = fit_predict(self.week, seed=5, draws=30)
        for team, series in forecast.team_opportunity.items():
            team_players = [p for p in forecast.players.values() if p.team == team]
            for index, totals in enumerate(series):
                for component in ('targets', 'carries', 'fg_att', 'pat_att'):
                    self.assertEqual(sum(p.draws[index].stats[component] for p in team_players),
                                     totals[component])
                self.assertEqual(sum(p.draws[index].stats['attempts'] for p in team_players)
                                 + totals['other_attempts'], totals['attempts'])
                self.assertLessEqual(totals['targets'], totals['attempts'])
                for player in team_players:
                    stats = player.draws[index].stats
                    for made, attempts in (('receptions', 'targets'), ('completions', 'attempts'),
                                           ('fg_made', 'fg_att'), ('pat_made', 'pat_att')):
                        self.assertLessEqual(stats[made], stats[attempts])
                    self.assertEqual(stats['fg_made'], sum(stats[name] for name in
                        ('fg_made_0_19', 'fg_made_20_29', 'fg_made_30_39',
                         'fg_made_40_49', 'fg_made_50_59', 'fg_made_60_')))

    def test_future_injury_and_started_game_are_rejected(self):
        from dataclasses import replace
        from fantasy.source import InjuryInput
        injuries = dict(self.week.injuries)
        injuries['00-0000001'] = InjuryInput('00-0000001', 'Out', '', '',
                                           '2026-10-03T15:00:00Z')
        with self.assertRaisesRegex(ValueError, 'injury.*cutoff'):
            fit_predict(replace(self.week, injuries=injuries), seed=1, draws=2)
        with self.assertRaisesRegex(ValueError, 'game.*cutoff'):
            fit_predict(replace(self.week, cutoff_utc='2026-10-04T18:00:00Z'),
                        seed=1, draws=2)

    def test_supported_rare_scoring_components_are_simulated(self):
        forecast = fit_predict(self.week, seed=31, draws=500)
        receiver = forecast.players['00-0000001'].draws
        self.assertTrue(any(draw.stats['receiving_2pt_conversions'] > 0 for draw in receiver))
        self.assertTrue(any(draw.stats['fumbles_lost_total'] > 0 for draw in receiver))

    def test_quarterback_attempts_have_separate_team_volume(self):
        from dataclasses import replace
        from fantasy.source import PlayerInput
        qb = PlayerInput('00-0000010', 'Test QB', 'NE', 'QB')
        games = dict(self.week.games_by_player)
        games[qb.player_id] = games['00-0000001']
        history = dict(self.week.history)
        history[qb.player_id] = []
        week = replace(self.week, players=self.week.players + [qb],
                       games_by_player=games, history=history)
        forecast = fit_predict(week, seed=4, draws=30)
        self.assertTrue(any(total['attempts'] != total['targets']
                            for total in forecast.team_opportunity['NE']))
        self.assertTrue(any(draw.stats['attempts'] > 0
                            for draw in forecast.players[qb.player_id].draws))


if __name__ == '__main__':
    unittest.main()
