#!/usr/bin/env bash
# Ficha lesión dominante — PDF apretado (márgenes, cover crop, sin overflow)
set -euo pipefail
DIR="${HOME}/RAD-AIEXPERT"
if [ ! -d "$DIR/.git" ]; then
  DIR="${HOME}/rad-aiexpert"
fi
if [ ! -d "$DIR/.git" ]; then
  git clone https://github.com/miltonmb76/RAD-AIEXPERT.git "${HOME}/RAD-AIEXPERT"
  DIR="${HOME}/RAD-AIEXPERT"
fi
cd "$DIR"
echo ">>> Repo: $DIR"
# Mata servidor viejo que pueda servir JS cacheado
pkill -f "node server.cjs" 2>/dev/null || true
pkill -f "tsx server.ts" 2>/dev/null || true
git fetch origin cursor/dominant-card-pdf-tight-0681
git checkout -B cursor/dominant-card-pdf-tight-0681 origin/cursor/dominant-card-pdf-tight-0681
git reset --hard origin/cursor/dominant-card-pdf-tight-0681
echo ">>> Commit desplegado:"
git log -1 --oneline
# Verificación: debe existir cover-crop (rama nueva). Si falla, NO es esta rama.
grep -q "coverCropDataUrl" src/utils/dominantLesionCardPdfRenderer.ts \
  || { echo "ERROR: no está el fix PDF-tight. Aborto."; exit 1; }
grep -q "let y = 22" src/utils/dominantLesionCardPdfRenderer.ts \
  || { echo "ERROR: masthead no arranca en y=22. Aborto."; exit 1; }
rm -rf dist server.cjs server.cjs.map
npm install
npm run build
npm start
