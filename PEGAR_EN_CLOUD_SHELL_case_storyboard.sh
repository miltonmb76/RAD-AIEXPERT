#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Storyboard del caso (secuencia narrativa)
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/miltonmb76/RAD-AIEXPERT.git}"
BRANCH="${BRANCH:-cursor/case-storyboard-0681}"
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

grep -q 'CaseStoryboardModule' src/components/CaseStoryboardModule.tsx \
  || { echo "ERROR: falta CaseStoryboardModule. Aborto."; exit 1; }
grep -q 'generate-case-storyboard' server.ts \
  || { echo "ERROR: falta API generate-case-storyboard. Aborto."; exit 1; }
grep -q 'renderCaseStoryboardAnnexesToPDF' src/utils/caseStoryboardPdfRenderer.ts \
  || { echo "ERROR: falta PDF storyboard. Aborto."; exit 1; }
grep -q 'case_storyboard' src/lib/modelRouting.ts \
  || { echo "ERROR: falta routing case_storyboard. Aborto."; exit 1; }
grep -q 'isCaseStoryboardOpen' src/App.tsx \
  || { echo "ERROR: falta cableado App storyboard. Aborto."; exit 1; }
grep -q 'caseStoryboardData' src/lib/nativePdfDownload.ts \
  || { echo "ERROR: falta anexo PDF en nativePdfDownload. Aborto."; exit 1; }

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
if gcloud secrets describe openai-api-key >/dev/null 2>&1; then
  SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
fi

echo ">>> Desplegando $SERVICE ($REGION) — storyboard del caso..."
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --update-secrets="$SECRETS"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)"
echo ">>> Listo. URL Cloud Run: ${URL:-ver consola}"
echo ">>> Hard-refresh → Inteligencia clinica → Abrir storyboard → Generar."
