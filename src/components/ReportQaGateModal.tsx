import React from "react";
import { AlertTriangle, Ban, CheckCircle2, ShieldAlert, X } from "lucide-react";
import type { ReportQaGateResult, ReportQaIssue } from "../lib/reportQaGate";
import { reportQaIssueCodeLabel } from "../lib/reportQaGate";

interface ReportQaGateModalProps {
  result: ReportQaGateResult;
  onClose: () => void;
  onProceedAnyway: () => void;
}

const IssueRow: React.FC<{ issue: ReportQaIssue }> = ({ issue }) => {
  const isBlock = issue.severity === "block";
  return (
    <div
      className={`rounded-xl border px-3.5 py-3 space-y-1.5 ${
        isBlock
          ? "border-rose-500/40 bg-rose-950/30"
          : "border-amber-500/35 bg-amber-950/25"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
            isBlock
              ? "border-rose-500/50 text-rose-300 bg-rose-500/10"
              : "border-amber-500/45 text-amber-300 bg-amber-500/10"
          }`}
        >
          {reportQaIssueCodeLabel(issue.code)}
        </span>
        <span
          className={`text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 ${
            isBlock ? "text-rose-400" : "text-amber-400"
          }`}
        >
          {isBlock ? <Ban className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          {isBlock ? "Bloquea" : "Aviso"}
        </span>
      </div>
      <p className="text-[12px] font-bold text-slate-100 leading-snug">{issue.title}</p>
      <p className="text-[11px] text-slate-400 leading-relaxed">{issue.detail}</p>
      {issue.fixHint && (
        <p className="text-[10px] text-slate-500 leading-relaxed border-l-2 border-slate-700 pl-2.5">
          {issue.fixHint}
        </p>
      )}
    </div>
  );
};

export const ReportQaGateModal: React.FC<ReportQaGateModalProps> = ({
  result,
  onClose,
  onProceedAnyway,
}) => {
  const { blocks, warnings, hasBlocks } = result;

  return (
    <div className="no-print fixed inset-0 z-[60] overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="bg-slate-950 px-5 py-4 border-b border-slate-850 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldAlert
              className={`h-5 w-5 shrink-0 ${hasBlocks ? "text-rose-400" : "text-amber-400"}`}
            />
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white uppercase tracking-wider truncate">
                QA Gate — antes del PDF
              </h3>
              <p className="text-[10px] text-slate-500 font-mono">
                {blocks.length} bloqueo{blocks.length === 1 ? "" : "s"} · {warnings.length} aviso
                {warnings.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 bg-slate-900 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Checklist duro: lateralidad, impresión vacía, categoría sin recomendación e
            inconsistencia scorecard↔texto.
          </p>
          {blocks.map((issue) => (
            <IssueRow key={issue.id} issue={issue} />
          ))}
          {warnings.map((issue) => (
            <IssueRow key={issue.id} issue={issue} />
          ))}
        </div>

        <div className="px-5 py-4 border-t border-slate-850 bg-slate-950/80 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-black uppercase tracking-wide cursor-pointer"
          >
            Corregir primero
          </button>
          <button
            type="button"
            onClick={onProceedAnyway}
            className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide cursor-pointer flex items-center justify-center gap-1.5 ${
              hasBlocks
                ? "bg-rose-900/70 hover:bg-rose-800 text-rose-100 border border-rose-500/40"
                : "bg-amber-700 hover:bg-amber-600 text-white"
            }`}
          >
            {hasBlocks ? (
              <>
                <Ban className="h-3.5 w-3.5" /> Exportar igual (riesgo)
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" /> Continuar con PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportQaGateModal;
