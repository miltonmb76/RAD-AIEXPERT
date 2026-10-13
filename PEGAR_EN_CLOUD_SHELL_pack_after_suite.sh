#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Pack PDF tras suite (o tras Corte Focal si no hay suite)
set -eo pipefail
REPO_URL="https://github.com/miltonmb76/RAD-AIEXPERT.git"
BRANCH="cursor/pack-after-suite-0681"
SERVICE="rad-ai-expert"
REGION="us-central1"
LOG="${HOME}/deploy_pack_orden.log"

echo "=== INICIO $(date -u +%Y-%m-%dT%H:%M:%SZ) ===" | tee -a "$LOG"
if [ -d "$HOME/rad-ai-expert-deploy/.git" ]; then cd "$HOME/rad-ai-expert-deploy"
elif [ -d "$HOME/RAD-AIEXPERT/.git" ]; then cd "$HOME/RAD-AIEXPERT"
elif [ -d "$HOME/rad-ai-expert/.git" ]; then cd "$HOME/rad-ai-expert"
else git clone "$REPO_URL" "$HOME/rad-ai-expert-deploy"; cd "$HOME/rad-ai-expert-deploy"; fi

git fetch origin "$BRANCH" | tee -a "$LOG"
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"
grep -q 'renderDiagnosticPackAnnexHere' src/lib/nativePdfDownload.ts || { echo "ERROR: falta reorden pack"; exit 1; }

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
gcloud secrets describe openai-api-key >/dev/null 2>&1 && SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
gcloud run deploy "$SERVICE" --source . --region "$REGION" --update-secrets="$SECRETS" 2>&1 | tee -a "$LOG"
echo ">>> FIN. Hard-refresh → PDF: suite→pack→focal (o focal→pack sin suite)." | tee -a "$LOG"
