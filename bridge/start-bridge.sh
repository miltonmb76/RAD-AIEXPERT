#!/usr/bin/env bash
# Arranque del puente Samsung V7 (usado por launchd en macOS)
set -euo pipefail

BRIDGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PYTHON="$BRIDGE_DIR/.venv/bin/python3"
LOG_DIR="${BRIDGE_DATA_DIR:-$HOME/RAD-AIEXPERT-Bridge}/logs"
mkdir -p "$LOG_DIR"

if [[ ! -x "$VENV_PYTHON" ]]; then
  echo "Error: no existe $VENV_PYTHON — ejecuta bash install-mac.sh en bridge/" >&2
  exit 1
fi

cd "$BRIDGE_DIR"
exec "$VENV_PYTHON" "$BRIDGE_DIR/samsung_bridge.py" >> "$LOG_DIR/bridge.log" 2>&1
