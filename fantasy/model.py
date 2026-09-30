"""Prespecified, partially pooled weekly stat simulator for the pilot."""

from dataclasses import dataclass
from datetime import datetime, timezone
import random

from fantasy.source import NUMERIC_FIELDS, WeekInput


MODEL_VERSION = 'pilot-0.1'
TARGET_PRIOR = {'QB': 0.0, 'RB': 2.0, 'WR': 6.0, 'TE': 4.0, 'K': 0.0}
CARRY_PRIOR = {'QB': 2.0, 'RB': 10.0, 'WR': 0.4, 'TE': 0.1, 'K': 0.0}
AVAILABILITY_PRIOR = {
    'out': 0.0, 'doubtful': 0.25, 'questionable': 0.75,
    'probable': 0.9, 'unknown': 0.9,
}


@dataclass(frozen=True)
class PlayerDraw:
    available: bool
    stats: dict[str, float]


@dataclass(frozen=True)
class PlayerForecast:
    player_id: str
    name: str
    team: str
    position: str
    injury_status: str
    injury_issued_at: str | None
    draws: list[PlayerDraw]


@dataclass(frozen=True)
class Forecast:
    season: int
    week: int
    cutoff_utc: str
    roster_week: int
    generated_at: str
    model_version: str
    seed: int
    draw_count: int
    players: dict[str, PlayerForecast]
    team_opportunity: dict[str, list[dict[str, int]]]
    captures: dict[str, dict[str, str]]
    games: dict[str, dict[str, str]]


def _recent_average(rows: list[dict[str, float]], field: str, prior: float) -> float:
    recent = sorted(rows, key=lambda row: row['week'])[-3:]
    if not recent:
        return prior
    return (sum(row.get(field, 0.0) for row in recent) + 2 * prior) / (len(recent) + 2)


def _team_count(rng: random.Random, means: list[float], prior: float) -> int:
    estimate = max(prior * 0.5, sum(means)) if means else prior
    return max(0, round(rng.gauss(estimate, max(2.0, estimate * 0.2))))


def _allocate(rng: random.Random, total: int, ids: list[str],
              weights: dict[str, float]) -> dict[str, int]:
    assigned = {player_id: 0 for player_id in ids}
    if not ids:
        return assigned
    strengths = [rng.gammavariate(max(weights[player_id], 0.1), 1) for player_id in ids]
    for selected in rng.choices(ids, weights=strengths, k=total):
        assigned[selected] += 1
    return assigned


def _binomial(rng: random.Random, trials: int, probability: float) -> int:
    return sum(rng.random() < probability for _ in range(trials))


def _efficiency(rng: random.Random, rows: list[dict[str, float]],
                numerator: str, denominator: str, prior: float) -> float:
    num = sum(row.get(numerator, 0.0) for row in rows)
    den = sum(row.get(denominator, 0.0) for row in rows)
    estimate = (num + 10 * prior) / (den + 10)
    return max(0.0, rng.gauss(estimate, max(0.1, estimate * 0.2)))


