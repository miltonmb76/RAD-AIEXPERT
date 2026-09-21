#!/usr/bin/env bash
# =============================================================================
# PEGAR TODO ESTO EN CLOUD SHELL
# Clasificaciones del pulido = solo pendientes (sin auto-insert)
# branch cursor/clinical-polish-0681
# =============================================================================
set -euo pipefail

if [ -f package.json ] && [ -d src ]; then
  ROOT="$PWD"
elif [ -d "$HOME/rad-ai-expert-deploy" ]; then
  ROOT="$HOME/rad-ai-expert-deploy"
elif [ -d "$HOME/RAD-AIEXPERT" ]; then
  ROOT="$HOME/RAD-AIEXPERT"
elif [ -d "$HOME/rad-aiexpert" ]; then
  ROOT="$HOME/rad-aiexpert"
else
  echo "ERROR: cd ~/rad-ai-expert-deploy y vuelve a pegar."
  exit 1
fi

cd "$ROOT"
echo "==> Repo: $ROOT"

git fetch origin
git checkout cursor/clinical-polish-0681
git pull origin cursor/clinical-polish-0681

echo ""
echo "==> Verificando clasificaciones pendientes..."
rg -n "MAX_AUTO_CLASSIFICATIONS = 0|Never auto-insert|pendiente de aprobación" \
  src/lib/reportEnrichment.ts | head -15
python3 - <<'PY'
from pathlib import Path
t = Path("src/lib/reportEnrichment.ts").read_text(encoding="utf-8")
assert "MAX_AUTO_CLASSIFICATIONS = 0" in t
assert "autoSafe: false" in t
print("OK: clasificaciones sin auto-insert")
PY

echo ""
echo "==> Listo. Despliega con:"
echo "gcloud run deploy rad-ai-expert --source . --region us-central1"
