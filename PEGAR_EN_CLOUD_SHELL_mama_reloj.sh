#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — fix reloj mama 3D (eje 10 derecho ≠ eje 2)
set -euo pipefail

if [ -f package.json ] && [ -d src ]; then
  ROOT="$PWD"
elif [ -d "$HOME/rad-ai-expert-deploy" ]; then
  ROOT="$HOME/rad-ai-expert-deploy"
elif [ -d "$HOME/RAD-AIEXPERT" ]; then
  ROOT="$HOME/RAD-AIEXPERT"
else
  echo "ERROR: cd al repo y vuelve a pegar."
  exit 1
fi

cd "$ROOT"
echo "==> Repo: $ROOT"

git fetch origin
git checkout cursor/clinical-polish-0681
git pull origin cursor/clinical-polish-0681

echo ""
echo "==> Verificando pin de reloj mama (10≠2)..."
rg -n "buildBreastLesionClockPin|lockBreastClockSiteLabel|right-breast 10 placed at 2|generate-3d-breast" \
  server_atlas3d.ts src/components/Breast3DModule.tsx | head -40

rg -n "Mama Der: forzar eje 10|LESION CLOCK PIN" \
  server_atlas3d.ts src/components/Breast3DModule.tsx | head -20

echo ""
echo "==> Rebuild / restart según tu flujo habitual (npm/bun + pm2/docker)."
echo "OK mama reloj."
