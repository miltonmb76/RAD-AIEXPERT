#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Pulido respeta US vías urinarias (sin hígado/bazo)
set -eo pipefail
REPO_URL="https://github.com/miltonmb76/RAD-AIEXPERT.git"
BRANCH="cursor/vias-urinarias-scope-0681"
SERVICE="rad-ai-expert"
REGION="us-central1"
LOG="${HOME}/deploy_vias_urinarias_scope.log"

echo "=== INICIO $(date -u +%Y-%m-%dT%H:%M:%SZ) ===" | tee -a "$LOG"
if [ -d "$HOME/rad-ai-expert-deploy/.git" ]; then cd "$HOME/rad-ai-expert-deploy"
elif [ -d "$HOME/RAD-AIEXPERT/.git" ]; then cd "$HOME/RAD-AIEXPERT"
elif [ -d "$HOME/rad-ai-expert/.git" ]; then cd "$HOME/rad-ai-expert"
else git clone "$REPO_URL" "$HOME/rad-ai-expert-deploy"; cd "$HOME/rad-ai-expert-deploy"; fi

git fetch origin "$BRANCH" | tee -a "$LOG"
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"
grep -q 'shouldEnforceRenalViasProtocol' src/lib/measurementStudyGuard.ts || { echo "ERROR: falta fix"; exit 1; }
grep -q 'ULTRASONIDO DE VÍAS URINARIAS' server.ts || { echo "ERROR: falta protocolo vias"; exit 1; }

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
gcloud secrets describe openai-api-key >/dev/null 2>&1 && SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
gcloud run deploy "$SERVICE" --source . --region "$REGION" --update-secrets="$SECRETS" 2>&1 | tee -a "$LOG"
echo ">>> FIN. Hard-refresh → Vias urinarias + pulido: sin Higado/Bazo inventados." | tee -a "$LOG"
