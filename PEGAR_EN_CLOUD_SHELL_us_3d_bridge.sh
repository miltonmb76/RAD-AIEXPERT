#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Bridge eco ↔ anatomía (US–3D)
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/miltonmb76/RAD-AIEXPERT.git}"
BRANCH="${BRANCH:-cursor/us-3d-bridge-0681}"
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

grep -q 'realUsImage' src/types.ts \
  || { echo "ERROR: falta realUsImage en types. Aborto."; exit 1; }
grep -q 'buildUsPlaneBridgeLabels' src/lib/usPlaneBridge.ts \
  || { echo "ERROR: falta usPlaneBridge.ts. Aborto."; exit 1; }
grep -q 'galleryImages' src/components/UltrasoundPlaneSimulatorModule.tsx \
  || { echo "ERROR: falta galleryImages en simulador. Aborto."; exit 1; }
grep -q 'CORTE ECO - ANATOMIA' src/utils/usPlaneSimulatorPdfRenderer.ts \
  || { echo "ERROR: falta titulo ASCII del anexo bridge. Aborto."; exit 1; }
grep -q 'bridgeOnlyFocal' src/components/UltrasoundPlaneSimulatorModule.tsx \
  || { echo "ERROR: falta bridgeOnlyFocal (solo corte focal). Aborto."; exit 1; }
grep -q 'Rótulos' src/components/UltrasoundPlaneSimulatorModule.tsx \
  || { echo "ERROR: faltan rotulos editables. Aborto."; exit 1; }
grep -q 'galleryImages={attachedImages' src/App.tsx \
  || { echo "ERROR: falta cableado galería→simulador. Aborto."; exit 1; }

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
if gcloud secrets describe openai-api-key >/dev/null 2>&1; then
  SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
fi

echo ">>> Desplegando $SERVICE ($REGION) — bridge eco↔anatomía..."
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --update-secrets="$SECRETS"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)"
echo ">>> Listo. URL Cloud Run: ${URL:-ver consola}"
echo ">>> Hard-refresh → Bridge US–3D: elige eco de galería → Generar plano 3D."
