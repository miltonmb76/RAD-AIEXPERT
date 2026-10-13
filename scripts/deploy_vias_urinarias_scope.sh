#!/bin/bash
# Deploy: pulido respeta US vías urinarias (sin hígado/bazo inventados)
# Cloud Shell + nohup. NO hace npm build local — Cloud Build lo hace.

set +e
REPO_URL="https://github.com/miltonmb76/RAD-AIEXPERT.git"
BRANCH="cursor/vias-urinarias-scope-0681"
SERVICE="rad-ai-expert"
REGION="us-central1"
LOG="${HOME}/deploy_vias_urinarias_scope.log"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

log "=== INICIO deploy vias urinarias scope ==="

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

grep -q 'shouldEnforceRenalViasProtocol' src/lib/measurementStudyGuard.ts \
  || { log "ERROR: falta shouldEnforceRenalViasProtocol"; exit 1; }
grep -q 'isExtraAbdomenOrganOutsideRenalVias' src/lib/measurementStudyGuard.ts \
  || { log "ERROR: falta filtro extra-abdomen"; exit 1; }
grep -q 'ULTRASONIDO DE VÍAS URINARIAS' server.ts \
  || { log "ERROR: falta protocolo vias en server.ts"; exit 1; }
grep -q 'studyScopePromptClause' server.ts \
  || { log "ERROR: falta studyScopePromptClause en server"; exit 1; }
log "OK: fix vias urinarias presente"

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
if gcloud secrets describe openai-api-key >/dev/null 2>&1; then
  SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
fi

log "Deploy Cloud Run (build en la nube, 10-20 min)..."
gcloud run deploy "$SERVICE" --source . --region "$REGION" --update-secrets="$SECRETS" >>"$LOG" 2>&1
if [ $? -ne 0 ]; then
  log "ERROR: gcloud run deploy fallo. Ver $LOG"
  log "Ultimas lineas:"
  tail -40 "$LOG"
  exit 1
fi

URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null)
log "FIN OK. URL: $URL"
log "Hard-refresh. Prueba: estudio Vias urinarias + pulido → NO debe meter Higado/Bazo."
exit 0
