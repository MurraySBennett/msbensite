"""Validate and publish versioned, checksum-backed forecast snapshots."""

from dataclasses import asdict
from datetime import datetime
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import tempfile

from fantasy.model import Forecast
from fantasy.source import NUMERIC_FIELDS, _source_urls


COUNT_FIELDS = NUMERIC_FIELDS - frozenset(('passing_yards', 'rushing_yards', 'receiving_yards'))
TEAM_FIELDS = ('targets', 'carries', 'attempts', 'other_attempts', 'fg_att', 'pat_att')
FG_BUCKETS = ('fg_made_0_19', 'fg_made_20_29', 'fg_made_30_39',
              'fg_made_40_49', 'fg_made_50_59', 'fg_made_60_')


def _instant(value: str) -> datetime:
    instant = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if instant.tzinfo is None:
        raise ValueError(f'timestamp lacks timezone: {value}')
    return instant


def _count(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0 and int(value) == value


def _json_bytes(value: object) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)
            + '\n').encode('utf-8')


def _sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _validate(forecast: Forecast) -> None:
    if forecast.draw_count < 1:
        raise ValueError('draw count must be positive')
    if not forecast.players:
        raise ValueError('forecast has no players')
    cutoff = _instant(forecast.cutoff_utc)
    _instant(forecast.generated_at)
    if not 1 <= forecast.week <= 18 or forecast.season < 1999:
        raise ValueError('invalid forecast season or week')
    if set(forecast.captures) != set(_source_urls(forecast.season)):
        raise ValueError('incomplete source attribution')
    for name, record in forecast.captures.items():
        retrieved = _instant(record['retrieved_at'])
        if retrieved > cutoff:
            raise ValueError(f'source after cutoff: {name}')
        if (record.get('licence') != 'CC-BY-4.0'
                or record.get('url') != _source_urls(forecast.season)[name]
                or len(record.get('sha256', '')) != 64):
            raise ValueError(f'uncleared source: {name}')
    if set(forecast.games) != set(forecast.players):
        raise ValueError('game lock missing for a player')
    for team, draws in forecast.team_opportunity.items():
        if len(draws) != forecast.draw_count:
            raise ValueError(f'team draw count mismatch: {team}')
        for totals in draws:
            if set(totals) != set(TEAM_FIELDS) or not all(_count(v) for v in totals.values()):
                raise ValueError(f'invalid team opportunity: {team}')
            if totals['targets'] > totals['attempts'] or totals['other_attempts'] > totals['attempts']:
                raise ValueError(f'invalid pass volume: {team}')
    for player_id, player in forecast.players.items():
        if player.player_id != player_id:
            raise ValueError(f'player ID mismatch: {player_id}')
        if player.team not in forecast.team_opportunity:
            raise ValueError(f'team opportunity missing: {player.team}')
        if len(player.draws) != forecast.draw_count:
            raise ValueError(f'player draw count mismatch: {player_id}')
        if player.injury_status.lower() != 'unknown' and not player.injury_issued_at:
            raise ValueError(f'injury issue time missing: {player_id}')
        if player.injury_issued_at and _instant(player.injury_issued_at) > cutoff:
            raise ValueError(f'injury after cutoff: {player_id}')
        game = forecast.games[player_id]
        if player.team not in (game['home_team'], game['away_team']):
            raise ValueError(f'game team mismatch: {player_id}')
        if _instant(game['kickoff_utc']) <= cutoff:
            raise ValueError(f'game lock before cutoff: {player_id}')
        for draw in player.draws:
            if set(draw.stats) != NUMERIC_FIELDS:
                raise ValueError(f'unsupported or missing stat fields: {player_id}')
            if any(not isinstance(value, (int, float)) or isinstance(value, bool)
                   or not math.isfinite(value) or value < 0
                   for value in draw.stats.values()):
                raise ValueError(f'invalid stat component: {player_id}')
            if any(not _count(draw.stats[field]) for field in COUNT_FIELDS):
                raise ValueError(f'invalid count component: {player_id}')
            if not draw.available and any(draw.stats.values()):
                raise ValueError(f'unavailable player has points: {player_id}')
            for made, attempts in (('receptions', 'targets'), ('completions', 'attempts'),
                                   ('fg_made', 'fg_att'), ('pat_made', 'pat_att')):
                if draw.stats[made] > draw.stats[attempts]:
                    raise ValueError(f'{made} exceeds {attempts}: {player_id}')
            if (draw.stats['fg_made'] != sum(draw.stats[field] for field in FG_BUCKETS)
                    or draw.stats['fg_missed'] + draw.stats['fg_made'] != draw.stats['fg_att']
                    or draw.stats['pat_missed'] + draw.stats['pat_made'] != draw.stats['pat_att']):
                raise ValueError(f'kicking count mismatch: {player_id}')
    for team, series in forecast.team_opportunity.items():
        members = [player for player in forecast.players.values() if player.team == team]
        for index, totals in enumerate(series):
            for field in TEAM_FIELDS:
                if field in ('attempts', 'other_attempts'):
                    continue
                if sum(player.draws[index].stats[field] for player in members) != totals[field]:
                    raise ValueError(f'team {field} not conserved: {team}')
            if (sum(player.draws[index].stats['attempts'] for player in members)
                    + totals['other_attempts'] != totals['attempts']):
                raise ValueError(f'team attempts not conserved: {team}')


