#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Infografía Paciente (Gemini) + pack PDF
set -euo pipefail
cd ~/rad-ai-expert-deploy 2>/dev/null || cd ~/RAD-AIEXPERT || exit 1
git fetch origin && git checkout cursor/patient-pack-pdf-0681 && git pull origin cursor/patient-pack-pdf-0681

SERVICE="${CLOUD_RUN_SERVICE:-rad-ai-expert}"
REGION="${CLOUD_RUN_REGION:-us-central1}"

echo ">>> Desplegando $SERVICE ($REGION) con GEMINI_API_KEY (infografía Gemini)..."
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --update-secrets=GEMINI_API_KEY=gemini-api-key:latest
