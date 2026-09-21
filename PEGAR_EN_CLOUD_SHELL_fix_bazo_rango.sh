#!/usr/bin/env bash
# =============================================================================
# PEGAR TODO ESTO EN CLOUD SHELL
# Fix rango Bazo 90-120 mm  (branch cursor/clinical-polish-0681)
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
echo "==> Verificando rango del bazo..."
rg -n "Bazo \[Rango: 90 - 120 mm|range: \"90 - 120 mm\"|defaultVal: \"105 mm\"" server.ts | head -10
if rg -n "9 - 11,8 mm|10,5 mm" server.ts | rg -i bazo; then
  echo "FAIL: aún hay rango viejo del bazo"
  exit 1
fi
echo "OK bazo 90-120 mm"

echo ""
echo "==> Listo. Despliega con:"
echo "gcloud run deploy rad-ai-expert --source . --region us-central1"
