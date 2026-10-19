#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Cadena de razonamiento: diagnóstico no se sale del cuadro
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/miltonmb76/RAD-AIEXPERT.git}"
BRANCH="${BRANCH:-cursor/reasoning-banner-wrap-0681}"
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
gcloud config set project rad-ai-expert-personal >/dev/null
git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"
echo ">>> Rama: $(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short HEAD)"

grep -q 'jsPDF splitTextToSize uses the CURRENT font metrics' src/utils/reasoningChainPdfRenderer.ts \
  || { echo "ERROR: falta fix de wrap del banner. Aborto."; exit 1; }
grep -q 'bannerTextW' src/utils/reasoningChainPdfRenderer.ts \
  || { echo "ERROR: falta bannerTextW. Aborto."; exit 1; }
grep -q 'break-words whitespace-normal' src/components/ReasoningChainModule.tsx \
  || { echo "ERROR: falta wrap en UI. Aborto."; exit 1; }
echo "OK banner wrap"

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
if gcloud secrets describe openai-api-key >/dev/null 2>&1; then
  SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
fi

echo ">>> Desplegando $SERVICE ($REGION) — reasoning banner wrap..."
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --update-secrets="$SECRETS"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)"
echo ">>> Listo. URL Cloud Run: ${URL:-ver consola}"
echo ">>> Hard-refresh → PDF → anexo Cadena: el diagnóstico largo debe envolver dentro del cuadro violeta."
