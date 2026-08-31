# RAD AI Expert

Asistente radiológico local para redactar informes, analizar imágenes, gestionar
estudios y generar anexos clínicos con Gemini.

## Requisitos

- Node.js 20 o posterior
- Una clave de Google Gemini
- Navegador Chrome, Edge o Firefox actualizado

## Instalación en una computadora

```bash
git clone https://github.com/miltonmb76/RAD-AIEXPERT.git
cd RAD-AIEXPERT
npm ci
```

Duplica `.env.example` como `.env` y añade tu clave:

```env
GEMINI_API_KEY=tu_clave_de_google_ai_studio
APP_URL=http://localhost:3000
```

Inicia la aplicación:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). El servidor escucha en la
red local, por lo que también puede abrirse desde otro dispositivo usando
`http://IP_DE_TU_COMPUTADORA:3000`.

## Ejecución de producción

```bash
npm run build
npm start
```

## Módulos

La aplicación incluye redacción y evaluación de informes, dictado, análisis de
imágenes, DICOM/ZIP, bibliografía, clasificaciones, asistente de medidas,
patología, atlas y hallazgos 3D, hemodinámica vascular, dinámica
próstata-vías urinarias, elastografía QUS, radar biomecánico, generación de PDF,
lista de trabajo y almacenamiento local/nube.

Las funciones de IA requieren `GEMINI_API_KEY`. El trabajo local y el historial
usan IndexedDB aun si Firebase no está disponible. Para sincronización entre
dispositivos, configura tu proyecto de Firebase desde la sección de
configuración de la aplicación y habilita Authentication y Firestore.

Para Google Drive/Gmail, habilita Google como proveedor de Authentication y
agrega `localhost` a los dominios autorizados de Firebase. Los permisos de
Google se solicitan al iniciar sesión.

## Publicación personal en Google Cloud

Para acceder desde varias computadoras sin exponer la aplicación al público,
consulta la guía de [Cloud Run protegido con IAP](docs/DEPLOY_GOOGLE_CLOUD.md).
El acceso queda limitado a la cuenta Google autorizada y los secretos no se
incluyen en la imagen ni en GitHub.

## Comprobaciones

```bash
npm run lint
npm run build
```

Esta herramienta asiste al profesional; no sustituye la revisión ni el juicio
clínico.
