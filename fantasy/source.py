"""Load a frozen, licensed nflverse week without post-cutoff input rows."""

from dataclasses import dataclass
from datetime import datetime, timezone
import csv
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen
from zoneinfo import ZoneInfo


RELEASE = 'https://github.com/nflverse/nflverse-data/releases/download'
LICENCE = 'CC-BY-4.0'
POSITIONS = frozenset(('QB', 'RB', 'WR', 'TE', 'K'))
NUMERIC_FIELDS = frozenset((
    'completions', 'attempts', 'passing_yards', 'passing_tds',
    'passing_interceptions', 'passing_2pt_conversions', 'carries',
    'rushing_yards', 'rushing_tds', 'rushing_2pt_conversions',
    'targets', 'receptions', 'receiving_yards', 'receiving_tds',
    'receiving_2pt_conversions', 'fumbles_lost_total', 'fg_made',
    'fg_att', 'fg_missed', 'fg_made_0_19', 'fg_made_20_29',
    'fg_made_30_39', 'fg_made_40_49', 'fg_made_50_59',
    'fg_made_60_', 'pat_made', 'pat_att', 'pat_missed',
))


@dataclass(frozen=True)
class PlayerInput:
    player_id: str
    name: str
    team: str
    position: str


@dataclass(frozen=True)
class GameInput:
    game_id: str
    home_team: str
    away_team: str
    kickoff_utc: str


@dataclass(frozen=True)
class InjuryInput:
    player_id: str
    status: str
    primary_injury: str
    practice_status: str
    modified_at: str


@dataclass(frozen=True)
class WeekInput:
    season: int
    week: int
    roster_week: int
    cutoff_utc: str
    players: list[PlayerInput]
    games_by_player: dict[str, GameInput]
    history: dict[str, list[dict[str, float]]]
    injuries: dict[str, InjuryInput]
    captures: dict[str, dict[str, str]]


