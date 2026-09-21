#!/usr/bin/env bash
# =============================================================================
# PEGAR TODO ESTO EN CLOUD SHELL
# Guideline Binder ACR/Fleischner + pulido clínico  (branch cursor/clinical-polish-0681)
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
echo "==> Verificando Guideline Binder..."
test -f src/lib/guidelineBinder.ts && echo "OK guidelineBinder.ts"
test -f src/lib/reportFootnotes.ts && echo "OK reportFootnotes.ts"
rg -n "selectGuidelineBinderChanges|source: \"guideline\"|Fleischner 2017" \
  src/lib/guidelineBinder.ts src/lib/reportEnrichment.ts src/components/ReportEnrichmentPanel.tsx \
  | head -25 || true

echo ""
echo "==> Listo. Despliega con:"
echo "gcloud run deploy rad-ai-expert --source . --region us-central1"
