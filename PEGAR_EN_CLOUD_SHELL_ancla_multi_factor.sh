#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Ancla manual no colapsa el grafico a 1 factor
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/miltonmb76/RAD-AIEXPERT.git}"
BRANCH="${BRANCH:-cursor/ancla-multi-factor-graph-0681}"
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

grep -q 'OBLIGATORIO: genera 4-6 nodes' src/lib/findingsInfographic.ts \
  || { echo "ERROR: falta prompt multi-factor. Aborto."; exit 1; }
grep -q 'strictAnchorFilter' src/lib/diagnosticPack.ts \
  || { echo "ERROR: falta strictAnchorFilter. Aborto."; exit 1; }
grep -q 'countInfographicNodes' server.ts \
  || { echo "ERROR: falta retry por pocos nodes. Aborto."; exit 1; }
grep -q 'sessionAncla' src/lib/infographicFromModules.ts \
  || { echo "ERROR: falta sessionAncla en infographicFromScorecard. Aborto."; exit 1; }

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
if gcloud secrets describe openai-api-key >/dev/null 2>&1; then
  SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
fi

echo ">>> Desplegando $SERVICE ($REGION) — ancla multi-factor..."
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --update-secrets="$SECRETS"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)"
echo ">>> Listo. URL Cloud Run: ${URL:-ver consola}"
echo ">>> Hard-refresh → fija ancla → regenera justificacion/pack → debe haber 4+ factores."
