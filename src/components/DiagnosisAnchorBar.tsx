import React from "react";
import { Anchor, Sparkles } from "lucide-react";
import type { ClinicalScorecardData } from "../types";
import { getScorecardGovernance } from "../lib/clinicalIntelligence";
import { seedAnchorFromScorecard } from "../lib/diagnosisAnchor";

interface DiagnosisAnchorBarProps {
  diagnosisAnchor: string;
  setDiagnosisAnchor: (value: string) => void;
  scorecardData?: ClinicalScorecardData | null;
}

/**
 * Session-level diagnosis ancla. Manual text governs justification, pack, Atlas directives, etc.
 */
export const DiagnosisAnchorBar: React.FC<DiagnosisAnchorBarProps> = ({
  diagnosisAnchor,
  setDiagnosisAnchor,
  scorecardData = null,
}) => {
  const gov = getScorecardGovernance(scorecardData);
  const suggestion = gov?.categoryAssigned || "";

  return (
    <div
      id="diagnosis-anchor-bar"
      className="rounded-2xl border border-teal-500/35 bg-gradient-to-br from-teal-950/40 via-slate-950/90 to-slate-950 p-4 md:p-5 space-y-3 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-teal-500/15 border border-teal-500/40 text-teal-300 shrink-0">
          <Anchor className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-100 font-mono">
              Ancla diagnóstica
            </h3>
            <span className="text-[9px] font-black uppercase tracking-widest bg-teal-950/60 text-teal-300 border border-teal-700/40 px-2 py-0.5 rounded">
              Gobierna la sesión
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed max-w-2xl">
            El diagnóstico que estás defendiendo (p. ej. adenitis mesentérica). Centra la
            justificación, el pack de 1 página, el mapa sobre Atlas y las directivas 3D.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={diagnosisAnchor}
          onChange={(e) => setDiagnosisAnchor(e.target.value)}
          placeholder="Ej. adenitis mesentérica / colecistitis aguda / BI-RADS 4A…"
          className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-teal-500 placeholder:text-slate-600"
        />
        {suggestion && suggestion !== diagnosisAnchor.trim() && (
          <button
            type="button"
            onClick={() =>
              setDiagnosisAnchor(seedAnchorFromScorecard("", scorecardData) || suggestion)
            }
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-teal-700/50 text-teal-300 hover:bg-teal-950/50 text-[10px] font-bold uppercase tracking-wider cursor-pointer shrink-0"
            title="Usar categoría del scorecard"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Del scorecard
          </button>
        )}
        {diagnosisAnchor.trim() && (
          <button
            type="button"
            onClick={() => setDiagnosisAnchor("")}
            className="px-3 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 text-[10px] font-bold uppercase tracking-wider cursor-pointer shrink-0"
          >
            Limpiar
          </button>
        )}
      </div>

      {diagnosisAnchor.trim() && (
        <p className="text-[10px] text-teal-400/90 font-mono">
          Activa: «{diagnosisAnchor.trim()}» → justificación · pack · mapa · Atlas
        </p>
      )}
    </div>
  );
};

export default DiagnosisAnchorBar;
