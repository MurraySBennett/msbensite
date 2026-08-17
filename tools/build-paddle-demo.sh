#!/usr/bin/env bash
# build-paddle-demo.sh — regenerate demos/paddle from the paddle-exp source.
#
#   bash tools/build-paddle-demo.sh [path-to-paddle-exp]
#
# The demo is the REAL experiment client. classes.js, gameflow.js, rendering.js,
# input.js, endgame.js and setup.js are copied verbatim — the physics, collision
# handling, DRT timing, scoring and rendering are exactly what participants get.
#
# Only two files are ours: js/offline-server.js (stands in for the server) and
# index.html (the launcher). Both are preserved across rebuilds.
#
# RUN THIS WHENEVER paddle-exp CHANGES. The demo is a copy, so it goes stale
# silently — the first build was made from a commit 49 days behind the working
# copy, and nothing complained.
set -uo pipefail

SRC="${1:-$HOME/projects/paddle-exp}/paddle_exp/www"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
DST="$HERE/demos/paddle"

[ -d "$SRC" ] || { echo "no paddle-exp client at $SRC" >&2; exit 1; }

# Warn if the source has uncommitted changes — the demo would capture a state
# that exists nowhere else, which is how it drifted the first time.
SRC_REPO="$(cd "$SRC/../.." && pwd)"
if [ -d "$SRC_REPO/.git" ]; then
  dirty=$(git -C "$SRC_REPO" status --porcelain 2>/dev/null | grep -c . || true)
  if [ "$dirty" != "0" ]; then
    echo "WARNING: paddle-exp has $dirty uncommitted changes."
    echo "         The demo will capture them. Commit first if that is not intended."
    echo
  fi
  echo "source: $(git -C "$SRC_REPO" log --oneline -1)"
fi

mkdir -p "$DST/js"

# Keep our two additions.
tmp=$(mktemp -d)
[ -f "$DST/js/offline-server.js" ] && cp "$DST/js/offline-server.js" "$tmp/"
[ -f "$DST/index.html" ] && cp "$DST/index.html" "$tmp/"

rm -rf "$DST/js" "$DST/game.html"
mkdir -p "$DST/js"

cp "$SRC/paddleGame.html" "$DST/game.html"
cp "$SRC"/js/*.js "$DST/js/"

[ -f "$tmp/offline-server.js" ] && cp "$tmp/offline-server.js" "$DST/js/"
[ -f "$tmp/index.html" ] && cp "$tmp/index.html" "$DST/"
rm -rf "$tmp"

# The shim must replace window.WebSocket before setup.js constructs one, so it
# is injected as the first script in <head>.
python3 - "$DST/game.html" <<'PY'
import re, sys
p = sys.argv[1]
s = open(p, encoding='utf-8', errors='replace').read()
tag = '<script src="js/offline-server.js"></script>'
if tag in s:
    print("  shim already present")
else:
    new, n = re.subn(r'(<head[^>]*>)', r'\1\n' + tag, s, count=1, flags=re.I)
    if n == 0:
        print("  ERROR: no <head> to inject into", file=sys.stderr); sys.exit(1)
    open(p, 'w', encoding='utf-8').write(new)
    print("  shim injected")
PY

echo
echo "built: $(find "$DST" -type f | wc -l) files, $(du -sh "$DST" | cut -f1)"
command -v node >/dev/null && for f in "$DST"/js/*.js; do
  node --check "$f" >/dev/null 2>&1 || echo "  SYNTAX ERROR: $(basename "$f")"
done
echo "  syntax: ok"
