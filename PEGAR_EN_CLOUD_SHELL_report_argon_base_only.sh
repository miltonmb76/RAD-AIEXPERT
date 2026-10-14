#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Argon solo para el informe (toggle desde el inicio + regen)
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/miltonmb76/RAD-AIEXPERT.git}"
BRANCH="${BRANCH:-cursor/report-argon-base-only-0681}"
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

grep -q 'modelOverride' src/lib/generateReportHandler.ts \
  || { echo "ERROR: falta modelOverride. Aborto."; exit 1; }
grep -q 'useArgonForBaseReport' src/App.tsx \
  || { echo "ERROR: falta useArgonForBaseReport. Aborto."; exit 1; }
grep -q 'Argon solo para el informe' src/App.tsx \
  || { echo "ERROR: falta toggle Argon solo para el informe. Aborto."; exit 1; }
grep -q 'handleRegenerateBaseReportWithArgon' src/App.tsx \
  || { echo "ERROR: falta handleRegenerateBaseReportWithArgon. Aborto."; exit 1; }
grep -q 'gemini-4-argon' src/App.tsx \
  || { echo "ERROR: falta override gemini-4-argon. Aborto."; exit 1; }

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
if gcloud secrets describe openai-api-key >/dev/null 2>&1; then
  SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
fi

echo ">>> Desplegando $SERVICE ($REGION) — Argon solo para el informe..."
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --update-secrets="$SECRETS"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)"
echo ">>> Listo. URL Cloud Run: ${URL:-ver consola}"
echo ">>> Hard-refresh → marca 'Argon solo para el informe' y pulsa Simple o Completo (selector sigue en Auto)."
