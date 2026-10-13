#!/bin/bash
# Deploy: Pack PDF — margen bajo running header + wrap del diagnóstico largo
set +e
REPO_URL="https://github.com/miltonmb76/RAD-AIEXPERT.git"
BRANCH="cursor/pack-header-diagnosis-wrap-0681"
SERVICE="rad-ai-expert"
REGION="us-central1"
LOG="${HOME}/deploy_pack_header_wrap.log"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }
log "=== INICIO deploy pack header/diagnosis wrap ==="

if [ -d "${HOME}/rad-ai-expert-deploy/.git" ]; then cd "${HOME}/rad-ai-expert-deploy" || exit 1
elif [ -d "${HOME}/RAD-AIEXPERT/.git" ]; then cd "${HOME}/RAD-AIEXPERT" || exit 1
elif [ -d "${HOME}/rad-ai-expert/.git" ]; then cd "${HOME}/rad-ai-expert" || exit 1
else git clone "$REPO_URL" "${HOME}/rad-ai-expert-deploy"; cd "${HOME}/rad-ai-expert-deploy" || exit 1; fi

git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"
log "Commit: $(git rev-parse --short HEAD)"

grep -q 'Clear of global running header' src/utils/diagnosticPackPdfRenderer.ts \
  || { log "ERROR: falta clearance running header"; exit 1; }
grep -q 'splitTextToSize(dx, contentWidth)' src/utils/diagnosticPackPdfRenderer.ts \
  || { log "ERROR: falta wrap diagnostico"; exit 1; }
grep -q 'break-words' src/components/DiagnosticPackModule.tsx \
  || { log "ERROR: falta break-words en preview"; exit 1; }
log "OK: fix pack header/diagnosis presente"

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
gcloud secrets describe openai-api-key >/dev/null 2>&1 && SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"

log "Deploy Cloud Run..."
gcloud run deploy "$SERVICE" --source . --region "$REGION" --update-secrets="$SECRETS" >>"$LOG" 2>&1
if [ $? -ne 0 ]; then log "ERROR deploy"; tail -40 "$LOG"; exit 1; fi
URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null)
log "FIN OK. URL: $URL"
log "Hard-refresh → Pack PDF: sin choque con linea superior; diagnostico largo hace wrap."
exit 0
