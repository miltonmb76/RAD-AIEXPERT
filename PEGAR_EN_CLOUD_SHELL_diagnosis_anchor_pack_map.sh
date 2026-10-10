#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Ancla + Pack 1 página + Mapa hallazgos Atlas
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/miltonmb76/RAD-AIEXPERT.git}"
BRANCH="${BRANCH:-cursor/diagnosis-anchor-pack-map-0681}"
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

grep -q 'DiagnosisAnchorBar' src/components/DiagnosisAnchorBar.tsx \
  || { echo "ERROR: falta DiagnosisAnchorBar. Aborto."; exit 1; }
grep -q 'buildDiagnosticPack' src/lib/diagnosticPack.ts \
  || { echo "ERROR: falta buildDiagnosticPack. Aborto."; exit 1; }
grep -q 'listPackImageCandidates' src/lib/diagnosticPack.ts \
  || { echo "ERROR: falta listPackImageCandidates. Aborto."; exit 1; }
grep -q 'factSheet' src/lib/diagnosticPack.ts \
  || { echo "ERROR: falta mini-ficha (factSheet). Aborto."; exit 1; }
grep -q 'Imagen A' src/components/DiagnosticPackModule.tsx \
  || { echo "ERROR: faltan selectores Imagen A/B. Aborto."; exit 1; }
grep -q 'placeFindingsAsAnnotations' src/lib/findingsMap.ts \
  || { echo "ERROR: falta placeFindingsAsAnnotations. Aborto."; exit 1; }
grep -q 'diagnosisAnchor' src/App.tsx \
  || { echo "ERROR: falta diagnosisAnchor en App. Aborto."; exit 1; }

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
if gcloud secrets describe openai-api-key >/dev/null 2>&1; then
  SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
fi

echo ">>> Desplegando $SERVICE ($REGION) — ancla + pack + mapa..."
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --update-secrets="$SECRETS"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)"
echo ">>> Listo. URL Cloud Run: ${URL:-ver consola}"
echo ">>> Hard-refresh → Ancla diagnostica → Justificacion / Pack / Mapa Atlas."
