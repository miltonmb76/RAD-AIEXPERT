# Integración automática Samsung V7 ↔ iMac (sin USB)

Flujo pensado para reporte **inmediato** con el paciente al frente: mínimos pasos, todo por red local.

## Arquitectura

```
RAD-AIEXPERT (navegador)  ←→  Puente local (iMac)  ←→  Samsung V7
     localhost:8787              DICOM MWL :1040
                                 DICOM Storage :11113
```

La app web (Cloud Run o local) habla con `http://127.0.0.1:8787` en el **mismo iMac** donde abres el navegador. El puente recibe la agenda y las capturas DICOM del ecógrafo.

## Instalación única en el iMac (Sequoia 15.5)

```bash
cd ~/rad-ai-expert-deploy
git pull
cd bridge
bash install-mac.sh
```

## Cada día de trabajo (1 comando)

```bash
cd ~/rad-ai-expert-deploy/bridge
source .venv/bin/activate
python3 samsung_bridge.py
```

Deja esa terminal abierta. Verás `Puente RAD-AIEXPERT activo`.

Abre la app en Safari/Chrome **en ese mismo iMac**. En la lista de trabajo debe aparecer **Puente Samsung V7 → EN LÍNEA**.

## Configuración única del Samsung V7

Utility → Connectivity → DICOM → Add (dos servidores):

| Servicio | AE Title | IP | Puerto |
|----------|----------|-----|--------|
| **MWL** (Worklist) | `MWL_SERVER` | IP del iMac | **1040** |
| **Storage** (PACS) | `RAD_BRIDGE` | IP del iMac | **11113** |

> Horos (visor DICOM en Mac) usa el puerto **11112** por defecto. El puente usa **11113** para que puedas tener ambos activos.

En Storage, activa **envío automático** al finalizar/guardar el estudio si tu firmware lo ofrece.

Obtén la IP del iMac: **Ajustes del Sistema → Red → Wi‑Fi → Detalles**.

Si el Test falla: **Ajustes → Red → Firewall** → permitir Python en redes locales.

## Flujo por paciente (3 pasos)

1. **En la app:** toca al paciente en la lista de trabajo (carga nombre, ID, estudio en el reporte).
2. **En el V7:** Patient → Worklist → Query → selecciona al mismo paciente → realiza el estudio.
3. **Al enviar por red:** las capturas se adjuntan solas al módulo **Anexar Imágenes** del PDF. Generas y entregas el reporte.

No hay USB, no hay arrastrar archivos, no hay export manual.

## Resolución de problemas

| Síntoma | Solución |
|---------|----------|
| Puente OFFLINE pero `/api/health` responde `ok:true` en terminal | Abre la app **en el mismo iMac** (no en otro dispositivo). Actualiza y reinicia el puente: `git pull` + `python3 samsung_bridge.py`. Chrome puede pedir permiso de **red local** — acéptalo. |
| Puente OFFLINE en la app | Ejecutar `python3 samsung_bridge.py` en el iMac |
| Worklist vacía en el V7 | Verificar Test MWL; revisar que la agenda tenga pacientes en la app |
| Imágenes no llegan | Verificar servidor Storage `RAD_BRIDGE:11113`; confirmar envío DICOM al guardar |
| Nombre/ID no coinciden | Usa el mismo paciente de la lista; el ID DICOM debe coincidir |

## Datos locales

El puente guarda en `~/RAD-AIEXPERT-Bridge/`:

- `worklist.json` — agenda sincronizada
- `incoming/` — capturas DICOM recibidas del V7
