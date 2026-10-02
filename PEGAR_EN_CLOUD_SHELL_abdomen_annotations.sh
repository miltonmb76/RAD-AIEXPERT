#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — anotaciones editables en suites 3D + Corte Focal + Atlas + Vascular
cd ~/rad-ai-expert-deploy 2>/dev/null || cd ~/RAD-AIEXPERT || exit 1
git fetch origin && git checkout cursor/abdomen-image-annotations-0681 && git pull origin cursor/abdomen-image-annotations-0681
gcloud run deploy rad-ai-expert --source . --region us-central1
