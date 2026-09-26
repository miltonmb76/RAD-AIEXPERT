#!/usr/bin/env bash
# PEGAR TODO EN CLOUD SHELL
# Pulido: anti-duplicados + pase final de redacción
set -euo pipefail

if [ -f package.json ] && [ -d src ]; then
  ROOT="$PWD"
elif [ -d "$HOME/rad-ai-expert-deploy" ]; then
  ROOT="$HOME/rad-ai-expert-deploy"
elif [ -d "$HOME/RAD-AIEXPERT" ]; then
  ROOT="$HOME/RAD-AIEXPERT"
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
echo "==> Verificando pase de coherencia..."
rg -n "runCoherencePass|dedupeEnrichmentChanges|buildCoherencePassInstruction" \
  src/lib/reportEnrichment.ts | head -20

echo ""
echo "==> Desplegando..."
gcloud run deploy rad-ai-expert --source . --region us-central1
