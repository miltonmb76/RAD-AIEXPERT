#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL (una línea a la vez si se cae)
# Suite PDF: panel único más pequeño + ficha sin desbordar
set -euo pipefail
cd "${HOME}/rad-ai-expert-deploy" 2>/dev/null || cd "${HOME}/RAD-AIEXPERT"
git fetch origin
git checkout cursor/clinical-polish-0681
git pull origin cursor/clinical-polish-0681
rg -n "computeSuitePanelLayout" src/utils/pdfAnnexChrome.ts src/utils/muscleTendon3dPdfRenderer.ts | head -10
gcloud run deploy rad-ai-expert --source . --region us-central1
