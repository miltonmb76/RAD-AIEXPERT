#!/bin/bash
set +e
BRANCH="cursor/patient-infographic-before-signature-0681"
SERVICE="rad-ai-expert"
REGION="us-central1"
LOG="${HOME}/deploy_patient_infographic_sig.log"
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }
log "=== INICIO ==="
if [ -d "${HOME}/rad-ai-expert-deploy/.git" ]; then cd "${HOME}/rad-ai-expert-deploy"
elif [ -d "${HOME}/RAD-AIEXPERT/.git" ]; then cd "${HOME}/RAD-AIEXPERT"
elif [ -d "${HOME}/rad-ai-expert/.git" ]; then cd "${HOME}/rad-ai-expert"
else git clone https://github.com/miltonmb76/RAD-AIEXPERT.git "${HOME}/rad-ai-expert-deploy"; cd "${HOME}/rad-ai-expert-deploy"; fi
git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"
grep -q 'placedPatientInfographic' src/lib/patientSummaryPdf.ts || { log "ERROR: falta fix"; exit 1; }
SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
gcloud secrets describe openai-api-key >/dev/null 2>&1 && SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
log "Deploy..."
gcloud run deploy "$SERVICE" --source . --region "$REGION" --update-secrets="$SECRETS" >>"$LOG" 2>&1
log "FIN codigo $?"
