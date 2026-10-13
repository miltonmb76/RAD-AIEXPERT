#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Ancla diagnostica bajo Hallazgos (pre-reporte)
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/miltonmb76/RAD-AIEXPERT.git}"
BRANCH="${BRANCH:-cursor/early-diagnosis-anchor-0681}"
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

grep -q 'diagnosisAnchor' src/App.tsx \
  || { echo "ERROR: falta diagnosisAnchor en App. Aborto."; exit 1; }
grep -q 'pre-reporte' src/App.tsx \
  || { echo "ERROR: falta ancla pre-reporte bajo Hallazgos. Aborto."; exit 1; }
grep -q 'ANCLA DIAGN' server.ts \
  || { echo "ERROR: falta ancla en /api/analyze. Aborto."; exit 1; }
grep -q 'diagnosisAnchor' src/lib/generateReportHandler.ts \
  || { echo "ERROR: falta diagnosisAnchor en generateReportHandler. Aborto."; exit 1; }
grep -q 'diagnosisAnchor' src/firebaseDb.ts \
  || { echo "ERROR: falta diagnosisAnchor en CloudStudy. Aborto."; exit 1; }

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
if gcloud secrets describe openai-api-key >/dev/null 2>&1; then
  SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
fi

echo ">>> Desplegando $SERVICE ($REGION) — ancla temprana bajo Hallazgos..."
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --update-secrets="$SECRETS"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)"
echo ">>> Listo. URL Cloud Run: ${URL:-ver consola}"
echo ">>> Hard-refresh → Hallazgos → Ancla diagnostica (opcional) → Generar informe."
