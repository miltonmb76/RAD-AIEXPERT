#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — pack PDF + Explicación paciente (ChatGPT opcional)
# Infografía sigue en Gemini. Si existe el secreto openai-api-key, se monta
# para la explicación del paciente; si no, la app usa solo Gemini.
set -euo pipefail
cd ~/rad-ai-expert-deploy 2>/dev/null || cd ~/RAD-AIEXPERT || exit 1
git fetch origin && git checkout cursor/patient-pack-pdf-0681 && git pull origin cursor/patient-pack-pdf-0681

SERVICE="${CLOUD_RUN_SERVICE:-rad-ai-expert}"
REGION="${CLOUD_RUN_REGION:-us-central1}"

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
if gcloud secrets describe openai-api-key >/dev/null 2>&1; then
  SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
  echo ">>> Usando secreto openai-api-key para Explicación paciente (ChatGPT)."
else
  echo ">>> Sin secreto openai-api-key: Explicación paciente usará Gemini."
fi

echo ">>> Desplegando $SERVICE ($REGION)..."
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --update-secrets="$SECRETS"
