#!/usr/bin/env bash
# PEGAR TODO EN CLOUD SHELL
# Infografía de hallazgos: 8 tipos de contenido + 10 layouts (convergencia, radial, embudo…)
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
echo "==> Verificando infografía (contentMode + layouts)..."
rg -n "contentMode|INFOGRAPHIC_CONTENT_MODES|split_compare|buildContentModePromptInstructions" \
  src/lib/findingsInfographic.ts server.ts \
  src/components/FindingsInfographicModule.tsx | head -40

rg -n "findings_infographic|generate-findings-infographic|FindingsInfographic" \
  src/App.tsx server.ts src/lib/modelRouting.ts \
  src/lib/findingsInfographic.ts \
  src/components/FindingsInfographicModule.tsx \
  src/utils/findingsInfographicPdfRenderer.ts | head -30

test -f src/components/FindingsInfographicModule.tsx
test -f src/components/FindingsInfographicCanvas.tsx
test -f src/utils/findingsInfographicPdfRenderer.ts

echo ""
echo "==> Desplegando..."
gcloud run deploy rad-ai-expert --source . --region us-central1
