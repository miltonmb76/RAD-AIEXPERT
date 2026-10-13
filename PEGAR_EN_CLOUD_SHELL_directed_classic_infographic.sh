#!/usr/bin/env bash
# PEGAR EN CLOUD SHELL — Infografía clásica dirigida (coexiste con la general)
# Si la consola "se sale": al final queda pausa + log en ~/deploy_dirigida.log
set -eo pipefail

REPO_URL="${REPO_URL:-https://github.com/miltonmb76/RAD-AIEXPERT.git}"
BRANCH="${BRANCH:-cursor/directed-classic-infographic-0681}"
SERVICE="${CLOUD_RUN_SERVICE:-rad-ai-expert}"
REGION="${CLOUD_RUN_REGION:-us-central1}"
LOG="${HOME}/deploy_dirigida.log"

finish() {
  local code=$?
  echo ""
  echo "=========================================="
  if [ "$code" -eq 0 ]; then
    echo ">>> FIN OK (codigo 0). Log: $LOG"
  else
    echo ">>> FIN CON ERROR (codigo $code). Log: $LOG"
    echo ">>> Copia las ultimas lineas del log si pides ayuda."
  fi
  echo "=========================================="
  # Evita que Cloud Shell parezca "cerrarse" sin ver el mensaje
  read -r -p "Pulsa ENTER para terminar..." _ || true
  exit "$code"
}
trap finish EXIT

exec > >(tee -a "$LOG") 2>&1
echo ">>> Log: $LOG"
echo ">>> Inicio: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [ -d "$HOME/rad-ai-expert-deploy/.git" ]; then
  cd "$HOME/rad-ai-expert-deploy"
elif [ -d "$HOME/RAD-AIEXPERT/.git" ]; then
  cd "$HOME/RAD-AIEXPERT"
elif [ -d "$HOME/rad-ai-expert/.git" ]; then
  cd "$HOME/rad-ai-expert"
else
  echo ">>> No hay clon local. Clonando en ~/rad-ai-expert-deploy ..."
  git clone "$REPO_URL" "$HOME/rad-ai-expert-deploy"
  cd "$HOME/rad-ai-expert-deploy"
fi

echo ">>> Repo: $(pwd)"
echo ">>> git fetch origin (puede tardar)..."
if ! git fetch origin "$BRANCH" 2>&1; then
  echo ">>> fetch de rama fallo; intento fetch completo..."
  git fetch origin
fi

if ! git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  echo "ERROR: no existe origin/$BRANCH en el remoto."
  echo "       Verifica red/GitHub o espera unos minutos y repite."
  exit 1
fi

git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"
echo ">>> Rama: $(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short HEAD)"

if ! grep -q 'handleGenerateDirectedInfographic' src/App.tsx; then
  echo "ERROR: este checkout NO tiene infografia dirigida (App.tsx)."
  echo "       Deberias estar en $BRANCH @ origin."
  exit 1
fi
echo ">>> OK: handleGenerateDirectedInfographic presente"

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
if gcloud secrets describe openai-api-key >/dev/null 2>&1; then
  SECRETS="${SECRETS},OPENAI_API_KEY=openai-api-key:latest"
fi

echo ">>> Desplegando $SERVICE ($REGION) — puede tardar 10-20 min, NO cierres la pestaña..."
echo ">>> (Si se corta, vuelve a abrir Cloud Shell y ejecuta: tail -f $LOG)"
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --update-secrets="$SECRETS"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)"
echo ">>> Listo. URL Cloud Run: ${URL:-ver consola}"
echo ">>> Hard-refresh → informe generado → bloque fucsia «Infografia dirigida (hallazgo)» arriba del texto."
