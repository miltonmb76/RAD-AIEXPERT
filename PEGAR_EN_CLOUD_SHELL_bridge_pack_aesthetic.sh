#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Bridge Pack aesthetic (texto izq · US→3D der)
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/miltonmb76/RAD-AIEXPERT.git}"
BRANCH="${BRANCH:-cursor/bridge-pack-aesthetic-0681}"
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

grep -q 'Vista previa · correlación eco-anatómica' src/components/UltrasoundPlaneSimulatorModule.tsx \
  || { echo "ERROR: falta preview Pack en Bridge UI. Aborto."; exit 1; }
grep -q 'mismo hallazgo · mismo plano' src/components/UltrasoundPlaneSimulatorModule.tsx \
  || { echo "ERROR: falta conector US→3D en módulo. Aborto."; exit 1; }
grep -q 'bg-\[#fafaf9\]' src/components/UltrasoundPlaneSimulatorModule.tsx \
  || { echo "ERROR: falta fondo stone Pack en Bridge. Aborto."; exit 1; }
grep -q 'CORRELACIÓN ECO-ANATÓMICA 3D' src/utils/usPlaneSimulatorPdfRenderer.ts \
  || { echo "ERROR: falta título Pack del anexo Bridge. Aborto."; exit 1; }
grep -q 'mismo hallazgo · mismo plano' src/utils/usPlaneSimulatorPdfRenderer.ts \
  || { echo "ERROR: falta conector en PDF Bridge. Aborto."; exit 1; }
grep -q 'MINI-FICHA DEL PLANO' src/utils/usPlaneSimulatorPdfRenderer.ts \
  || { echo "ERROR: falta mini-ficha en PDF Bridge. Aborto."; exit 1; }
grep -q 'leftBodySize = 10' src/utils/usPlaneSimulatorPdfRenderer.ts \
  || { echo "ERROR: falta tipografía ampliada columna izq. Aborto."; exit 1; }
grep -q 'leftSectionGap = 7' src/utils/usPlaneSimulatorPdfRenderer.ts \
  || { echo "ERROR: falta mayor espacio entre secciones. Aborto."; exit 1; }
grep -q 'SuiteImageAnnotationLayer' src/components/UltrasoundPlaneSimulatorModule.tsx \
  || { echo "ERROR: faltan flechas tipo suite. Aborto."; exit 1; }
grep -q 'drawSuiteImageAnnotationsOnPdf' src/utils/usPlaneSimulatorPdfRenderer.ts \
  || { echo "ERROR: PDF sin flechas suite. Aborto."; exit 1; }

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
if gcloud secrets describe openai-api-key >/dev/null 2>&1; then
  SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
fi

echo ">>> Desplegando $SERVICE ($REGION) — Bridge Pack aesthetic..."
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --update-secrets="$SECRETS"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)"
echo ">>> Listo. URL Cloud Run: ${URL:-ver consola}"
echo ">>> Hard-refresh → Bridge: genera plano y verás texto izq + US→3D der (estilo Pack)."
