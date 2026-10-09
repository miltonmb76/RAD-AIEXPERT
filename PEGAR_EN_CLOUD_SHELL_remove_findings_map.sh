#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Quitar mapa de hallazgos (deja ficha de lesión dominante)
set -euo pipefail

if [ -d "$HOME/rad-ai-expert-deploy/.git" ]; then
  cd "$HOME/rad-ai-expert-deploy"
elif [ -d "$HOME/RAD-AIEXPERT/.git" ]; then
  cd "$HOME/RAD-AIEXPERT"
elif [ -d "$HOME/rad-ai-expert/.git" ]; then
  cd "$HOME/rad-ai-expert"
else
  echo "ERROR: no encuentro el repo"
  exit 1
fi

echo ">>> Repo: $(pwd)"
git fetch origin
git checkout cursor/remove-findings-map-0681
git pull --ff-only origin cursor/remove-findings-map-0681
echo ">>> Rama: $(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short HEAD)"

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
if gcloud secrets describe openai-api-key >/dev/null 2>&1; then
  SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
fi

gcloud run deploy rad-ai-expert \
  --source . \
  --region us-central1 \
  --update-secrets="$SECRETS"

echo ">>> Listo. Mapa de hallazgos eliminado; ficha de lesión dominante sigue disponible."
