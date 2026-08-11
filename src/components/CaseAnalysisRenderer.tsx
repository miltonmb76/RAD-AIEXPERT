import React from "react";
import { 
  Activity, ArrowDown, CheckCircle2, AlertCircle, FileText, 
  GitCommit, Layers, ShieldAlert, Sparkles, Scale, Stethoscope, ChevronRight, HelpCircle
} from "lucide-react";
import { CaseAnalysisData } from "../types";

interface CaseAnalysisRendererProps {
  data: CaseAnalysisData;
  isDarkTheme?: boolean;
}

export default function CaseAnalysisRenderer({ data, isDarkTheme = false }: CaseAnalysisRendererProps) {
  if (!data) return null;

  const { format, elementsConfig, sonographicPillar, clinicalCorrelation, certaintyPercent, diagnostics, decisionFlow, managementRecommendation } = data;

  const config = elementsConfig || {
    includeSonographic: true,
    includeSonographicDetails: true,
    includeClinicalCorr: true,
    includeCertainty: false,
    includeDifferentials: true,
    includeDiscardedDifferentials: true,
    includeManagement: true,
  };

  const containerBg = isDarkTheme 
    ? "bg-slate-900/90 border-slate-800 text-slate-100" 
    : "bg-slate-50 border-slate-300 text-slate-900";

  // --- OPTION 1: FLUJOGRAMA SEMIOLÓGICO (CICLO DE PENSAMIENTO RADIOLÓGICO) ---
  if (format === "flujograma_semiologico") {
    // We dynamically build the semiological cycle steps based on the actual patient case analysis
    const semiologySteps = [];
    
    // Step 1: Hallazgo Principal
    if (config.includeSonographic && sonographicPillar) {
      semiologySteps.push({
        title: "HALLAZGO ECOGRÁFICO PRINCIPAL",
        subtitle: "Punto de Partida Semiológico",
        content: sonographicPillar.primaryFinding,
        badge: "Foco Principal",
        badgeColor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
        icon: <Activity className="h-4 w-4 text-indigo-500" />
      });
    }

    // Step 2: Hallazgos Secundarios
    const showDetails = config.includeSonographicDetails !== false && config.includeSonographic;
    if (showDetails && sonographicPillar?.details && sonographicPillar.details.length > 0) {
      semiologySteps.push({
        title: "CARACTERÍSTICAS Y HALLAZGOS SECUNDARIOS",
        subtitle: "Soporte Morfológico y Vascular",
        content: (
          <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 dark:text-slate-400 mt-1 pl-1">
            {sonographicPillar.details.map((det, i) => (
              <li key={i} className="leading-tight">{det}</li>
            ))}
          </ul>
        ),
        badge: "Signos de Soporte",
        badgeColor: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800",
        icon: <Layers className="h-4 w-4 text-sky-500" />
      });
    }

    // Step 3: Aspectos Clínicos (if available)
    if (config.includeClinicalCorr && clinicalCorrelation) {
      semiologySteps.push({
        title: "INTEGRACIÓN CLÍNICO-ANATÓMICA",
        subtitle: "Correlación de Síntomas y Laboratorio",
        content: clinicalCorrelation,
        badge: "Contexto Clínico",
        badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
        icon: <Stethoscope className="h-4 w-4 text-emerald-500" />
      });
    }

    // Step 4: Signos Descartados (from differentials)
    const primaryDiag = diagnostics && diagnostics.length > 0 ? diagnostics[0] : null;
    const discardedSigns = diagnostics?.filter(d => d.refutingCriteria && d !== primaryDiag && (!primaryDiag || d.name.toLowerCase() !== primaryDiag.name.toLowerCase())).map(d => ({
      diagName: d.name,
      refuting: d.refutingCriteria
    })) || [];

    const showDiscarded = config.includeDiscardedDifferentials !== false && config.includeDifferentials;
    if (showDiscarded && discardedSigns.length > 0) {
      semiologySteps.push({
        title: "CRITERIOS DESCARTADOS Y EXCLUSIONES",
        subtitle: "Diferenciales Desestimados",
        content: (
          <div className="space-y-1.5 mt-1 text-[11px]">
            {discardedSigns.map((ds, i) => (
              <div key={i} className="flex items-start gap-1 text-slate-600 dark:text-slate-400">
                <span className="text-rose-500 font-bold shrink-0">✗</span>
                <span className="leading-tight">
                  <strong className="text-slate-700 dark:text-slate-300">{ds.diagName}:</strong> {ds.refuting}
                </span>
              </div>
            ))}
          </div>
        ),
        badge: "Descartes Clínicos",
        badgeColor: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800",
        icon: <Scale className="h-4 w-4 text-rose-500" />
      });
    }

    // Step 5: Diagnóstico Presuntivo Final
    if (config.includeDifferentials && diagnostics && diagnostics.length > 0) {
      const primaryDiag = diagnostics[0];
      semiologySteps.push({
        title: "DIAGNÓSTICO PRESUNTIVO DEFINITIVO",
        subtitle: "Conclusión de Juicio Diagnóstico",
        content: (
          <div className="space-y-1 mt-0.5">
            <p className="font-bold text-slate-800 dark:text-white text-xs">
              {primaryDiag.name}
            </p>
            {config.includeManagement && managementRecommendation && (
              <p className="text-[11px] text-indigo-950/80 dark:text-indigo-300/80 bg-indigo-50/50 dark:bg-indigo-950/20 p-2 rounded border border-indigo-100 dark:border-indigo-900/40 mt-1.5 leading-relaxed">
                <strong className="text-indigo-600 dark:text-indigo-400">Manejo sugerido:</strong> {managementRecommendation}
              </p>
            )}
          </div>
        ),
        badge: "Juicio Final",
        badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800",
        icon: <CheckCircle2 className="h-4 w-4 text-amber-500" />
      });
    }

    return (
      <div className={`my-4 border rounded-xl overflow-hidden shadow-sm ${containerBg}`}>
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 text-white px-4 py-2.5 flex items-center justify-between border-b border-indigo-900/40">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <span className="text-[11px] font-black uppercase tracking-wider font-mono">
              FLUJOGRAMA SEMIOLÓGICO
            </span>
          </div>
        </div>

        <div className="p-5 space-y-4 relative">
          {/* Vertical connecting line */}
          <div className="absolute left-[33px] top-6 bottom-6 w-0.5 border-l border-dashed border-slate-300 dark:border-slate-800 z-0"></div>

          {semiologySteps.map((step, idx) => (
            <div key={idx} className="flex gap-4 items-start relative z-10">
              {/* Left node circle */}
              <div className="h-8 w-8 rounded-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 flex items-center justify-center shrink-0 shadow-sm">
                {step.icon}
              </div>

              {/* Right content box */}
              <div className="flex-1 min-w-0 bg-white/45 dark:bg-slate-900/35 border border-slate-200/60 dark:border-slate-800/60 p-3 rounded-lg hover:border-slate-300/80 dark:hover:border-slate-700/80 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                  <div>
                    <h4 className="text-[11px] font-black tracking-wide text-slate-800 dark:text-slate-100 uppercase">
                      {idx + 1}. {step.title}
                    </h4>
                    <p className="text-[9.5px] text-slate-500 font-medium">
                      {step.subtitle}
                    </p>
                  </div>
                  <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded border ${step.badgeColor} shrink-0`}>
                    {step.badge}
                  </span>
                </div>
                <div className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed font-medium mt-1">
                  {typeof step.content === 'string' ? <p>{step.content}</p> : step.content}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- OPTION 2: FLUJOGRAMA ALGORÍTMICO / ÁRBOL DE DECISIÓN ---
  if (format === "flujograma_algoritmico") {
    const steps = decisionFlow || [
      ...(config.includeSonographic ? [{ step: 1, title: "Punto de Partida Sonográfico", desc: sonographicPillar?.primaryFinding || "Hallazgo ecográfico primario" }] : []),
      ...(config.includeClinicalCorr ? [{ step: 2, title: "Integración Clínico-Laboratorial", desc: clinicalCorrelation || "Correlación de síntomas y laboratorio" }] : []),
      ...(config.includeDifferentials ? [{ step: 3, title: "Conclusión Diagnóstica", desc: `Diagnóstico principal: ${diagnostics?.[0]?.name || "Conclusión de juicio radiológico"}` }] : []),
      ...(config.includeManagement ? [{ step: 4, title: "Conducta y Manejo Sugerido", desc: managementRecommendation || "Prueba confirmativa o referencia" }] : []),
    ];

    return (
      <div className={`my-4 border rounded-xl overflow-hidden shadow-sm ${containerBg}`}>
        <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 text-white px-4 py-2.5 flex items-center justify-between border-b border-blue-800/40">
          <div className="flex items-center gap-2">
            <GitCommit className="h-4 w-4 text-cyan-400" />
            <span className="text-[11px] font-black uppercase tracking-wider font-mono">
              FLUJOGRAMA ALGORÍTMICO — ÁRBOL DE DECISIÓN
            </span>
          </div>
        </div>

        <div className="p-4 space-y-2">
          {steps.map((st, idx) => (
            <React.Fragment key={idx}>
              <div className="flex items-start gap-3 p-3 bg-slate-100/90 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl relative">
                <div className="h-6 w-6 rounded-full bg-indigo-600 text-white font-mono font-black text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <h4 className="text-[11px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                    {st.title}
                  </h4>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed font-medium">
                    {st.desc}
                  </p>
                </div>
              </div>
              {idx < steps.length - 1 && (
                <div className="flex justify-center my-0.5">
                  <ArrowDown className="h-4 w-4 text-indigo-500 animate-bounce" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  // --- OPTION 3: ESQUEMA INTEGRADOR POR PILARES ---
  if (format === "esquema_pilares") {
    return (
      <div className={`my-4 border rounded-xl overflow-hidden shadow-sm ${containerBg}`}>
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-emerald-400" />
            <span className="text-[11px] font-black uppercase tracking-wider font-mono">
              ESQUEMA INTEGRADOR POR PILARES EJECUTIVOS
            </span>
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {/* Pilar 1 */}
          {config.includeSonographic && sonographicPillar && (
            <div className="p-3.5 bg-slate-100/90 dark:bg-slate-850 border-t-2 border-t-indigo-500 border-slate-200 dark:border-slate-700 rounded-lg space-y-1">
              <span className="text-[9.5px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block font-mono">
                PILAR 1 — HALLAZGOS ECOGRÁFICOS
              </span>
              <p className="font-semibold text-slate-800 dark:text-slate-100 text-[11px]">
                {sonographicPillar.primaryFinding}
              </p>
              {sonographicPillar.details && sonographicPillar.details.length > 0 && (
                <p className="text-[10.5px] text-slate-600 dark:text-slate-400 leading-tight">
                  {sonographicPillar.details.join(" • ")}
                </p>
              )}
            </div>
          )}

          {/* Pilar 2 */}
          {config.includeClinicalCorr && (
            <div className="p-3.5 bg-slate-100/90 dark:bg-slate-850 border-t-2 border-t-emerald-500 border-slate-200 dark:border-slate-700 rounded-lg space-y-1">
              <span className="text-[9.5px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block font-mono">
                PILAR 2 — CORRELACIÓN CLÍNICO-LAB
              </span>
              <p className="text-slate-700 dark:text-slate-300 text-[11px] leading-relaxed">
                {clinicalCorrelation || "Sin datos de laboratorio o clínica adicionales."}
              </p>
            </div>
          )}

          {/* Pilar 3 */}
          {config.includeDifferentials && (
            <div className="p-3.5 bg-slate-100/90 dark:bg-slate-850 border-t-2 border-t-amber-500 border-slate-200 dark:border-slate-700 rounded-lg space-y-1">
              <span className="text-[9.5px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest block font-mono">
                PILAR 3 — CONCLUSIÓN & DIAGNÓSTICO
              </span>
              {diagnostics && diagnostics.length > 0 && (
                <p className="text-[10.5px] text-slate-600 dark:text-slate-400">
                  Principal: <strong className="text-slate-800 dark:text-slate-200">{diagnostics[0]?.name}</strong>
                </p>
              )}
            </div>
          )}

          {/* Pilar 4 */}
          {config.includeManagement && (
            <div className="p-3.5 bg-slate-100/90 dark:bg-slate-850 border-t-2 border-t-purple-500 border-slate-200 dark:border-slate-700 rounded-lg space-y-1">
              <span className="text-[9.5px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest block font-mono">
                PILAR 4 — CONDUCTA Y MANEJO
              </span>
              <p className="text-slate-700 dark:text-slate-300 text-[11px] leading-relaxed font-medium">
                {managementRecommendation || "Seguimiento ecográfico según evolución clínica."}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- OPTION 4: MAPA DE DIAGNÓSTICOS DIFERENCIALES ---
  if (format === "mapa_diferenciales") {
    const list = diagnostics || [];

    return (
      <div className={`my-4 border rounded-xl overflow-hidden shadow-sm ${containerBg}`}>
        <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-indigo-950 text-white px-4 py-2.5 flex items-center justify-between border-b border-teal-800/40">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-teal-400" />
            <span className="text-[11px] font-black uppercase tracking-wider font-mono">
              MAPA DE DIAGNÓSTICOS DIFERENCIALES
            </span>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Central Root Node: Primary Sonographic Finding */}
          {sonographicPillar && (
            <div className="flex flex-col items-center justify-center text-center pb-4 border-b border-slate-200 dark:border-slate-800/60">
              <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-xl max-w-md shadow-sm">
                <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest block mb-0.5">Hallazgo Sonográfico Primario</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{sonographicPillar.primaryFinding}</span>
              </div>
              <div className="h-4 w-0.5 bg-gradient-to-b from-indigo-500 to-teal-500"></div>
            </div>
          )}

          {/* Radiating Mindmap Nodes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {list.map((diag, idx) => (
              <div key={idx} className="bg-slate-100/70 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2.5 relative hover:border-teal-500/40 dark:hover:border-teal-500/40 transition-all shadow-sm">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-teal-500/10 text-teal-500 text-xs font-bold flex items-center justify-center font-mono">
                      {idx + 1}
                    </span>
                    <h5 className="font-bold text-xs text-slate-800 dark:text-slate-100 leading-snug">{diag.name}</h5>
                  </div>
                </div>

                <div className="space-y-2 text-[10.5px]">
                  {config.includeSonographic && diag.supportingCriteria && (
                    <div className="bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10">
                      <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-0.5">✓ A Favor (Sonográfico)</span>
                      <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">{diag.supportingCriteria}</p>
                    </div>
                  )}

                  {config.includeDifferentials && diag.refutingCriteria && (
                    <div className="bg-rose-500/5 p-2 rounded-lg border border-rose-500/10">
                      <span className="text-[9px] font-black text-rose-500 dark:text-rose-400 uppercase tracking-wider block mb-0.5">✗ En Contra / Ausente</span>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{diag.refutingCriteria}</p>
                    </div>
                  )}

                  {config.includeManagement && diag.confirmatoryTest && (
                    <div className="bg-purple-500/5 p-2 rounded-lg border border-purple-500/10">
                      <span className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider block mb-0.5">🧪 Test Confirmativo / Conducta</span>
                      <p className="text-slate-800 dark:text-slate-200 font-semibold leading-relaxed">{diag.confirmatoryTest}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- OPTION 5: MATRIZ SEMIÓTICA COMPARATIVA (SIGNOS PETICIONANTES VS. EXCLUSIVOS) ---
  if (format === "matriz_semiotica") {
    // Requesting signs (signos peticionantes / a favor)
    const requestingSigns: string[] = [];
    if (data.semioticMatrix?.requestingSigns && data.semioticMatrix.requestingSigns.length > 0) {
      requestingSigns.push(...data.semioticMatrix.requestingSigns);
    } else {
      if (config.includeSonographic && sonographicPillar?.primaryFinding) {
        requestingSigns.push(sonographicPillar.primaryFinding);
      }
      if (config.includeSonographicDetails !== false && sonographicPillar?.details) {
        requestingSigns.push(...sonographicPillar.details);
      }
      if (config.includeDifferentials && diagnostics && diagnostics.length > 0) {
        diagnostics.forEach(d => {
          if (d.supportingCriteria) requestingSigns.push(`[${d.name}] ${d.supportingCriteria}`);
        });
      }
    }

    // Exclusive signs & Discard criteria (signos exclusores / criterios de descarte)
    const discardSigns: string[] = [];
    if (data.semioticMatrix?.exclusiveSigns && data.semioticMatrix.exclusiveSigns.length > 0) {
      discardSigns.push(...data.semioticMatrix.exclusiveSigns);
    }
    if (data.semioticMatrix?.discardCriteria && data.semioticMatrix.discardCriteria.length > 0) {
      discardSigns.push(...data.semioticMatrix.discardCriteria);
    }
    if (discardSigns.length === 0 && config.includeDiscardedDifferentials !== false && diagnostics) {
      const pDiag = diagnostics[0];
      diagnostics.forEach(d => {
        if (d.refutingCriteria && d !== pDiag && (!pDiag || d.name.toLowerCase() !== pDiag.name.toLowerCase())) {
          discardSigns.push(`[Exclusión ${d.name}] ${d.refutingCriteria}`);
        }
      });
    }

    return (
      <div className={`my-4 border rounded-xl overflow-hidden shadow-sm ${containerBg}`}>
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-indigo-950 text-white px-4 py-2.5 flex items-center justify-between border-b border-amber-800/40">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-amber-400" />
            <span className="text-[11px] font-black uppercase tracking-wider font-mono">
              MATRIZ SEMIÓTICA COMPARATIVA: SIGNOS PETICIONANTES VS. EXCLUSIVOS
            </span>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Comparative Matrix: 2 Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Column 1: Signos Peticionantes (Inclusivos) */}
            <div className="bg-emerald-950/20 dark:bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center">✓</span>
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-mono">
                    SIGNOS PETICIONANTES (A FAVOR)
                  </h4>
                </div>
                <span className="text-[9px] font-bold text-emerald-500/80 font-mono">Criterios Inclusivos</span>
              </div>
              <ul className="space-y-1.5 text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                {requestingSigns.length > 0 ? (
                  requestingSigns.map((sign, idx) => (
                    <li key={idx} className="flex items-start gap-2 bg-emerald-500/5 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-500/10">
                      <span className="text-emerald-500 font-bold shrink-0 mt-0.5">▪</span>
                      <span className="leading-snug">{sign}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-500 text-[10px] italic">Sin signos peticionantes registrados.</li>
                )}
              </ul>
            </div>

            {/* Column 2: Signos Exclusivos & Criterios de Descarte */}
            <div className="bg-rose-950/20 dark:bg-rose-950/30 border border-rose-500/30 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between border-b border-rose-500/20 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded-full bg-rose-500/20 text-rose-400 font-bold text-xs flex items-center justify-center">✗</span>
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 font-mono">
                    SIGNOS EXCLUSIVOS & DESCARTE
                  </h4>
                </div>
                <span className="text-[9px] font-bold text-rose-500/80 font-mono">Criterios Refutadores</span>
              </div>
              <ul className="space-y-1.5 text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                {discardSigns.length > 0 ? (
                  discardSigns.map((sign, idx) => (
                    <li key={idx} className="flex items-start gap-2 bg-rose-500/5 dark:bg-rose-950/40 p-2 rounded-lg border border-rose-500/10">
                      <span className="text-rose-500 font-bold shrink-0 mt-0.5">▪</span>
                      <span className="leading-snug">{sign}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-500 text-[10px] italic">Sin criterios de descarte registrados.</li>
                )}
              </ul>
            </div>
          </div>

          {/* Bottom Synthesis / Verdict Box */}
          <div className="bg-slate-100/80 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase font-mono tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <Stethoscope className="h-3.5 w-3.5" />
                SÍNTESIS DIAGNÓSTICA Y BALANCE SEMIÓTICO
              </span>
              {diagnostics && diagnostics.length > 0 && (
                <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                  Principal: {diagnostics[0].name}
                </span>
              )}
            </div>
            {clinicalCorrelation && (
              <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                <strong>Correlación Clínica:</strong> {clinicalCorrelation}
              </p>
            )}
            {config.includeManagement && managementRecommendation && (
              <p className="text-[11px] text-indigo-950/90 dark:text-indigo-200/90 bg-indigo-50/60 dark:bg-indigo-950/40 p-2 rounded border border-indigo-200/60 dark:border-indigo-800/50 leading-relaxed mt-1">
                <strong className="text-indigo-600 dark:text-indigo-400">Conducta y Manejo Sugerido:</strong> {managementRecommendation}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
