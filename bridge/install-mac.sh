#!/usr/bin/env bash
# Instala el puente local Samsung V7 en macOS (Sequoia / iMac)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"

echo "==> Instalando puente RAD-AIEXPERT Samsung V7..."

if ! command -v python3 >/dev/null 2>&1; then
  echo "Error: python3 no está instalado. Instálalo con Xcode Command Line Tools: xcode-select --install"
  exit 1
fi

python3 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"
pip install --upgrade pip
pip install -r "$SCRIPT_DIR/requirements.txt"

cat <<EOF

✅ Puente instalado.

Arranque automático al encender el iMac (recomendado, una sola vez):

  bash "$SCRIPT_DIR/install-autostart-mac.sh"

O manualmente cada día (dejar esta terminal abierta):

  cd "$SCRIPT_DIR"
  source .venv/bin/activate
  python3 samsung_bridge.py

Luego abre RAD-AIEXPERT en el navegador de este mismo iMac.

Configuración única del Samsung V7 (Utility → Connectivity → DICOM):

  1) Servidor MWL (Worklist)
     - AE Title : MWL_SERVER
     - IP       : IP de este iMac (Ajustes → Red → Wi-Fi)
     - Puerto   : 1040

  2) Servidor Storage (PACS / envío de imágenes)
     - AE Title : RAD_BRIDGE
     - IP       : misma IP del iMac
     - Puerto   : 11113
     - (Horos usa 11112 en Mac; el puente usa 11113 para no chocar.)
     - Activar envío automático al finalizar estudio (si está disponible)

EOF
