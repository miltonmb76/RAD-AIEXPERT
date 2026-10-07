#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Infografía Paciente con ChatGPT (OpenAI) + pack PDF
# 1) Primero guarda/actualiza la Secret Key de OpenAI (se pide en silencioso; no la pegues en el chat):
#    read -s OPENAI_KEY
#    printf %s "$OPENAI_KEY" | gcloud secrets create openai-api-key --data-file=- 2>/dev/null \
#      || printf %s "$OPENAI_KEY" | gcloud secrets versions add openai-api-key --data-file=-
#    unset OPENAI_KEY
# 2) Luego despliega:

set -euo pipefail
cd ~/rad-ai-expert-deploy 2>/dev/null || cd ~/RAD-AIEXPERT || exit 1
git fetch origin && git checkout cursor/patient-pack-pdf-0681 && git pull origin cursor/patient-pack-pdf-0681

# Si el servicio ya existe, actualiza secretos + código. Ajusta el nombre si el tuyo es distinto.
SERVICE="${CLOUD_RUN_SERVICE:-rad-ai-expert}"
REGION="${CLOUD_RUN_REGION:-us-central1}"

echo ">>> Desplegando $SERVICE ($REGION) con OPENAI_API_KEY + GEMINI_API_KEY..."
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --update-secrets=GEMINI_API_KEY=gemini-api-key:latest,OPENAI_API_KEY=openai-api-key:latest
