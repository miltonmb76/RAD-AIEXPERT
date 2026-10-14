#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Pack diagnostico multi, sin depender de infografia
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/miltonmb76/RAD-AIEXPERT.git}"
BRANCH="${BRANCH:-cursor/pack-multi-independent-0681}"
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

grep -q 'extractFactorsFromReportText' src/lib/diagnosticPack.ts \
  || { echo "ERROR: falta extractFactorsFromReportText. Aborto."; exit 1; }
grep -q 'MAX_DIAGNOSTIC_PACKS' src/lib/diagnosticPack.ts \
  || { echo "ERROR: falta MAX_DIAGNOSTIC_PACKS. Aborto."; exit 1; }
grep -q 'Insertar pack' src/components/DiagnosticPackModule.tsx \
  || { echo "ERROR: falta Insertar pack. Aborto."; exit 1; }
grep -q 'diagnosticPacks' src/App.tsx \
  || { echo "ERROR: falta diagnosticPacks en App. Aborto."; exit 1; }
grep -q 'annexTotal' src/lib/nativePdfDownload.ts \
  || { echo "ERROR: falta multi-pack PDF. Aborto."; exit 1; }

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
if gcloud secrets describe openai-api-key >/dev/null 2>&1; then
  SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
fi

echo ">>> Desplegando $SERVICE ($REGION) — pack multi independiente..."
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --update-secrets="$SECRETS"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)"
echo ">>> Listo. URL Cloud Run: ${URL:-ver consola}"
echo ">>> Hard-refresh → Pack: diagnostico editable, Extraer factores, Insertar pack, Nuevo borrador (hasta 4)."
