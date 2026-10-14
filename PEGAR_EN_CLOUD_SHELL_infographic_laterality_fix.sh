#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Infografias clasicas: lateralidad AP/PA reforzada
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/miltonmb76/RAD-AIEXPERT.git}"
BRANCH="${BRANCH:-cursor/infographic-laterality-fix-0681}"
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

grep -q 'extractInfographicLaterality' src/lib/infographicLaterality.ts \
  || { echo "ERROR: falta extractInfographicLaterality. Aborto."; exit 1; }
grep -q 'buildLateralityPlacementBrief' src/lib/infographicLaterality.ts \
  || { echo "ERROR: falta buildLateralityPlacementBrief. Aborto."; exit 1; }
grep -q 'studyLaterality' server.ts \
  || { echo "ERROR: falta studyLaterality en server. Aborto."; exit 1; }
grep -q 'studyLaterality' src/App.tsx \
  || { echo "ERROR: falta studyLaterality en App. Aborto."; exit 1; }
grep -q 'lateralityBrief' src/lib/infographicCopyPlan.ts \
  || { echo "ERROR: falta lateralityBrief en copy plan. Aborto."; exit 1; }

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
if gcloud secrets describe openai-api-key >/dev/null 2>&1; then
  SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
fi

echo ">>> Desplegando $SERVICE ($REGION) — lateralidad infografias..."
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --update-secrets="$SECRETS"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)"
echo ">>> Listo. URL Cloud Run: ${URL:-ver consola}"
echo ">>> Hard-refresh → regenera infografia: usa lateralidad del estudio + informe y regla AP/PA bloqueada."