def _instant(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError(f'timestamp lacks timezone: {value}')
    return parsed.astimezone(timezone.utc)


def _source_urls(season: int) -> dict[str, str]:
    names = {
        f'stats_player_week_{season}.csv': f'stats_player/stats_player_week_{season}.csv',
        f'roster_weekly_{season}.csv': f'weekly_rosters/roster_weekly_{season}.csv',
        f'injuries_{season}.csv': f'injuries/injuries_{season}.csv',
        'games.csv': 'schedules/games.csv',
    }
    return {name: f'{RELEASE}/{suffix}' for name, suffix in names.items()}


def capture_sources(season: int, cache_dir: Path) -> dict[str, dict[str, str]]:
    """Capture current releases; their retrieval time, not release name, is the cutoff evidence."""
    cache_dir = Path(cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)
    manifest = cache_dir / 'captures.json'
    captures = json.loads(manifest.read_text()) if manifest.exists() else {}
    for name, url in _source_urls(season).items():
        if name in captures:
            continue
        target = cache_dir / name
        if target.exists():
            raise ValueError(f'uncatalogued source file: {name}')
        with urlopen(url, timeout=60) as response:
            payload = response.read()
        temporary = target.with_suffix('.download')
        temporary.write_bytes(payload)
        temporary.replace(target)
        captures[name] = {
            'url': url,
            'retrieved_at': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
            'sha256': hashlib.sha256(payload).hexdigest(),
            'licence': LICENCE,
        }
        manifest.write_text(json.dumps(captures, indent=2, sort_keys=True) + '\n')
    return captures


def _checked_csv(name: str, captures: dict, cache_dir: Path, cutoff: datetime,
                 expected_url: str) -> list[dict[str, str]]:
    record = captures.get(name)
    if record is None:
        raise ValueError(f'missing capture record: {name}')
    if record.get('licence') != LICENCE or record.get('url') != expected_url:
        raise ValueError(f'unapproved source licence or URL: {name}')
    if _instant(record['retrieved_at']) > cutoff:
        raise ValueError(f'source captured after cutoff: {name}')
    path = cache_dir / name
    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != record.get('sha256'):
        raise ValueError(f'source checksum mismatch: {name}')
    with path.open(newline='', encoding='utf-8-sig') as stream:
        return list(csv.DictReader(stream))


def _kickoff(row: dict[str, str]) -> str:
    local = datetime.fromisoformat(f"{row['gameday']}T{row['gametime']}")
    return local.replace(tzinfo=ZoneInfo('America/New_York')).astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')


def load_week(season: int, week: int, cutoff_utc: str, cache_dir: Path) -> WeekInput:
    """Normalize scheduled players, prior stats and only known injury records."""
    if season < 1999 or not 1 <= week <= 18:
        raise ValueError('invalid NFL season or week')
    cutoff = _instant(cutoff_utc)
    cache_dir = Path(cache_dir)
    captures = capture_sources(season, cache_dir)
    urls = _source_urls(season)
    stats = _checked_csv(f'stats_player_week_{season}.csv', captures, cache_dir, cutoff,
                         urls[f'stats_player_week_{season}.csv'])
    rosters = _checked_csv(f'roster_weekly_{season}.csv', captures, cache_dir, cutoff,
                           urls[f'roster_weekly_{season}.csv'])
    injuries = _checked_csv(f'injuries_{season}.csv', captures, cache_dir, cutoff,
                            urls[f'injuries_{season}.csv'])
    schedules = _checked_csv('games.csv', captures, cache_dir, cutoff, urls['games.csv'])

    games_by_team: dict[str, GameInput] = {}
    for row in schedules:
        if int(row['season']) != season or int(row['week']) != week or row.get('game_type') != 'REG':
            continue
        game = GameInput(row['game_id'], row['home_team'], row['away_team'], _kickoff(row))
        games_by_team[game.home_team] = game
        games_by_team[game.away_team] = game

    people: dict[str, PlayerInput] = {}
    history: dict[str, list[dict[str, float]]] = {}
    for row in stats:
        if (int(row['season']) != season or row.get('season_type') != 'REG'
                or int(row['week']) >= week or row.get('position') not in POSITIONS):
            continue
        player_id = row['player_id']
        if not player_id:
            continue
        entry = {'week': float(row['week'])}
        for field in NUMERIC_FIELDS:
            if row.get(field):
                entry[field] = float(row[field])
        history.setdefault(player_id, []).append(entry)

    roster_weeks = [int(row['week']) for row in rosters
                    if int(row['season']) == season and row.get('game_type') == 'REG'
                    and int(row['week']) <= week]
    if not roster_weeks:
        raise ValueError(f'no pre-week roster available for {season} week {week}')
    roster_week = max(roster_weeks)
    for row in rosters:
        if (int(row['season']) != season or int(row['week']) != roster_week
                or row.get('game_type') != 'REG' or row.get('position') not in POSITIONS
                or row.get('status') not in ('ACT', 'Active')):
            continue
        player_id = row.get('gsis_id') or ''
        if player_id:
            people[player_id] = PlayerInput(player_id, row.get('full_name') or player_id,
                                            row['team'], row['position'])
            history.setdefault(player_id, [])

    known_injuries: dict[str, InjuryInput] = {}
    for row in injuries:
        if (int(row['season']) != season or int(row['week']) != week
                or row.get('season_type') != 'REG'):
            continue
        player_id = row.get('gsis_id') or ''
        modified = row.get('date_modified') or captures[f'injuries_{season}.csv']['retrieved_at']
        if not player_id or _instant(modified) > cutoff:
            continue
        prior = known_injuries.get(player_id)
        if prior is None or _instant(prior.modified_at) <= _instant(modified):
            known_injuries[player_id] = InjuryInput(player_id, row.get('report_status') or 'Unknown',
                row.get('report_primary_injury') or '', row.get('practice_status') or '', modified)

    sorted_people = sorted(people.values(), key=lambda person: person.player_id)
    history = {person.player_id: history[person.player_id] for person in sorted_people}
    games_by_player = {person.player_id: games_by_team[person.team] for person in sorted_people
                       if person.team in games_by_team}
    return WeekInput(season, week, roster_week, cutoff_utc, sorted_people, games_by_player, history,
                     known_injuries, captures)
