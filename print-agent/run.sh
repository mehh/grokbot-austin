#!/usr/bin/env bash
# One-command launcher: sets up Python deps on first run, then starts the print agent.
# Usage: npm run print-agent [-- --scan|--test|--dry-run ...]
set -euo pipefail
cd "$(dirname "$0")"

PY="${PYTHON:-python3}"

# Load repo-root .env.local / .env if present (BOOTH_URL, BOOTH_TOKEN, PHOMEMO_ADDR).
for f in ../.env.local ../.env; do
  if [ -f "$f" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$f"
    set +a
  fi
done

has_deps() { "$1" -c "import bleak, PIL" >/dev/null 2>&1; }

if [ -x .venv/bin/python ] && has_deps .venv/bin/python; then
  exec .venv/bin/python print_agent.py "$@"
fi

if has_deps "$PY"; then
  exec "$PY" print_agent.py "$@"
fi

echo "· first run: installing bleak + pillow"
rm -rf .venv
if "$PY" -m venv .venv >/dev/null 2>&1 && .venv/bin/python -m pip install --quiet -r requirements.txt; then
  exec .venv/bin/python print_agent.py "$@"
fi

echo "· venv unavailable, falling back to a user install"
rm -rf .venv
"$PY" -m pip install --quiet --user -r requirements.txt 2>/dev/null \
  || "$PY" -m pip install --quiet --user --break-system-packages -r requirements.txt
exec "$PY" print_agent.py "$@"
