#!/usr/bin/env bash
# =============================================================================
# PEGAR TODO ESTO EN CLOUD SHELL
# Fix: abdomen ya no recibe protocolo arterial MMII  (cursor/clinical-polish-0681)
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
echo "==> Verificando guard de protocolo de medidas..."
test -f src/lib/measurementStudyGuard.ts && echo "OK measurementStudyGuard.ts"
rg -n "shouldEnforceArterialMmiiProtocol|filterStructuresForStudyType|TIPO DE ESTUDIO DECLARADO" \
  src/lib/measurementStudyGuard.ts src/lib/reportEnrichment.ts server.ts \
  | head -30 || true

echo ""
echo "==> Listo. Despliega con:"
echo "gcloud run deploy rad-ai-expert --source . --region us-central1"
