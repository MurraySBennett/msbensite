"""Generate and publish a frozen weekly fantasy forecast."""

import argparse
from pathlib import Path

from fantasy.model import fit_predict
from fantasy.snapshot import write_snapshot
from fantasy.source import load_week


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--season', required=True, type=int)
    parser.add_argument('--week', required=True, type=int)
    parser.add_argument('--cutoff', required=True, help='UTC ISO-8601 source cutoff')
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--cache', type=Path, default=Path('fantasy/cache'))
    parser.add_argument('--seed', type=int, default=20260930)
    parser.add_argument('--draws', type=int, default=1000)
    args = parser.parse_args()
    week = load_week(args.season, args.week, args.cutoff, args.cache)
    forecast = fit_predict(week, args.seed, args.draws)
    write_snapshot(forecast, args.output)
    print(f'Published {len(forecast.players)} players for {args.season} week {args.week}'
          f' with cutoff {args.cutoff} to {args.output / "current.json"}')


if __name__ == '__main__':
    main()
