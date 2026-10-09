#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Infografías duales por pestaña (clásica + hallazgos)
# Una versión a la vez a tamaño completo; nunca lado a lado.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/miltonmb76/RAD-AIEXPERT.git}"
BRANCH="${BRANCH:-cursor/classic-infographic-dual-tabs-0681}"
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

grep -q 'infographicAudienceTab' src/App.tsx \
  || { echo "ERROR: falta infographicAudienceTab (pestañas clásica). Aborto."; exit 1; }
grep -q 'audience: "clinician"' src/App.tsx \
  || { echo "ERROR: falta fetch audience clinician. Aborto."; exit 1; }
grep -q 'Toca una pestaña' src/components/FindingsInfographicModule.tsx \
  || { echo "ERROR: falta UI de pestañas en hallazgos. Aborto."; exit 1; }
grep -q 'infographicClinicianUrl' src/lib/nativePdfDownload.ts \
  || { echo "ERROR: falta infographicClinicianUrl en PDF. Aborto."; exit 1; }
if grep -q 'grid grid-cols-1 lg:grid-cols-2 gap-3' src/components/FindingsInfographicModule.tsx; then
  echo "ERROR: aún hay grid lado a lado en hallazgos. Aborto."
  exit 1
fi

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
if gcloud secrets describe openai-api-key >/dev/null 2>&1; then
  SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
fi

echo ">>> Desplegando $SERVICE ($REGION) — classic + findings tabs..."
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --update-secrets="$SECRETS"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)"
echo ">>> Listo. URL Cloud Run: ${URL:-ver consola}"
echo ">>> Hard-refresh → Infografías (Paciente + Médico) → pestañas a tamaño completo."
echo ">>> Módulos → Infografía dual → pestañas Médico/Paciente (una a la vez)."
