#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Quitar módulo Diagnóstico Avanzado
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/miltonmb76/RAD-AIEXPERT.git}"
BRANCH="${BRANCH:-cursor/remove-diagnostico-avanzado-0681}"
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

# Must NOT contain the Diagnóstico Avanzado card / batch entry
if grep -q 'id: "case_analysis"' src/App.tsx; then
  echo "ERROR: aún existe case_analysis en App. Aborto."; exit 1
fi
if grep -q 'Diagnóstico Avanzado' src/App.tsx; then
  echo "ERROR: aún existe label Diagnóstico Avanzado en App. Aborto."; exit 1
fi
if grep -q 'handleAnalyzeCase' src/App.tsx; then
  echo "ERROR: aún existe handleAnalyzeCase en App. Aborto."; exit 1
fi
grep -q 'handleSearchBibliography' src/App.tsx \
  || { echo "ERROR: se rompió bibliografía al quitar el módulo. Aborto."; exit 1; }

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
if gcloud secrets describe openai-api-key >/dev/null 2>&1; then
  SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
fi

echo ">>> Desplegando $SERVICE ($REGION) — sin Diagnóstico Avanzado..."
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --update-secrets="$SECRETS"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)"
echo ">>> Listo. URL Cloud Run: ${URL:-ver consola}"
echo ">>> Hard-refresh → el módulo Diagnóstico Avanzado ya no debe aparecer en batch ni como tarjeta."
