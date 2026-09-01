#!/usr/bin/env python3
"""
Puente local Samsung V7 ↔ RAD-AIEXPERT (iMac / macOS)

- DICOM Modality Worklist (MWL) SCP  → el V7 consulta la agenda
- DICOM Storage SCP                 → el V7 envía capturas al Mac
- API HTTP + SSE                    → la app web sincroniza y recibe imágenes al instante
"""

from __future__ import annotations

import asyncio
import datetime
import json
import os
import re
import threading
from pathlib import Path
from typing import Any

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydicom.dataset import Dataset
from pynetdicom import AE, ALL_TRANSFER_SYNTAXES, evt, StoragePresentationContexts
from pynetdicom.sop_class import ModalityWorklistInformationFind, Verification

HTTP_PORT = int(os.environ.get("BRIDGE_HTTP_PORT", "8787"))
MWL_PORT = int(os.environ.get("BRIDGE_MWL_PORT", "1040"))
STORAGE_PORT = int(os.environ.get("BRIDGE_STORAGE_PORT", "11112"))
MWL_AE_TITLE = os.environ.get("BRIDGE_MWL_AE_TITLE", "MWL_SERVER").encode("ascii", "ignore")
STORAGE_AE_TITLE = os.environ.get("BRIDGE_STORAGE_AE_TITLE", "RAD_BRIDGE").encode("ascii", "ignore")

DATA_DIR = Path(os.environ.get("BRIDGE_DATA_DIR", str(Path.home() / "RAD-AIEXPERT-Bridge")))
INCOMING_DIR = DATA_DIR / "incoming"
WORKLIST_FILE = DATA_DIR / "worklist.json"
STATE_FILE = DATA_DIR / "state.json"

DATA_DIR.mkdir(parents=True, exist_ok=True)
INCOMING_DIR.mkdir(parents=True, exist_ok=True)

worklist_patients: list[dict[str, Any]] = []
active_patient: dict[str, str] = {"patientId": "", "internalId": "", "name": ""}
event_log: list[dict[str, Any]] = []
sse_subscribers: list[asyncio.Queue] = []
_loop: asyncio.AbstractEventLoop | None = None


def load_persisted_state() -> None:
    global worklist_patients, active_patient
    if WORKLIST_FILE.exists():
        try:
            data = json.loads(WORKLIST_FILE.read_text(encoding="utf-8"))
            worklist_patients = data.get("patients", [])
        except Exception:
            worklist_patients = []
    if STATE_FILE.exists():
        try:
            active_patient = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass


