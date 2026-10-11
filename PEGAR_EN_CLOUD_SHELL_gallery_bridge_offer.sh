#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Oferta Bridge al rotular eco
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/miltonmb76/RAD-AIEXPERT.git}"
BRANCH="${BRANCH:-cursor/gallery-bridge-offer-0681}"
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

grep -q 'inferBridgeOfferFromGalleryImage' src/lib/usPlaneBridge.ts \
  || { echo "ERROR: falta inferBridgeOfferFromGalleryImage. Aborto."; exit 1; }
grep -q 'bridgeGalleryOffer' src/App.tsx \
  || { echo "ERROR: falta bridgeGalleryOffer en App. Aborto."; exit 1; }
grep -q 'acceptBridgeGalleryOffer' src/App.tsx \
  || { echo "ERROR: falta acceptBridgeGalleryOffer. Aborto."; exit 1; }
grep -q 'Ir a Bridge US' src/App.tsx \
  || { echo "ERROR: falta toast Bridge. Aborto."; exit 1; }

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
if gcloud secrets describe openai-api-key >/dev/null 2>&1; then
  SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
fi

echo ">>> Desplegando $SERVICE ($REGION) — oferta Bridge al rotular..."
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --update-secrets="$SECRETS"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)"
echo ">>> Listo. URL Cloud Run: ${URL:-ver consola}"
echo ">>> Hard-refresh → rotula una eco en galería → toast «Ir a Bridge US–3D»."
