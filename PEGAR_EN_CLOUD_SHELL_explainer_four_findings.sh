#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Explainer: hasta 4 hallazgos (2/pagina) + casillas
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/miltonmb76/RAD-AIEXPERT.git}"
BRANCH="${BRANCH:-cursor/explainer-four-findings-0681}"
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

grep -q 'FINDING_EXPLAINER_MAX_CARDS = 4' src/lib/findingExplainer.ts \
  || { echo "ERROR: MAX_CARDS no es 4. Aborto."; exit 1; }
grep -q 'buildFindingExplainerSlotHints' src/lib/findingExplainer.ts \
  || { echo "ERROR: falta buildFindingExplainerSlotHints. Aborto."; exit 1; }
grep -q 'Hallazgo 1' src/components/FindingExplainerModule.tsx \
  || { echo "ERROR: faltan casillas Hallazgo 1..N. Aborto."; exit 1; }
grep -q 'Math.min(4,' server_atlas3d.ts \
  || { echo "ERROR: API no admite max 4. Aborto."; exit 1; }

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
if gcloud secrets describe openai-api-key >/dev/null 2>&1; then
  SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
fi

echo ">>> Desplegando $SERVICE ($REGION) — explainer 4 hallazgos..."
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --update-secrets="$SECRETS"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)"
echo ">>> Listo. URL Cloud Run: ${URL:-ver consola}"
echo ">>> Hard-refresh → Explainer → casillas Hallazgo 1-4 → generar (PDF 2/pagina)."
