#!/bin/bash
# Deploy: corte eco-anatomía usa ancla diagnóstica como lesión focal
set +e
REPO_URL="https://github.com/miltonmb76/RAD-AIEXPERT.git"
BRANCH="cursor/eco-anatomy-anchor-focal-0681"
SERVICE="rad-ai-expert"
REGION="us-central1"
LOG="${HOME}/deploy_eco_anatomy_anchor.log"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }
log "=== INICIO deploy eco-anatomy ancla → lesion focal ==="

if [ -d "${HOME}/rad-ai-expert-deploy/.git" ]; then cd "${HOME}/rad-ai-expert-deploy" || exit 1
elif [ -d "${HOME}/RAD-AIEXPERT/.git" ]; then cd "${HOME}/RAD-AIEXPERT" || exit 1
elif [ -d "${HOME}/rad-ai-expert/.git" ]; then cd "${HOME}/rad-ai-expert" || exit 1
else git clone "$REPO_URL" "${HOME}/rad-ai-expert-deploy"; cd "${HOME}/rad-ai-expert-deploy" || exit 1; fi

git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"
log "Commit: $(git rev-parse --short HEAD)"

grep -q 'diagnosisAnchor' src/lib/usPlaneBridge.ts \
  || { log "ERROR: falta diagnosisAnchor en suggestLesionTarget"; exit 1; }
grep -q 'diagnosisAnchor={diagnosisAnchor}' src/App.tsx \
  || { log "ERROR: falta prop diagnosisAnchor en UltrasoundPlaneSimulatorModule"; exit 1; }
grep -q 'ancla diagnóstica' src/components/UltrasoundPlaneSimulatorModule.tsx \
  || { log "ERROR: falta wiring ancla en modulo"; exit 1; }
log "OK: eco-anatomia toma ancla como lesion focal"

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
gcloud secrets describe openai-api-key >/dev/null 2>&1 && SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"

log "Deploy Cloud Run..."
gcloud run deploy "$SERVICE" --source . --region "$REGION" --update-secrets="$SECRETS" >>"$LOG" 2>&1
if [ $? -ne 0 ]; then log "ERROR deploy"; tail -40 "$LOG"; exit 1; fi
URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null)
log "FIN OK. URL: $URL"
log "Hard-refresh → Bridge: campo lesion = ancla; generar corte centrado en el ancla."
exit 0
