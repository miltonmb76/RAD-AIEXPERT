#!/usr/bin/env bash
# Registra el puente Samsung V7 para iniciar solo al encender sesión en el iMac
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LABEL="com.radaiexpert.samsung-bridge"
PLIST_DEST="$HOME/Library/LaunchAgents/${LABEL}.plist"
START_SCRIPT="$SCRIPT_DIR/start-bridge.sh"
LOG_DIR="$HOME/RAD-AIEXPERT-Bridge/logs"

usage() {
  cat <<EOF
Uso: bash install-autostart-mac.sh [--uninstall|--status]

  (sin flags)  Instala arranque automático al iniciar sesión en macOS
  --uninstall  Desactiva y elimina el agente
  --status     Muestra si el puente está registrado y corriendo
EOF
}

uninstall() {
  if launchctl list 2>/dev/null | grep -q "$LABEL"; then
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || launchctl unload "$PLIST_DEST" 2>/dev/null || true
  fi
  rm -f "$PLIST_DEST"
  echo "✅ Arranque automático desactivado."
}

status() {
  echo "Plist: $PLIST_DEST"
  if [[ -f "$PLIST_DEST" ]]; then
    echo "Instalado: sí"
  else
    echo "Instalado: no"
  fi
  if launchctl list 2>/dev/null | grep "$LABEL"; then
    echo "Estado launchd: registrado (ver 'launchctl list | grep radaiexpert')"
  else
    echo "Estado launchd: no activo"
  fi
  if curl -sf "http://127.0.0.1:8787/api/health" >/dev/null 2>&1; then
    echo "Puente HTTP: EN LÍNEA (8787)"
  else
    echo "Puente HTTP: no responde en 8787"
  fi
  echo "Log: $LOG_DIR/bridge.log"
}

if [[ "${1:-}" == "--uninstall" ]]; then
  uninstall
  exit 0
fi

if [[ "${1:-}" == "--status" ]]; then
  status
  exit 0
fi

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ ! -x "$SCRIPT_DIR/.venv/bin/python3" ]]; then
  echo "Error: ejecuta primero bash install-mac.sh en esta carpeta."
  exit 1
fi

chmod +x "$START_SCRIPT"
mkdir -p "$LOG_DIR"

cat > "$PLIST_DEST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${START_SCRIPT}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/launchd.out.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/launchd.err.log</string>
  <key>WorkingDirectory</key>
  <string>${SCRIPT_DIR}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
  </dict>
</dict>
</plist>
EOF

# macOS Ventura+ / Sequoia
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_DEST"
launchctl enable "gui/$(id -u)/$LABEL"
launchctl kickstart -k "gui/$(id -u)/$LABEL"

sleep 2

cat <<EOF

✅ Puente configurado para arrancar solo al iniciar sesión en el iMac.

  • Se inicia al encender el Mac e iniciar sesión (no hace falta abrir Terminal).
  • Si el proceso falla, macOS lo reinicia automáticamente.
  • Log del puente: ${LOG_DIR}/bridge.log

Comprobar estado:
  bash install-autostart-mac.sh --status

Desactivar:
  bash install-autostart-mac.sh --uninstall

Abre la app en el iMac; en Lista de trabajo debe decir Puente Samsung V7 → EN LÍNEA.

EOF

if curl -sf "http://127.0.0.1:8787/api/health" >/dev/null 2>&1; then
  echo "Comprobación: puente respondiendo en http://127.0.0.1:8787 ✅"
else
  echo "Aviso: el puente aún no responde — revisa ${LOG_DIR}/bridge.log en unos segundos."
fi
