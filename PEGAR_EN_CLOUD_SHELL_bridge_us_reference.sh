#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Bridge: eco real como referencia visual del 3D CGI
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/miltonmb76/RAD-AIEXPERT.git}"
BRANCH="${BRANCH:-cursor/bridge-us-reference-0681}"
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

grep -q 'BRIDGE_US_REFERENCE_GUIDE' server_atlas3d.ts \
  || { echo "ERROR: falta BRIDGE_US_REFERENCE_GUIDE. Aborto."; exit 1; }
grep -q 'realUsImageUrl' server_atlas3d.ts \
  || { echo "ERROR: falta realUsImageUrl en API Bridge. Aborto."; exit 1; }
grep -q 'referenceImageUrl' server_atlas3d.ts \
  || { echo "ERROR: falta referenceImageUrl en generateMedicalImage. Aborto."; exit 1; }
grep -q 'realUsImageUrl: realBefore' src/components/UltrasoundPlaneSimulatorModule.tsx \
  || { echo "ERROR: falta envío de eco en generate. Aborto."; exit 1; }
grep -q 'realUsImageUrl: planeData.realUsImage' src/components/UltrasoundPlaneSimulatorModule.tsx \
  || { echo "ERROR: falta envío de eco en regenerate. Aborto."; exit 1; }
grep -q 'guiado por la eco real' src/components/UltrasoundPlaneSimulatorModule.tsx \
  || { echo "ERROR: falta paso de generación con eco. Aborto."; exit 1; }

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
if gcloud secrets describe openai-api-key >/dev/null 2>&1; then
  SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
fi

echo ">>> Desplegando $SERVICE ($REGION) — Bridge US reference..."
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --update-secrets="$SECRETS"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)"
echo ">>> Listo. URL Cloud Run: ${URL:-ver consola}"
echo ">>> Hard-refresh → Bridge: elige eco → Generar. El 3D debe seguir plano/hallazgo de esa captura (estilo CGI)."