def persist_worklist() -> None:
    WORKLIST_FILE.write_text(
        json.dumps({"patients": worklist_patients, "updatedAt": datetime.datetime.now().isoformat()}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def persist_active_patient() -> None:
    STATE_FILE.write_text(json.dumps(active_patient, ensure_ascii=False, indent=2), encoding="utf-8")


def formatear_nombre_dicom(nombre_completo: str) -> str:
    if not nombre_completo:
        return "Paciente^Anonimo"
    palabras = [w for w in nombre_completo.strip().split() if w]
    if not palabras:
        return "Paciente^Anonimo"
    if len(palabras) == 1:
        return palabras[0]
    if len(palabras) == 2:
        return f"{palabras[1]}^{palabras[0]}"
    if len(palabras) == 3:
        return f"{palabras[1]} {palabras[2]}^{palabras[0]}"
    apellidos = f"{palabras[-2]} {palabras[-1]}"
    nombres = " ".join(palabras[:-2])
    return f"{apellidos}^{nombres}"


def parse_patient_age_and_dob(edad_raw: str) -> tuple[str, str]:
    dob_fallback = "19800101"
    age_fallback = "040Y"
    if not edad_raw:
        return dob_fallback, age_fallback

    val = str(edad_raw).strip()
    match_iso = re.search(r"(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})", val)
    match_lat = re.search(r"(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})", val)
    dt = None
    if match_iso:
        try:
            dt = datetime.date(int(match_iso.group(1)), int(match_iso.group(2)), int(match_iso.group(3)))
        except ValueError:
            pass
    elif match_lat:
        try:
            dt = datetime.date(int(match_lat.group(3)), int(match_lat.group(2)), int(match_lat.group(1)))
        except ValueError:
            pass

    if dt:
        dob_str = dt.strftime("%Y%m%d")
        hoy = datetime.date.today()
        calculated_age = hoy.year - dt.year - ((hoy.month, hoy.day) < (dt.month, dt.day))
        calculated_age = max(0, calculated_age)
        return dob_str, f"{calculated_age:03d}Y"

    match_num = re.search(r"\d+", val)
    if match_num:
        try:
            years = int(match_num.group(0))
            if 0 <= years <= 130:
                hoy = datetime.date.today()
                birth_year = hoy.year - years
                return f"{birth_year}0601", f"{years:03d}Y"
        except Exception:
            pass

    return dob_fallback, age_fallback


def handle_mwl_find(event):
    print("\n[MWL] Consulta recibida del Samsung V7")
    for index, p in enumerate(worklist_patients):
        ds = Dataset()
        nombre_original = (p.get("name") or "").strip()
        ds.PatientName = formatear_nombre_dicom(nombre_original)
        ds.PatientID = p.get("patientId") or f"REG-{index + 1:04d}"
        g = (p.get("gender") or "").upper()
        ds.PatientSex = g if g in ["M", "F"] else "O"
        dob, age_dicom = parse_patient_age_and_dob(p.get("age", ""))
        ds.PatientBirthDate = dob
        ds.PatientAge = age_dicom

        step = Dataset()
        step.ScheduledStationAETitle = MWL_AE_TITLE.decode("ascii", "ignore")
        step.ScheduledProcedureStepStartDate = datetime.date.today().strftime("%Y%m%d")
        raw_time = (p.get("time") or "08:00").replace(":", "")
        step.ScheduledProcedureStepStartTime = raw_time.ljust(6, "0")[:6]
        step.Modality = "US"
        step.ScheduledProcedureStepDescription = p.get("studyType") or "Ecografia US"
        step.ScheduledProcedureStepID = f"SPS-{index + 1:04d}"

        ds.ScheduledProcedureStepSequence = [step]
        ds.RequestedProcedureID = f"RP-{index + 1:04d}"
        ds.RequestedProcedureDescription = p.get("studyType") or "Ecografia US"
        ds.AccessionNumber = p.get("accessionNumber") or f"ACC-{index + 1:04d}"
        print(f"   → {ds.PatientID}: {nombre_original}")
        yield (0xFF00, ds)


def handle_store(event):
    ds = event.dataset
    ds.file_meta = event.file_meta
    patient_id = str(getattr(ds, "PatientID", "UNKNOWN") or "UNKNOWN")
    study_uid = str(getattr(ds, "StudyInstanceUID", "unknown") or "unknown")
    sop_uid = str(getattr(ds, "SOPInstanceUID", None) or f"{datetime.datetime.now().timestamp()}")

    dest_dir = INCOMING_DIR / patient_id / study_uid
    dest_dir.mkdir(parents=True, exist_ok=True)
    file_path = dest_dir / f"{sop_uid}.dcm"
    ds.save_as(str(file_path), write_like_original=False)

    active_pid = active_patient.get("patientId", "")
    auto_attach = bool(active_pid and patient_id == active_pid)

    payload = {
        "type": "capture_received",
        "patientId": patient_id,
        "patientName": str(getattr(ds, "PatientName", "")),
        "studyInstanceUid": study_uid,
        "sopInstanceUid": sop_uid,
        "fileName": file_path.name,
        "receivedAt": datetime.datetime.now().isoformat(),
        "autoAttach": auto_attach,
    }
    print(f"[STORE] Captura recibida — PatientID={patient_id} autoAttach={auto_attach}")
    publish_event(payload)
    return 0x0000


def publish_event(payload: dict[str, Any]) -> None:
    event_log.append(payload)
    if len(event_log) > 200:
        del event_log[:-200]
    if _loop is None:
        return

    def _dispatch() -> None:
        for queue in list(sse_subscribers):
            try:
                queue.put_nowait(payload)
            except Exception:
                pass

    _loop.call_soon_threadsafe(_dispatch)


def start_mwl_server() -> None:
    ae = AE(ae_title=MWL_AE_TITLE)
    ae.add_supported_context(ModalityWorklistInformationFind)
    ae.add_supported_context(Verification)
    handlers = [(evt.EVT_C_FIND, handle_mwl_find)]
    print(f"[MWL] Escuchando en 0.0.0.0:{MWL_PORT} AE={MWL_AE_TITLE.decode()}")
    ae.start_server(("0.0.0.0", MWL_PORT), block=True, evt_handlers=handlers)


def start_storage_server() -> None:
    ae = AE(ae_title=STORAGE_AE_TITLE)
    for context in StoragePresentationContexts:
        ae.add_supported_context(context.abstract_syntax, ALL_TRANSFER_SYNTAXES)
    ae.add_supported_context(Verification)
    handlers = [(evt.EVT_C_STORE, handle_store)]
    print(f"[STORE] Escuchando en 0.0.0.0:{STORAGE_PORT} AE={STORAGE_AE_TITLE.decode()}")
    ae.start_server(("0.0.0.0", STORAGE_PORT), block=True, evt_handlers=handlers)


app = FastAPI(title="RAD-AIEXPERT Samsung V7 Bridge")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup() -> None:
    global _loop
    _loop = asyncio.get_running_loop()
    load_persisted_state()
    threading.Thread(target=start_mwl_server, daemon=True, name="mwl-scp").start()
    threading.Thread(target=start_storage_server, daemon=True, name="storage-scp").start()
    print("=" * 56)
    print(" Puente RAD-AIEXPERT activo")
    print(f" HTTP API : http://127.0.0.1:{HTTP_PORT}")
    print(f" MWL      : puerto {MWL_PORT}  AE Title {MWL_AE_TITLE.decode()}")
    print(f" Storage  : puerto {STORAGE_PORT}  AE Title {STORAGE_AE_TITLE.decode()}")
    print(f" Datos    : {DATA_DIR}")
    print("=" * 56)


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "patients": len(worklist_patients),
        "activePatientId": active_patient.get("patientId", ""),
        "mwlPort": MWL_PORT,
        "storagePort": STORAGE_PORT,
        "mwlAeTitle": MWL_AE_TITLE.decode(),
        "storageAeTitle": STORAGE_AE_TITLE.decode(),
    }


@app.post("/api/worklist")
def update_worklist(body: dict[str, Any]) -> dict[str, Any]:
    global worklist_patients
    patients = body.get("patients")
    if not isinstance(patients, list):
        raise HTTPException(status_code=400, detail="Se requiere un arreglo 'patients'")
    worklist_patients = []
    for index, p in enumerate(patients):
        if not isinstance(p, dict):
            continue
        pid = p.get("patientId") or f"SS-{index + 1:04d}"
        worklist_patients.append(
            {
                "name": p.get("name") or "Paciente",
                "patientId": pid,
                "gender": p.get("gender") or "",
                "age": p.get("age") or "",
                "studyType": p.get("studyType") or "Ecografia US",
                "time": p.get("time") or "",
                "accessionNumber": p.get("accessionNumber") or f"ACC-{index + 1:04d}",
                "internalId": p.get("internalId") or p.get("id") or "",
            }
        )
    persist_worklist()
    publish_event({"type": "worklist_updated", "count": len(worklist_patients)})
    print(f"[API] Worklist sincronizada — {len(worklist_patients)} pacientes")
    return {"ok": True, "count": len(worklist_patients)}


@app.post("/api/active-patient")
def set_active_patient(body: dict[str, Any]) -> dict[str, Any]:
    global active_patient
    active_patient = {
        "patientId": str(body.get("patientId") or ""),
        "internalId": str(body.get("internalId") or body.get("id") or ""),
        "name": str(body.get("name") or ""),
    }
    persist_active_patient()
    print(f"[API] Paciente activo → {active_patient['patientId']} ({active_patient['name']})")
    return {"ok": True, "active": active_patient}


@app.get("/api/patient/{patient_id}/captures")
def list_patient_captures(patient_id: str) -> dict[str, Any]:
    patient_dir = INCOMING_DIR / patient_id
    if not patient_dir.exists():
        return {"patientId": patient_id, "captures": []}

    captures: list[dict[str, Any]] = []
    for study_dir in sorted(patient_dir.iterdir()):
        if not study_dir.is_dir():
            continue
        for dcm_file in sorted(study_dir.glob("*.dcm")):
            stat = dcm_file.stat()
            captures.append(
                {
                    "fileName": dcm_file.name,
                    "studyInstanceUid": study_dir.name,
                    "sizeBytes": stat.st_size,
                    "modifiedAt": datetime.datetime.fromtimestamp(stat.st_mtime).isoformat(),
                }
            )
    return {"patientId": patient_id, "captures": captures}


@app.get("/api/patient/{patient_id}/captures/{study_uid}/{file_name}")
def download_capture(patient_id: str, study_uid: str, file_name: str):
    from fastapi.responses import FileResponse

    file_path = INCOMING_DIR / patient_id / study_uid / file_name
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Captura no encontrada")
    return FileResponse(str(file_path), media_type="application/dicom", filename=file_name)


@app.get("/api/events")
async def stream_events():
    queue: asyncio.Queue = asyncio.Queue()
    sse_subscribers.append(queue)

    async def event_generator():
        try:
            yield f"data: {json.dumps({'type': 'connected'})}\n\n"
            while True:
                payload = await queue.get()
                yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
        finally:
            if queue in sse_subscribers:
                sse_subscribers.remove(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=HTTP_PORT, log_level="info")
