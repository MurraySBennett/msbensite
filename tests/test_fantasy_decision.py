import unittest

from fantasy.decision import (
    Lineup, NoLegalLineup, Player, ScoringRules, Slot, StatLine,
    UnsupportedRule, best_lineup, legal_lineups, rolling_baseline, score,
)


RULES = ScoringRules({
    'passing_yards': 0.04,
    'passing_tds': 4,
    'passing_interceptions': -2,
    'rushing_yards': 0.1,
    'rushing_tds': 6,
    'receiving_yards': 0.1,
    'receptions': 1,
    'receiving_tds': 6,
    'fumbles_lost_total': -2,
    'fg_made': 3,
    'fg_made_50_59': 2,
    'pat_made': 1,
})


class FantasyDecisionTests(unittest.TestCase):
    def test_ppr_scoring_includes_kicking_and_fumble_components(self):
        receiver = StatLine('wr', '2026-09-20T17:00:00Z', {
            'receptions': 6, 'receiving_yards': 72, 'receiving_tds': 1,
            'fumbles_lost_total': 1,
        })
        kicker = StatLine('k', '2026-09-20T17:00:00Z', {
            'fg_made': 2, 'fg_made_50_59': 1, 'pat_made': 3,
        })
        self.assertAlmostEqual(score(receiver, RULES), 17.2)
        self.assertAlmostEqual(score(kicker, RULES), 11)

    def test_unsupported_scoring_component_fails_visibly(self):
        with self.assertRaisesRegex(UnsupportedRule, 'tackles'):
            score(StatLine('qb', '2026-09-20T17:00:00Z', {}),
                  ScoringRules({'tackles': 1}))

    def test_superflex_can_use_qb_and_flex_only_eligible_positions(self):
        players = [Player('qb', 'QB'), Player('rb', 'RB'), Player('wr', 'WR')]
        slots = [Slot('QB', ('QB',)), Slot('FLEX', ('RB', 'WR', 'TE')),
                 Slot('SUPERFLEX', ('QB', 'RB', 'WR', 'TE'))]
        lineups = legal_lineups(players, slots, {})
        self.assertEqual(len(lineups), 2)
        for lineup in lineups:
            self.assertEqual(lineup.assignments['QB'], 'qb')
            self.assertNotEqual(lineup.assignments['FLEX'], 'qb')
            self.assertEqual(len(set(lineup.assignments.values())), 3)

    def test_best_lineup_uses_expected_points_with_stable_tie(self):
        players = [Player('qb-b', 'QB'), Player('qb-a', 'QB'), Player('rb', 'RB')]
        slots = [Slot('QB', ('QB',)), Slot('SUPERFLEX', ('QB', 'RB'))]
        lineup = best_lineup(players, slots, {'qb-a': 20, 'qb-b': 20, 'rb': 14}, {})
        self.assertEqual(lineup.assignments, {'QB': 'qb-a', 'SUPERFLEX': 'qb-b'})

    def test_optimizer_handles_a_full_superflex_roster(self):
        players = ([Player(f'QB{i}', 'QB') for i in range(3)]
                   + [Player(f'RB{i}', 'RB') for i in range(6)]
                   + [Player(f'WR{i}', 'WR') for i in range(6)]
                   + [Player(f'TE{i}', 'TE') for i in range(3)]
                   + [Player(f'K{i}', 'K') for i in range(2)])
        slots = [Slot('QB', ('QB',)), Slot('RB1', ('RB',)), Slot('RB2', ('RB',)),
                 Slot('WR1', ('WR',)), Slot('WR2', ('WR',)), Slot('TE', ('TE',)),
                 Slot('FLEX', ('RB', 'WR', 'TE')),
                 Slot('SUPERFLEX', ('QB', 'RB', 'WR', 'TE')), Slot('K', ('K',))]
        lineup = best_lineup(players, slots,
                             {player.player_id: 1 for player in players}, {})
        self.assertEqual(len(set(lineup.assignments.values())), 9)
        self.assertEqual(lineup.assignments['QB'], 'QB0')
        self.assertEqual(lineup.assignments['K'], 'K0')

    def test_bye_and_started_players_cannot_enter_new_lineup(self):
        players = [Player('bye', 'RB', on_bye=True), Player('started', 'RB', locked=True),
                   Player('ready', 'RB')]
        slots = [Slot('RB', ('RB',))]
        self.assertEqual([x.assignments for x in legal_lineups(players, slots, {})],
                         [{'RB': 'ready'}])
        self.assertEqual([x.assignments for x in legal_lineups(players, slots,
                                                                {'RB': 'started'})],
                         [{'RB': 'started'}])

    def test_user_fixed_unsupported_slot_is_excluded_from_optimization(self):
        players = [Player('defense', 'DST'), Player('rb', 'RB')]
        slots = [Slot('DST', ('DST',), modeled=False), Slot('RB', ('RB',))]
        lineup = best_lineup(players, slots, {'rb': 10}, {'DST': 'defense'})
        self.assertEqual(lineup.assignments, {'DST': 'defense', 'RB': 'rb'})
        with self.assertRaisesRegex(NoLegalLineup, 'DST'):
            legal_lineups(players, slots, {})

    def test_no_legal_lineup_explains_the_unfilled_slot(self):
        with self.assertRaisesRegex(NoLegalLineup, 'K'):
            legal_lineups([Player('qb', 'QB')], [Slot('K', ('K',))], {})

    def test_rolling_baseline_uses_only_prior_three_games(self):
        history = [
            StatLine('wr', '2026-09-01T17:00:00Z', {'receiving_yards': 10}),
            StatLine('wr', '2026-09-08T17:00:00Z', {'receiving_yards': 20}),
            StatLine('wr', '2026-09-15T17:00:00Z', {'receiving_yards': 30}),
            StatLine('wr', '2026-09-22T17:00:00Z', {'receiving_yards': 40}),
            StatLine('wr', '2026-09-29T17:00:00Z', {'receiving_yards': 999}),
        ]
        self.assertEqual(rolling_baseline(history, '2026-09-29T00:00:00Z', RULES),
                         {'wr': 3.0})


if __name__ == '__main__':
    unittest.main()
