#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Pack PDF paciente (formal + explicación, sin recomendaciones)
cd ~/rad-ai-expert-deploy 2>/dev/null || cd ~/RAD-AIEXPERT || exit 1
git fetch origin && git checkout cursor/patient-pack-pdf-0681 && git pull origin cursor/patient-pack-pdf-0681
gcloud run deploy rad-ai-expert --source . --region us-central1
