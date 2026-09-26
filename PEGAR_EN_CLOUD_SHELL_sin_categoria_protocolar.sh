#!/usr/bin/env bash
# =============================================================================
# PEGAR EN CLOUD SHELL (comando por comando si se cae)
# Quitar "Categoría / impresión protocolar" del informe
# branch: cursor/clinical-polish-0681
# =============================================================================
set -euo pipefail
ROOT="${HOME}/rad-ai-expert-deploy"
[ -d "$ROOT" ] || ROOT="${HOME}/RAD-AIEXPERT"
cd "$ROOT"
git fetch origin
git checkout cursor/clinical-polish-0681
git pull origin cursor/clinical-polish-0681
rg -n "stripProtocolCategoryImpressionLines|Do NOT weave" src/lib/reportEnrichment.ts | head -10
gcloud run deploy rad-ai-expert --source . --region us-central1
