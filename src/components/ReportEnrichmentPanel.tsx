import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  ShieldCheck,
  Sparkles,
  Undo2,
} from "lucide-react";
import type { ReportEnrichmentChange, ReportEnrichmentSession } from "../types";
import { enrichmentSourceLabel } from "../lib/reportEnrichment";

interface ReportEnrichmentPanelProps {
  session: ReportEnrichmentSession | null;
  isRunning?: boolean;
  onUndoAll: () => void;
  onApplyChange: (changeId: string) => void;
  onApplyRemaining: () => void;
  onRejectChange: (changeId: string) => void;
  applyingIds?: Set<string> | string[];
}

const ChangeRow: React.FC<{
  change: ReportEnrichmentChange;
  busy: boolean;
  onApply: () => void;
  onReject: () => void;
}> = ({ change, busy, onApply, onReject }) => {
  const sourceColor =
    change.source === "negativity_checklist"
      ? "border-teal-500/40 text-teal-300 bg-teal-500/10"
      : change.source === "classification"
        ? "border-amber-500/40 text-amber-300 bg-amber-500/10"
        : change.source === "scorecard"
          ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
          : change.source === "measurement"
            ? "border-sky-500/40 text-sky-300 bg-sky-500/10"
            : "border-indigo-500/40 text-indigo-300 bg-indigo-500/10";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3.5 py-3 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${sourceColor}`}
            >
              {enrichmentSourceLabel(change.source)}
            </span>
            {change.status === "applied" && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Aplicado
              </span>
            )}
            {change.status === "pending" && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">
                Pendiente
              </span>
            )}
            {change.status === "rejected" && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                Descartado
              </span>
            )}
            {change.reviewOnly && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Solo revisión
              </span>
            )}
          </div>
          <p className="text-[11px] font-bold text-slate-200 leading-snug">{change.title}</p>
          {change.reason && (
            <p className="text-[10px] text-slate-500 leading-relaxed">{change.reason}</p>
          )}
        </div>
        {change.status === "pending" &&
          !change.reviewOnly &&
          (change.suggestedText ||
            change.classificationMeta?.name ||
            change.measurementMeta?.structure) && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onApply}
              disabled={busy}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 disabled:opacity-50 text-white text-[9px] font-black uppercase tracking-wide"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Aplicar"}
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={busy}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-[9px] font-black uppercase tracking-wide"
            >
              Descartar
            </button>
          </div>
        )}
        {change.status === "pending" && change.reviewOnly && (
          <button
            type="button"
            onClick={onReject}
            disabled={busy}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-[9px] font-black uppercase tracking-wide shrink-0"
          >
            Marcar vista
          </button>
        )}
      </div>
      {change.suggestedText && (
        <p className="text-[10px] text-slate-300 leading-relaxed border-l-2 border-slate-700 pl-2.5 italic">
          “{change.suggestedText}”
        </p>
      )}
      {change.placementHint && (
        <p className="text-[9px] text-slate-600 font-mono">Ancla: {change.placementHint}</p>
      )}
    </div>
  );
};

export const ReportEnrichmentPanel: React.FC<ReportEnrichmentPanelProps> = ({
  session,
  isRunning,
  onUndoAll,
  onApplyChange,
  onApplyRemaining,
  onRejectChange,
  applyingIds,
}) => {
  const [showDiff, setShowDiff] = useState(false);
  const busySet = useMemo(() => {
    if (!applyingIds) return new Set<string>();
    return applyingIds instanceof Set ? applyingIds : new Set(applyingIds);
  }, [applyingIds]);

  if (!session && !isRunning) return null;

  const applied = session?.changes.filter((c) => c.status === "applied") || [];
  const pending = session?.changes.filter((c) => c.status === "pending") || [];
  const pendingActionable = pending.filter(
    (c) =>
      !c.reviewOnly &&
      (c.source === "classification"
        ? !!c.classificationMeta?.name
        : !!c.suggestedText.trim())
  );
  const reportChanged =
    !!session &&
    session.beforeReport.trim() !== session.afterReport.trim() &&
    session.status === "done";

  return (
    <div
      id="report-enrichment-panel"
      className="rounded-2xl border border-cyan-800/40 bg-gradient-to-br from-slate-950 via-slate-950 to-cyan-950/20 overflow-hidden shadow-xl"
    >
      <div className="px-5 py-4 border-b border-cyan-900/30 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-cyan-700/30 border border-cyan-500/30 flex items-center justify-center shrink-0">
            {isRunning || session?.status === "running" ? (
              <Loader2 className="h-5 w-5 text-cyan-300 animate-spin" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-cyan-300" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black uppercase tracking-wider text-cyan-100 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              Pulido clínico
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              {isRunning || session?.status === "running"
                ? "Auditando scorecard, negatividades, segundo lector y clasificaciones; integrando cambios seguros…"
                : session?.status === "error"
                  ? session.error || "Error en el pulido."
                  : applied.length || pending.length
                    ? `Aplicados ${applied.length} · ${pending.length} pendiente${pending.length === 1 ? "" : "s"} de revisión`
                    : "Sin gaps seguros que integrar; el borrador ya estaba completo."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {reportChanged && (
            <button
              type="button"
              onClick={() => setShowDiff((v) => !v)}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 text-[9px] font-black uppercase tracking-wide flex items-center gap-1.5"
            >
              {showDiff ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showDiff ? "Ocultar diff" : "Ver antes / después"}
            </button>
          )}
          {pendingActionable.length > 0 && session?.status === "done" && (
            <button
              type="button"
              onClick={onApplyRemaining}
              disabled={busySet.size > 0}
              className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-[9px] font-black uppercase tracking-wide"
            >
              Aplicar restantes ({pendingActionable.length})
            </button>
          )}
          {reportChanged && (
            <button
              type="button"
              onClick={onUndoAll}
              className="px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-950/40 hover:bg-rose-950/70 text-rose-300 text-[9px] font-black uppercase tracking-wide flex items-center gap-1.5"
            >
              <Undo2 className="h-3 w-3" />
              Deshacer pulido
            </button>
          )}
        </div>
      </div>

      {(session?.status === "done" || session?.status === "error") && (
        <div className="p-4 space-y-3">
          {session.status === "error" && (
            <div className="rounded-xl border border-rose-800/40 bg-rose-950/30 px-3 py-2 text-[11px] text-rose-300">
              {session.error}
            </div>
          )}

          {showDiff && reportChanged && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">
                  Antes del pulido
                </p>
                <pre className="text-[10px] text-slate-400 whitespace-pre-wrap font-mono leading-relaxed max-h-56 overflow-y-auto">
                  {session.beforeReport}
                </pre>
              </div>
              <div className="rounded-xl border border-cyan-900/40 bg-cyan-950/10 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-cyan-500/80 mb-2">
                  Después del pulido
                </p>
                <pre className="text-[10px] text-slate-300 whitespace-pre-wrap font-mono leading-relaxed max-h-56 overflow-y-auto">
                  {session.afterReport}
                </pre>
              </div>
            </div>
          )}

          {applied.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/90">
                Integrados automáticamente
              </p>
              {applied.map((c) => (
                <ChangeRow
                  key={c.id}
                  change={c}
                  busy={false}
                  onApply={() => {}}
                  onReject={() => {}}
                />
              ))}
            </div>
          )}

          {pending.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-400/90">
                Pendientes de revisión
              </p>
              {pending.map((c) => (
                <ChangeRow
                  key={c.id}
                  change={c}
                  busy={busySet.has(c.id)}
                  onApply={() => onApplyChange(c.id)}
                  onReject={() => onRejectChange(c.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
