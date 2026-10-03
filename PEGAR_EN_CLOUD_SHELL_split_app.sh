#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — App.tsx partido (helpers + worklist + lazy modules)
cd ~/rad-ai-expert-deploy 2>/dev/null || cd ~/RAD-AIEXPERT || exit 1
git fetch origin && git checkout cursor/split-app-tsx-0681 && git pull origin cursor/split-app-tsx-0681
gcloud run deploy rad-ai-expert --source . --region us-central1