def _verify_version(destination: Path, expected_manifest: bytes) -> None:
    try:
        manifest_bytes = (destination / 'manifest.json').read_bytes()
        if manifest_bytes != expected_manifest:
            raise ValueError('manifest content mismatch')
        manifest = json.loads(manifest_bytes)
        for shard in manifest['shards']:
            path = destination / Path(shard['path']).name
            if _sha256(path.read_bytes()) != shard['sha256']:
                raise ValueError('shard checksum mismatch')
    except (OSError, KeyError, ValueError, TypeError) as exc:
        raise ValueError(f'existing snapshot is partial or malformed: {destination}') from exc


def write_snapshot(forecast: Forecast, output: Path) -> None:
    """Keep the old current pointer until every new shard has been validated."""
    _validate(forecast)
    output = Path(output)
    versions = output / 'versions'
    versions.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix='.staging-', dir=versions))
    try:
        shards = []
        for team in sorted(forecast.team_opportunity):
            if not team.isalnum():
                raise ValueError(f'invalid team code: {team}')
            players = {player_id: asdict(player) for player_id, player
                       in sorted(forecast.players.items()) if player.team == team}
            payload = _json_bytes({'team': team, 'team_opportunity': forecast.team_opportunity[team],
                                   'players': players})
            filename = f'team-{team}.json'
            (staging / filename).write_bytes(payload)
            shards.append({'team': team, 'filename': filename, 'sha256': _sha256(payload),
                           'player_count': len(players)})
        manifest = {
            'schema_version': 1, 'season': forecast.season, 'week': forecast.week,
            'generated_at': forecast.generated_at, 'cutoff_utc': forecast.cutoff_utc,
            'roster_week': forecast.roster_week, 'model_version': forecast.model_version,
            'seed': forecast.seed, 'draw_count': forecast.draw_count,
            'supported_stat_fields': sorted(NUMERIC_FIELDS), 'sources': forecast.captures,
            'games': forecast.games,
            'shards': shards,
        }
        version = _sha256(_json_bytes(manifest))[:20]
        for shard in shards:
            shard['path'] = f'versions/{version}/{shard.pop("filename")}'
        manifest_bytes = _json_bytes(manifest)
        (staging / 'manifest.json').write_bytes(manifest_bytes)
        for shard in shards:
            if _sha256((staging / Path(shard['path']).name).read_bytes()) != shard['sha256']:
                raise ValueError(f'shard checksum mismatch: {shard["team"]}')
        destination = versions / version
        if destination.exists():
            _verify_version(destination, manifest_bytes)
            shutil.rmtree(staging)
        else:
            staging.replace(destination)
            _verify_version(destination, manifest_bytes)
        pointer = {'schema_version': 1, 'manifest': f'versions/{version}/manifest.json',
                   'manifest_sha256': _sha256((destination / 'manifest.json').read_bytes())}
        temporary_pointer = output / '.current.json.tmp'
        temporary_pointer.write_bytes(_json_bytes(pointer))
        os.replace(temporary_pointer, output / 'current.json')
    finally:
        if staging.exists():
            shutil.rmtree(staging)
