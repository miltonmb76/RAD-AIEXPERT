import React from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileText,
  ListTodo,
  Network,
  User,
  X,
} from "lucide-react";
import type { WorklistPatient } from "../firebaseDb";

export interface CaptureMismatchInfo {
  patientId: string;
  patientName?: string;
  fileName?: string;
}

export interface ActivePatientPanelProps {
  patient: WorklistPatient | null;
  bridgeOnline: boolean;
  bridgeDicomReady: boolean | null;
  captureCount: number;
  hasGeneratedReport: boolean;
  labelingConfirmed?: number;
  labelingTotal?: number;
  captureMismatch: CaptureMismatchInfo | null;
  onOpenWorklist: () => void;
  onOpenLabelingQueue?: () => void;
  onFinishCase: () => void;
  onDismissMismatch: () => void;
}

const bridgeStatusLabel = (online: boolean, dicomReady: boolean | null): string => {
  if (!online) return "Puente offline";
  if (dicomReady === true) return "Puente + DICOM listo";
  if (dicomReady === false) return "Puente HTTP ok · DICOM pendiente";
  return "Puente en linea";
};

export const ActivePatientPanel: React.FC<ActivePatientPanelProps> = ({
  patient,
  bridgeOnline,
  bridgeDicomReady,
  captureCount,
  hasGeneratedReport,
  labelingConfirmed = 0,
  labelingTotal = 0,
  captureMismatch,
  onOpenWorklist,
  onOpenLabelingQueue,
  onFinishCase,
  onDismissMismatch,
}) => {
  if (!patient) {
    return (
      <div className="shrink-0 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md px-4 py-3">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-2.5">
              <User className="h-5 w-5 text-slate-500" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 font-mono">
                Paciente activo
              </p>
              <p className="text-sm text-slate-300 mt-0.5">
                Selecciona un paciente en la lista de trabajo para evitar confusiones.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenWorklist}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-950/30 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-indigo-200 hover:bg-indigo-900/40 transition cursor-pointer"
          >
            <ListTodo className="h-4 w-4" />
            Abrir lista de trabajo
          </button>
        </div>
      </div>
    );
  }

  const metaParts: string[] = [];
  if (patient.gender) metaParts.push(patient.gender.toUpperCase());
  if (patient.age) metaParts.push(`${patient.age} anos`);
  if (patient.patientId) metaParts.push(`ID ${patient.patientId}`);
  if (patient.time) metaParts.push(patient.time);

  const bridgeOk = bridgeOnline && bridgeDicomReady !== false;
  const bridgeClass = !bridgeOnline
    ? "bg-rose-500/10 text-rose-300 border-rose-500/25"
    : bridgeDicomReady === false
      ? "bg-amber-500/10 text-amber-300 border-amber-500/25"
      : "bg-emerald-500/10 text-emerald-300 border-emerald-500/25";

  return (
    <div className="shrink-0 border-b border-indigo-500/20 bg-gradient-to-r from-indigo-950/40 via-slate-950/95 to-slate-950/95 backdrop-blur-md">
      {captureMismatch && (
        <div className="border-b border-amber-500/20 bg-amber-950/30 px-4 py-2">
          <div className="max-w-[1600px] mx-auto flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-snug">
                Captura recibida del Samsung para{" "}
                <span className="font-black">{captureMismatch.patientId}</span>
                {captureMismatch.patientName ? ` (${captureMismatch.patientName})` : ""}
                {captureMismatch.fileName ? ` — ${captureMismatch.fileName}` : ""}. No coincide con el
                paciente activo{" "}
                <span className="font-black">{patient.patientId || patient.name}</span>.
              </p>
            </div>
            <button
              type="button"
              onClick={onDismissMismatch}
              className="rounded-lg p-1 text-amber-300/80 hover:bg-amber-900/30 transition cursor-pointer"
              title="Cerrar aviso"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="px-4 py-3">
        <div className="max-w-[1600px] mx-auto flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/40 p-2.5 shadow-[0_0_20px_rgba(99,102,241,0.08)]">
              <User className="h-5 w-5 text-indigo-300" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-300 font-mono">
                  Paciente activo
                </span>
                <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-indigo-200">
                  Atendiendo
                </span>
              </div>

              <h2 className="text-base sm:text-lg font-black text-white truncate mt-0.5">{patient.name}</h2>

              {metaParts.length > 0 && (
                <p className="text-[11px] font-mono font-bold text-slate-400 mt-0.5 truncate">
                  {metaParts.join(" · ")}
                </p>
              )}

              {patient.studyType && (
                <p className="text-[10px] font-bold text-slate-300 mt-1 truncate">{patient.studyType}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2">
              <Camera className="h-3.5 w-3.5 text-sky-400" />
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Capturas</span>
              <span className="text-sm font-black text-white font-mono">{captureCount}</span>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2">
              <FileText className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Reporte</span>
              <span
                className={`text-[10px] font-black uppercase tracking-wider ${hasGeneratedReport ? "text-emerald-300" : "text-slate-500"}`}
              >
                {hasGeneratedReport ? "Generado" : "Pendiente"}
              </span>
            </div>

            {hasGeneratedReport && labelingTotal > 0 && (
              <button
                type="button"
                onClick={() => onOpenLabelingQueue?.()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/25 bg-violet-950/30 px-3 py-2 hover:bg-violet-900/30 transition cursor-pointer"
              >
                <span className="text-[10px] font-black uppercase tracking-wider text-violet-300">Rotulado</span>
                <span className="text-sm font-black text-white font-mono">
                  {labelingConfirmed}/{labelingTotal}
                </span>
              </button>
            )}

            <div className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 ${bridgeClass}`}>
              <Network className="h-3.5 w-3.5 shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-wider">
                {bridgeStatusLabel(bridgeOnline, bridgeDicomReady)}
              </span>
            </div>

            <button
              type="button"
              onClick={onOpenWorklist}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            >
              <ListTodo className="h-3.5 w-3.5" />
              Cambiar
            </button>

            <button
              type="button"
              onClick={onFinishCase}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-200 hover:bg-emerald-900/40 transition cursor-pointer"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Finalizar caso
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivePatientPanel;
