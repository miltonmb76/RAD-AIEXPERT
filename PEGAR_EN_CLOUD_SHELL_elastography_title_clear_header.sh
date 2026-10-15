#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Elastografia PDF: titulo debajo de la linea gris del header
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/miltonmb76/RAD-AIEXPERT.git}"
BRANCH="${BRANCH:-cursor/elastography-title-clear-header-0681}"
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

grep -q 'topY = 22' src/utils/elastographyPdfRenderer.ts \
  || { echo "ERROR: topY no es 22 (debe quedar bajo la linea gris del header). Aborto."; exit 1; }
grep -q 'gray rule 15.5' src/utils/elastographyPdfRenderer.ts \
  || { echo "ERROR: falta comentario de clearance del header. Aborto."; exit 1; }

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

echo ">>> OK: Elastografia PDF titulo bajo linea gris del header desplegado."
