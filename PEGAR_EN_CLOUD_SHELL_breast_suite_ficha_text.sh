#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Suite Mama: ficha y textos bajo paneles no vacíos
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/miltonmb76/RAD-AIEXPERT.git}"
BRANCH="${BRANCH:-cursor/breast-suite-ficha-text-0681}"
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

grep -q 'ensureBreastSuiteFichaFields' server_atlas3d.ts \
  || { echo "ERROR: falta ensureBreastSuiteFichaFields en server_atlas3d. Aborto."; exit 1; }
grep -q 'breastSummary' server_atlas3d.ts \
  || { echo "ERROR: falta breastSummary en schema mama. Aborto."; exit 1; }
grep -q 'FICHA CLÍNICA MAMARIA — OBLIGATORIA' server_atlas3d.ts \
  || { echo "ERROR: falta bloque ficha obligatoria en prompt mama. Aborto."; exit 1; }
grep -q 'remapPanelLetterLabels' src/components/OrganSuiteShell.tsx \
  || { echo "ERROR: falta remap de letras al borrar panel. Aborto."; exit 1; }

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
if gcloud secrets describe openai-api-key >/dev/null 2>&1; then
  SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
fi

echo ">>> Desplegando $SERVICE ($REGION) — Suite Mama ficha/textos..."
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --update-secrets="$SECRETS"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)"
echo ">>> Listo. URL Cloud Run: ${URL:-ver consola}"
echo ">>> Hard-refresh → regenera Suite Mama: ficha (resumen/morfología/axilas/puntos) y textos bajo paneles deben llenarse."
