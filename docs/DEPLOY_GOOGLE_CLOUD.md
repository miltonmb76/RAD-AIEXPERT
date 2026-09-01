# Despliegue personal protegido en Google Cloud

Esta guía publica RAD AI Expert en Cloud Run y restringe el acceso a una sola
cuenta de Google mediante Identity-Aware Proxy (IAP). No se necesita dominio
propio.

## Arquitectura

- Cloud Run sirve la aplicación en una URL HTTPS `run.app`.
- IAP exige iniciar sesión y bloquea todo correo no autorizado.
- Secret Manager proporciona `GEMINI_API_KEY` al servidor.
- Un proyecto Firebase propio almacena estudios y listas de trabajo.
- Firebase Authentication gestiona la autorización adicional de Gmail y Drive.

## 1. Crear un proyecto propio

En [Google Cloud Console](https://console.cloud.google.com/projectcreate), crea
un proyecto nuevo dentro de la cuenta de facturación personal. Guarda su
`PROJECT_ID`; no es el nombre visible del proyecto.

No reutilices `gen-lang-client-0578019690`: pertenece al entorno original de AI
Studio.

## 2. Añadir Firebase

1. Abre [Firebase Console](https://console.firebase.google.com/).
2. Selecciona **Añadir proyecto** y elige el proyecto Google Cloud anterior.
3. Crea una aplicación web.
4. Copia el objeto `firebaseConfig`; estos datos identifican la aplicación web,
   pero no sustituyen las reglas de seguridad.
5. Habilita **Authentication → Sign-in method → Google**.
6. Crea **Firestore Database** en modo producción y en una región cercana.
7. Despliega las reglas privadas incluidas en este repositorio:

   ```bash
   npx --yes firebase-tools@latest login
   npx --yes firebase-tools@latest deploy --only firestore:rules --project PROJECT_ID
   ```

## 3. Habilitar APIs y crear secretos

Desde Cloud Shell, selecciona el proyecto:

```bash
gcloud config set project PROJECT_ID
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iap.googleapis.com \
  gmail.googleapis.com \
  drive.googleapis.com
```

Crea el secreto Gemini sin escribir la clave en el historial:

```bash
read -s GEMINI_KEY
printf %s "$GEMINI_KEY" | gcloud secrets create gemini-api-key --data-file=-
unset GEMINI_KEY
```

Si el secreto ya existe, añade una versión:

```bash
read -s GEMINI_KEY
printf %s "$GEMINI_KEY" | gcloud secrets versions add gemini-api-key --data-file=-
unset GEMINI_KEY
```

## 4. Desplegar Cloud Run

La variable `FIREBASE_CONFIG` debe contener el objeto JSON de Firebase en una
sola línea.

```bash
gcloud run deploy rad-ai-expert \
  --source . \
  --region us-central1 \
  --no-allow-unauthenticated \
  --iap \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest \
  --set-env-vars '^@^AUTH_MODE=iap@ALLOWED_USER_EMAIL=TU_CORREO@gmail.com@FIREBASE_CONFIG={"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}' \
  --memory 2Gi \
  --cpu 1 \
  --min 1 \
  --max 2 \
  --concurrency 4 \
  --timeout 300
```

La primera ejecución puede pedir crear un repositorio de Artifact Registry y
autorizar a Cloud Build. Acepta únicamente para el proyecto nuevo.

## 5. Restringir IAP al correo personal

En **Google Cloud Console → Security → Identity-Aware Proxy**, abre el servicio
`rad-ai-expert` y concede **IAP-secured Web App User** exclusivamente al correo
personal.

Para una cuenta Gmail fuera de una organización, IAP solicitará configurar una
pantalla de consentimiento externa. Usa la opción de creación automática del
cliente OAuth cuando esté disponible y no añadas otros usuarios.

Prueba la URL en una ventana privada:

- La cuenta autorizada debe abrir la aplicación.
- Otra cuenta debe recibir acceso denegado.

## 6. Autorizar Firebase y Gmail

Cuando Cloud Run entregue la URL:

1. Añade su dominio `SERVICE-HASH-REGION.a.run.app` en
   **Firebase Authentication → Settings → Authorized domains**.
2. En **Google Auth Platform**, configura una audiencia externa limitada al
   correo personal.
3. Habilita los permisos `gmail.send` y `drive.file`.
4. Vuelve a autorizar Gmail desde la aplicación.

El flujo actual obtiene un token en el navegador. La migración posterior del
envío al servidor permitirá renovación automática y eliminará la necesidad de
autorizar de nuevo al caducar el token de acceso.

## 7. Comprobaciones

```bash
curl -I https://URL_DEL_SERVICIO/
curl https://URL_DEL_SERVICIO/api/health
```

Comprueba además:

- generación de informes;
- exportación PDF;
- inicio de sesión Google;
- guardado y recuperación de Firestore;
- envío Gmail y carga en Drive;
- rechazo de una cuenta no autorizada;
- funcionamiento desde al menos dos computadoras.

No copies archivos `.env` al contenedor ni subas claves a GitHub.

## Solución de problemas

### `Build failed` o `Building using Buildpacks`

Si el prompt termina en `~` (directorio home) y aparece `fatal: not a git
repository`, el despliegue se lanzó desde la carpeta equivocada. Cloud Run no
encuentra el `Dockerfile` y usa Buildpacks, que fallan con esta aplicación.

Antes de desplegar, entra a la carpeta del proyecto y comprueba los archivos:

```bash
cd ~/rad-ai-expert-deploy
ls -la Dockerfile package.json
```

Debes ver `Dockerfile` y `package.json`. Si la carpeta no existe, clónala:

```bash
git clone https://github.com/miltonmb76/RAD-AIEXPERT.git rad-ai-expert-deploy
cd rad-ai-expert-deploy
git checkout cursor/fix-app-modules-0681
```

Si ya existe, actualiza el código:

```bash
cd ~/rad-ai-expert-deploy
git fetch origin
git checkout cursor/fix-app-modules-0681
git pull origin cursor/fix-app-modules-0681
```

Luego vuelve a ejecutar `gcloud run deploy` **desde esa carpeta**. El mensaje
debe decir `Building Container...` (Docker), no `Building using Buildpacks`.

### `Container failed to start`

Si el build termina bien pero la revisión no arranca, revisa los logs:

```bash
gcloud run revisions describe REVISION_NAME --region=us-central1
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=rad-ai-expert" --limit=30
```

Sustituye `REVISION_NAME` por el nombre que aparece en el error (por ejemplo
`rad-ai-expert-00005-joc`).
