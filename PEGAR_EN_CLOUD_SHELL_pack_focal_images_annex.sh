#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Pack diagnostico: focales mas fiables + inclusion en anexo
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/miltonmb76/RAD-AIEXPERT.git}"
BRANCH="${BRANCH:-cursor/pack-focal-images-annex-0681}"
SERVICE="${CLOUD_RUN_SERVICE:-rad-ai-expert}"
REGION="${CLOUD_RUN_REGION:-us-central1}"

if [ -d "$HOME/rad-ai-expert-deploy/.git" ]; then
  cd "$HOME/rad-ai-expert-deploy"
elif [ -d "$HOME/RAD-AIEXPERT/.git" ]; then
  cd "$HOME/RAD-AIEXPERT"
elif [ -d "$HOME/rad-ai-expert/.git" ]; then
  cd "$HOME/rad-ai-expert"
else
  echo ">>> No hay clon local. Clonando en ~/rad-ai-expert-deploy ..."
  git clone "$REPO_URL" "$HOME/rad-ai-expert-deploy"
  cd "$HOME/rad-ai-expert-deploy"
fi

echo ">>> Repo: $(pwd)"
git fetch origin
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"
echo ">>> Rama: $(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short HEAD)"

grep -q 'applyPackImageSlots' src/lib/diagnosticPack.ts \
  || { echo "ERROR: falta applyPackImageSlots. Aborto."; exit 1; }
grep -q 'applyPackImageSlots' src/components/DiagnosticPackModule.tsx \
  || { echo "ERROR: falta sync de slots en el modulo. Aborto."; exit 1; }
grep -q 'usablePanels' server_atlas3d.ts \
  || { echo "ERROR: falta rechazo de paneles vacios en API focal. Aborto."; exit 1; }
grep -q 'requestFocal' src/components/DiagnosticPackModule.tsx \
  || { echo "ERROR: falta reintento single-panel. Aborto."; exit 1; }

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
if gcloud secrets describe openai-api-key >/dev/null 2>&1; then
  SECRETS="$SECRETS,OPENAI_API_KEY=openai-api-key:latest"
fi

gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-secrets="$SECRETS" \
  --memory=2Gi \
  --cpu=2 \
  --timeout=300

echo ">>> OK: pack focal images + annex inclusion desplegado."
