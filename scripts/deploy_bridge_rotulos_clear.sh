#!/bin/bash
# Deploy: PDF respeta rótulos borrados en Bridge eco-anatomía
set +e
REPO_URL="https://github.com/miltonmb76/RAD-AIEXPERT.git"
BRANCH="cursor/bridge-rotulos-respect-clear-0681"
SERVICE="rad-ai-expert"
REGION="us-central1"
LOG="${HOME}/deploy_bridge_rotulos_clear.log"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }
log "=== INICIO deploy bridge rotulos respect clear ==="

if [ -d "${HOME}/rad-ai-expert-deploy/.git" ]; then cd "${HOME}/rad-ai-expert-deploy" || exit 1
elif [ -d "${HOME}/RAD-AIEXPERT/.git" ]; then cd "${HOME}/RAD-AIEXPERT" || exit 1
elif [ -d "${HOME}/rad-ai-expert/.git" ]; then cd "${HOME}/rad-ai-expert" || exit 1
else git clone "$REPO_URL" "${HOME}/rad-ai-expert-deploy"; cd "${HOME}/rad-ai-expert-deploy" || exit 1; fi

git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"
log "Commit: $(git rev-parse --short HEAD)"

grep -q 'Respect explicit empty array' src/utils/usPlaneSimulatorPdfRenderer.ts \
  || { log "ERROR: falta fix PDF empty annotations"; exit 1; }
grep -q 'Array.isArray(planeData?.imageAnnotations)' src/components/UltrasoundPlaneSimulatorModule.tsx \
  || { log "ERROR: falta Array.isArray en modulo"; exit 1; }
log "OK: PDF respeta rotulos borrados"

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
gcloud secrets describe openai-api-key >/dev/null 2>&1 && SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"

log "Deploy Cloud Run..."
gcloud run deploy "$SERVICE" --source . --region "$REGION" --update-secrets="$SECRETS" >>"$LOG" 2>&1
if [ $? -ne 0 ]; then log "ERROR deploy"; tail -40 "$LOG"; exit 1; fi
URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null)
log "FIN OK. URL: $URL"
log "Hard-refresh → quita rotulos en Bridge → PDF sin rotulos."
exit 0