def fit_predict(week: WeekInput, seed: int, draws: int) -> Forecast:
    if draws < 1:
        raise ValueError('draws must be positive')
    cutoff = datetime.fromisoformat(week.cutoff_utc.replace('Z', '+00:00'))
    if cutoff.tzinfo is None:
        raise ValueError('cutoff needs a timezone')
    for injury in week.injuries.values():
        issued = datetime.fromisoformat(injury.modified_at.replace('Z', '+00:00'))
        if issued.tzinfo is None or issued > cutoff:
            raise ValueError('injury after cutoff or without timezone')
    rng = random.Random(seed)
    players = [player for player in week.players if player.player_id in week.games_by_player]
    for player in players:
        kickoff = datetime.fromisoformat(
            week.games_by_player[player.player_id].kickoff_utc.replace('Z', '+00:00'))
        if kickoff.tzinfo is None or kickoff <= cutoff:
            raise ValueError('game already at cutoff or without timezone')
    by_team: dict[str, list] = {}
    for player in players:
        by_team.setdefault(player.team, []).append(player)
    outputs = {player.player_id: [] for player in players}
    team_draws = {team: [] for team in by_team}

    for _ in range(draws):
        for team, team_players in sorted(by_team.items()):
            available: dict[str, bool] = {}
            for player in team_players:
                injury = week.injuries.get(player.player_id)
                status = (injury.status if injury else 'unknown').lower()
                probability = AVAILABILITY_PRIOR.get(status, AVAILABILITY_PRIOR['unknown'])
                available[player.player_id] = rng.random() < probability
            active = [player for player in team_players if available[player.player_id]]
            receivers = [player for player in active if TARGET_PRIOR[player.position] > 0]
            runners = [player for player in active if CARRY_PRIOR[player.position] > 0]
            quarterbacks = [player for player in active if player.position == 'QB']
            kickers = [player for player in active if player.position == 'K']
            attempt_total = (_team_count(rng, [
                _recent_average(week.history[player.player_id], 'attempts', 30)
                for player in quarterbacks], 30) if receivers or quarterbacks else 0)
            target_total = (min(attempt_total, _team_count(rng, [
                _recent_average(week.history[player.player_id], 'targets', TARGET_PRIOR[player.position])
                for player in receivers], 28)) if receivers else 0)
            carry_total = (_team_count(rng, [
                _recent_average(week.history[player.player_id], 'carries', CARRY_PRIOR[player.position])
                for player in runners], 25) if runners else 0)
            targets = _allocate(rng, target_total, [player.player_id for player in receivers], {
                player.player_id: _recent_average(week.history[player.player_id], 'targets',
                                                   TARGET_PRIOR[player.position])
                for player in receivers})
            carries = _allocate(rng, carry_total, [player.player_id for player in runners], {
                player.player_id: _recent_average(week.history[player.player_id], 'carries',
                                                   CARRY_PRIOR[player.position])
                for player in runners})
            attempts = _allocate(rng, attempt_total, [player.player_id for player in quarterbacks], {
                player.player_id: _recent_average(week.history[player.player_id], 'attempts', 30)
                for player in quarterbacks})
            fg_attempts = _allocate(rng, _team_count(rng, [], 2.5) if kickers else 0,
                                    [player.player_id for player in kickers],
                                    {player.player_id: 1 for player in kickers})
            pat_attempts = _allocate(rng, _team_count(rng, [], 3) if kickers else 0,
                                     [player.player_id for player in kickers],
                                     {player.player_id: 1 for player in kickers})
            team_draws[team].append({'targets': target_total, 'carries': carry_total,
                                     'attempts': attempt_total,
                                     'other_attempts': attempt_total - sum(attempts.values()),
                                     'fg_att': sum(fg_attempts.values()),
                                     'pat_att': sum(pat_attempts.values())})

            for player in team_players:
                player_id = player.player_id
                stats = {field: 0.0 for field in NUMERIC_FIELDS}
                if available[player_id]:
                    rows = week.history[player_id]
                    stats['targets'] = targets.get(player_id, 0)
                    stats['carries'] = carries.get(player_id, 0)
                    stats['receptions'] = _binomial(rng, int(stats['targets']), min(0.95,
                        _efficiency(rng, rows, 'receptions', 'targets', 0.65)))
                    stats['receiving_yards'] = round(stats['receptions'] *
                        _efficiency(rng, rows, 'receiving_yards', 'receptions', 10), 1)
                    stats['receiving_tds'] = _binomial(rng, int(stats['receptions']), min(0.3,
                        _efficiency(rng, rows, 'receiving_tds', 'receptions', 0.06)))
                    stats['rushing_yards'] = round(stats['carries'] *
                        _efficiency(rng, rows, 'rushing_yards', 'carries', 4.2), 1)
                    stats['rushing_tds'] = _binomial(rng, int(stats['carries']), min(0.2,
                        _efficiency(rng, rows, 'rushing_tds', 'carries', 0.035)))
                    stats['attempts'] = attempts.get(player_id, 0)
                    stats['completions'] = _binomial(rng, int(stats['attempts']), min(0.9,
                        _efficiency(rng, rows, 'completions', 'attempts', 0.65)))
                    stats['passing_yards'] = round(stats['completions'] *
                        _efficiency(rng, rows, 'passing_yards', 'completions', 11), 1)
                    stats['passing_tds'] = _binomial(rng, int(stats['attempts']), min(0.2,
                        _efficiency(rng, rows, 'passing_tds', 'attempts', 0.05)))
                    stats['passing_interceptions'] = _binomial(rng, int(stats['attempts']), 0.025)
                    stats['passing_2pt_conversions'] = _binomial(rng, int(stats['attempts']), 0.002)
                    stats['rushing_2pt_conversions'] = _binomial(rng, int(stats['carries']), 0.004)
                    stats['receiving_2pt_conversions'] = _binomial(rng, int(stats['receptions']), 0.008)
                    stats['fumbles_lost_total'] = _binomial(rng,
                        int(stats['carries'] + stats['receptions'] + stats['attempts']), 0.004)
                    stats['fg_att'] = fg_attempts.get(player_id, 0)
                    stats['fg_made'] = _binomial(rng, int(stats['fg_att']), 0.85)
                    stats['pat_att'] = pat_attempts.get(player_id, 0)
                    stats['pat_made'] = _binomial(rng, int(stats['pat_att']), 0.95)
                    for _kick in range(int(stats['fg_made'])):
                        distance = rng.choices(('fg_made_0_19', 'fg_made_20_29',
                                                'fg_made_30_39', 'fg_made_40_49',
                                                'fg_made_50_59', 'fg_made_60_'),
                                               weights=(1, 3, 4, 3, 2, 0.2))[0]
                        stats[distance] += 1
                    stats['fg_missed'] = stats['fg_att'] - stats['fg_made']
                    stats['pat_missed'] = stats['pat_att'] - stats['pat_made']
                outputs[player_id].append(PlayerDraw(available[player_id], stats))

    predictions = {player.player_id: PlayerForecast(
        player.player_id, player.name, player.team, player.position,
        week.injuries[player.player_id].status if player.player_id in week.injuries else 'Unknown',
        week.injuries[player.player_id].modified_at if player.player_id in week.injuries else None,
        outputs[player.player_id]) for player in players}
    games = {player_id: {'game_id': game.game_id, 'kickoff_utc': game.kickoff_utc,
                         'home_team': game.home_team, 'away_team': game.away_team}
             for player_id, game in week.games_by_player.items() if player_id in predictions}
    return Forecast(week.season, week.week, week.cutoff_utc, week.roster_week,
                    datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
                    MODEL_VERSION, seed, draws, predictions, team_draws, week.captures, games)
