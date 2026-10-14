#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Conservar informe tras pantalla azul (correo / guardar estudio)
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/miltonmb76/RAD-AIEXPERT.git}"
BRANCH="${BRANCH:-cursor/email-crash-keep-report-0681}"
SERVICE="${CLOUD_RUN_SERVICE:-rad-ai-expert}"
REGION="${CLOUD_RUN_REGION:-us-central1}"

if [ -d "$HOME/rad-ai-expert-deploy/.git" ]; then
  cd "$HOME/rad-ai-expert-deploy"
elif [ -d "$HOME/RAD-AIEXPERT/.git" ]; then
  cd "$HOME/RAD-AIEXPERT"
elif [ -d "$HOME/rad-ai-expert/.git" ]; then
  cd "$HOME/rad-ai-expert"
else
  echo ">>> No hay clon local. Clonando en ~/rad-ai-expert-deploy ..."
  git clone "$REPO_URL" "$HOME/rad-ai-expert-deploy"
  cd "$HOME/rad-ai-expert-deploy"
fi

echo ">>> Repo: $(pwd)"
git fetch origin
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"
echo ">>> Rama: $(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short HEAD)"

grep -q 'ACTIVE_SESSION_DRAFT_KEY' src/lib/activeSessionDraft.ts \
  || { echo "ERROR: falta activeSessionDraft. Aborto."; exit 1; }
grep -q 'rememberActiveSessionDraft' src/App.tsx \
  || { echo "ERROR: falta rememberActiveSessionDraft en App. Aborto."; exit 1; }
grep -q 'flushActiveSessionDraftNow' src/lib/cloudStudyActions.ts \
  || { echo "ERROR: falta flush al guardar estudio. Aborto."; exit 1; }
grep -q 'Reintentar y recuperar informe' src/components/AppErrorBoundary.tsx \
  || { echo "ERROR: falta botón de recuperación con informe. Aborto."; exit 1; }

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
if gcloud secrets describe openai-api-key >/dev/null 2>&1; then
  SECRETS="$SECRETS,OPENAI_API_KEY=openai-api-key:latest"
fi

gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-secrets="$SECRETS" \
  --memory=2Gi \
  --cpu=2 \
  --timeout=300

echo ">>> OK: borrador de sesión anti-pantalla-azul desplegado."
