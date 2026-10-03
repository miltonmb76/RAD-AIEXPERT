#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — shell compartido (todas las suites 3D + vascular)
cd ~/rad-ai-expert-deploy 2>/dev/null || cd ~/RAD-AIEXPERT || exit 1
git fetch origin && git checkout cursor/organ-suite-shell-0681 && git pull origin cursor/organ-suite-shell-0681
gcloud run deploy rad-ai-expert --source . --region us-central1
