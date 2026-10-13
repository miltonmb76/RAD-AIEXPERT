#!/bin/bash
# Deploy: Pack sin factores repetidos (no rellenar a 6 con paráfrasis)
set +e
REPO_URL="https://github.com/miltonmb76/RAD-AIEXPERT.git"
BRANCH="cursor/pack-factors-dedupe-0681"
SERVICE="rad-ai-expert"
REGION="us-central1"
LOG="${HOME}/deploy_pack_factors_dedupe.log"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }
log "=== INICIO deploy pack factors dedupe ==="

if [ -d "${HOME}/rad-ai-expert-deploy/.git" ]; then cd "${HOME}/rad-ai-expert-deploy" || exit 1
elif [ -d "${HOME}/RAD-AIEXPERT/.git" ]; then cd "${HOME}/RAD-AIEXPERT" || exit 1
elif [ -d "${HOME}/rad-ai-expert/.git" ]; then cd "${HOME}/rad-ai-expert" || exit 1
else git clone "$REPO_URL" "${HOME}/rad-ai-expert-deploy"; cd "${HOME}/rad-ai-expert-deploy" || exit 1; fi

git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"
log "Commit: $(git rev-parse --short HEAD)"

grep -q 'factorsAreNearDuplicate' src/lib/diagnosticPack.ts \
  || { log "ERROR: falta factorsAreNearDuplicate"; exit 1; }
grep -q 'findingsNodesNearDuplicate' src/lib/findingsInfographic.ts \
  || { log "ERROR: falta dedupe en infografía"; exit 1; }
log "OK: dedupe de factores presente"

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
gcloud secrets describe openai-api-key >/dev/null 2>&1 && SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"

log "Deploy Cloud Run..."
gcloud run deploy "$SERVICE" --source . --region "$REGION" --update-secrets="$SECRETS" >>"$LOG" 2>&1
if [ $? -ne 0 ]; then log "ERROR deploy"; tail -40 "$LOG"; exit 1; fi
URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null)
log "FIN OK. URL: $URL"
log "Hard-refresh → Pack: factores únicos; si hay <6 distintos, se dejan sin repetir."
exit 0
