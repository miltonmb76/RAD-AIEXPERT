#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Ficha lesión dominante PDF apretado
# (márgenes bajo running header, US sin letterboxing, sin overflow al footer)
#
# NO uses "npm start" / localhost:3000 — eso es solo preview y se cae.
# Este script despliega a Cloud Run (la URL pública que usas de verdad).
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/miltonmb76/RAD-AIEXPERT.git}"
BRANCH="${BRANCH:-cursor/dominant-card-pdf-tight-0681}"
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

# Verificación: si no está el fix, abortar (evita redeploy del PDF viejo)
if ! grep -q "coverCropDataUrl" src/utils/dominantLesionCardPdfRenderer.ts; then
  echo "ERROR: no está coverCropDataUrl — rama incorrecta. Aborto."
  exit 1
fi
if ! grep -q "let y = 22" src/utils/dominantLesionCardPdfRenderer.ts; then
  echo "ERROR: masthead no arranca en y=22 — rama incorrecta. Aborto."
  exit 1
fi
echo ">>> OK: renderer PDF-tight presente."

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
if gcloud secrets describe openai-api-key >/dev/null 2>&1; then
  SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
fi

echo ">>> Desplegando $SERVICE ($REGION) — ficha PDF-tight..."
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --update-secrets="$SECRETS"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)"
echo ">>> Listo."
echo ">>> Abre la URL de Cloud Run (NO localhost:3000): ${URL:-ver consola Cloud Run}"
echo ">>> Hard-refresh (Ctrl+Shift+R) y vuelve a generar el PDF."
