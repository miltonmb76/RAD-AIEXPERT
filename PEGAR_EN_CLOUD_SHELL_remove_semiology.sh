#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Quitar Semiología por Imágenes
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/miltonmb76/RAD-AIEXPERT.git}"
BRANCH="${BRANCH:-cursor/remove-semiotics-0681}"
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

# Debe estar eliminado
if grep -q 'generate-semiology-table' server.ts; then
  echo "ERROR: sigue existiendo /api/generate-semiology-table. Aborto."; exit 1
fi
if grep -q 'semiologyData' src/App.tsx; then
  echo "ERROR: sigue existiendo semiologyData en App. Aborto."; exit 1
fi
if grep -q 'handleGenerateSemiologyTable' src/App.tsx; then
  echo "ERROR: sigue existiendo handleGenerateSemiologyTable. Aborto."; exit 1
fi
# Matriz semiología/conducta se conserva
grep -q 'SemioticsConductMatrixModule' src/App.tsx \
  || { echo "ERROR: se rompió la matriz semiologia/conducta. Aborto."; exit 1; }

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
if gcloud secrets describe openai-api-key >/dev/null 2>&1; then
  SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
fi

echo ">>> Desplegando $SERVICE ($REGION) — sin Semiología por Imágenes..."
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --update-secrets="$SECRETS"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)"
echo ">>> Listo. URL Cloud Run: ${URL:-ver consola}"
echo ">>> Hard-refresh: ya no aparece Semiología por Imágenes (IA)."
