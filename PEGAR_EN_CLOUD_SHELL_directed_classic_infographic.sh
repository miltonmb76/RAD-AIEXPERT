#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — usar PASO A PASO si la consola se cierra (ver PEGAR_EN_CLOUD_SHELL_directed_PASO_A_PASO.txt)
# Este script evita heredoc, process-substitution y set -u (compatibilidad Cloud Shell)

REPO_URL="https://github.com/miltonmb76/RAD-AIEXPERT.git"
BRANCH="cursor/directed-classic-infographic-0681"
SERVICE="rad-ai-expert"
REGION="us-central1"
LOG="${HOME}/deploy_dirigida.log"

echo "=== INICIO $(date -u +%Y-%m-%dT%H:%M:%SZ) ===" | tee -a "$LOG"

if [ -d "$HOME/rad-ai-expert-deploy/.git" ]; then
  cd "$HOME/rad-ai-expert-deploy" || exit 1
elif [ -d "$HOME/RAD-AIEXPERT/.git" ]; then
  cd "$HOME/RAD-AIEXPERT" || exit 1
elif [ -d "$HOME/rad-ai-expert/.git" ]; then
  cd "$HOME/rad-ai-expert" || exit 1
else
  git clone "$REPO_URL" "$HOME/rad-ai-expert-deploy" 2>&1 | tee -a "$LOG" || exit 1
  cd "$HOME/rad-ai-expert-deploy" || exit 1
fi

echo ">>> Repo: $(pwd)" | tee -a "$LOG"
git fetch origin "$BRANCH" 2>&1 | tee -a "$LOG" || git fetch origin 2>&1 | tee -a "$LOG" || exit 1
git checkout -B "$BRANCH" "origin/$BRANCH" 2>&1 | tee -a "$LOG" || exit 1
git reset --hard "origin/$BRANCH" 2>&1 | tee -a "$LOG" || exit 1
echo ">>> Commit: $(git rev-parse --short HEAD)" | tee -a "$LOG"

if ! grep -q handleGenerateDirectedInfographic src/App.tsx; then
  echo "ERROR: falta codigo infografia dirigida en App.tsx" | tee -a "$LOG"
  exit 1
fi

echo ">>> npm run build (si falla, el deploy no sirve)..." | tee -a "$LOG"
npm run build 2>&1 | tee -a "$LOG"
BUILD_CODE="${PIPESTATUS[0]:-$?}"
if [ "$BUILD_CODE" -ne 0 ]; then
  echo "ERROR: build fallo codigo $BUILD_CODE — revisa: tail -40 $LOG" | tee -a "$LOG"
  exit "$BUILD_CODE"
fi

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
if gcloud secrets describe openai-api-key >/dev/null 2>&1; then
  SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
fi

echo ">>> gcloud run deploy (10-20 min)..." | tee -a "$LOG"
gcloud run deploy "$SERVICE" --source . --region "$REGION" --update-secrets="$SECRETS" 2>&1 | tee -a "$LOG"
DEPLOY_CODE="${PIPESTATUS[0]:-$?}"
if [ "$DEPLOY_CODE" -ne 0 ]; then
  echo "ERROR: deploy fallo codigo $DEPLOY_CODE — revisa: tail -40 $LOG" | tee -a "$LOG"
  exit "$DEPLOY_CODE"
fi

gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>&1 | tee -a "$LOG"
echo ">>> FIN OK — hard-refresh en la app" | tee -a "$LOG"
