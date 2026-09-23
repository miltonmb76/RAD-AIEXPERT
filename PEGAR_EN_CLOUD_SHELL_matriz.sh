#!/usr/bin/env bash
# PEGAR TODO EN CLOUD SHELL
# Matriz semiología → conducta (módulo manual)
# Paso único: pull + deploy
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
echo "==> Verificando matriz..."
rg -n "semiotics_conduct_matrix|generate-semiotics-conduct-matrix|SemioticsConductMatrix" \
  src/App.tsx server.ts src/lib/modelRouting.ts \
  src/lib/semioticsConductMatrix.ts \
  src/components/SemioticsConductMatrixModule.tsx \
  src/utils/semioticsConductMatrixPdfRenderer.ts | head -40

test -f src/components/SemioticsConductMatrixModule.tsx
test -f src/utils/semioticsConductMatrixPdfRenderer.ts
test -f src/lib/semioticsConductMatrix.ts

echo ""
echo "==> Desplegando..."
gcloud run deploy rad-ai-expert --source . --region us-central1
