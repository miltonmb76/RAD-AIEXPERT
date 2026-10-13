#!/bin/bash
# Deploy infografia dirigida — pensado para Cloud Shell + nohup
# Uso: bash ~/deploy_dirigida_cloud.sh
#      o: nohup bash ~/deploy_dirigida_cloud.sh > ~/deploy_dirigida.log 2>&1 &

set +e
REPO_URL="https://github.com/miltonmb76/RAD-AIEXPERT.git"
BRANCH="cursor/directed-classic-infographic-0681"
SERVICE="rad-ai-expert"
REGION="us-central1"
LOG="${HOME}/deploy_dirigida.log"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

log "=== INICIO deploy dirigida ==="

if [ -d "${HOME}/rad-ai-expert-deploy/.git" ]; then
  cd "${HOME}/rad-ai-expert-deploy" || exit 1
elif [ -d "${HOME}/RAD-AIEXPERT/.git" ]; then
  cd "${HOME}/RAD-AIEXPERT" || exit 1
elif [ -d "${HOME}/rad-ai-expert/.git" ]; then
  cd "${HOME}/rad-ai-expert" || exit 1
else
  log "Clonando repo..."
  git clone "$REPO_URL" "${HOME}/rad-ai-expert-deploy"
  cd "${HOME}/rad-ai-expert-deploy" || exit 1
fi

log "Repo: $(pwd)"
git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"
log "Commit: $(git rev-parse --short HEAD)"

if ! grep -q handleGenerateDirectedInfographic src/App.tsx; then
  log "ERROR: falta codigo dirigida"
  exit 1
fi
log "OK: codigo dirigida presente"

log "Build..."
npm run build >>"$LOG" 2>&1
if [ $? -ne 0 ]; then
  log "ERROR: npm run build fallo. Ver $LOG"
  exit 1
fi
log "OK: build"

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
if gcloud secrets describe openai-api-key >/dev/null 2>&1; then
  SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
fi

log "Deploy Cloud Run (puede tardar 10-20 min)..."
gcloud run deploy "$SERVICE" --source . --region "$REGION" --update-secrets="$SECRETS" >>"$LOG" 2>&1
if [ $? -ne 0 ]; then
  log "ERROR: gcloud run deploy fallo. Ver $LOG"
  exit 1
fi

URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null)
log "FIN OK. URL: $URL"
log "Hard-refresh la app. Informe generado -> bloque fucsia Infografia dirigida."
exit 0
