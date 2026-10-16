#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Reloj mama exacto (infografía clásica + suite mama)
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/miltonmb76/RAD-AIEXPERT.git}"
BRANCH="${BRANCH:-cursor/breast-clock-exact-0681}"
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

grep -q 'buildInfographicBreastClockBrief' src/lib/infographicBreastClock.ts \
  || { echo "ERROR: falta brief reloj mama infografia. Aborto."; exit 1; }
grep -q 'buildInfographicBreastClockBrief' server.ts \
  || { echo "ERROR: falta wire reloj en generate-infographic. Aborto."; exit 1; }
grep -q 'BREAST_HOUR_WORD' server_atlas3d.ts \
  || { echo "ERROR: falta horas en palabras (una..doce). Aborto."; exit 1; }
grep -q 'HOUR CHEAT-SHEET' server_atlas3d.ts \
  || { echo "ERROR: falta cheat-sheet geometria reloj. Aborto."; exit 1; }
grep -q 'EXACTITUD OBLIGATORIA' server_atlas3d.ts \
  || { echo "ERROR: falta reglas reloj reforzadas. Aborto."; exit 1; }

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
if gcloud secrets describe openai-api-key >/dev/null 2>&1; then
  SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
fi

echo ">>> Desplegando $SERVICE ($REGION) — breast clock exact..."
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --update-secrets="$SECRETS"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)"
echo ">>> Listo. URL Cloud Run: ${URL:-ver consola}"
echo ">>> Hard-refresh → regenerar infografía clásica mama y/o Suite Mama 3D."
