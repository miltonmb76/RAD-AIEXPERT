import React, { useMemo, useState } from "react";
import {
  Sparkles,
  Loader2,
  RefreshCw,
  Plus,
  Trash2,
  Pencil,
  Hexagon,
} from "lucide-react";
import type {
  ClinicalScorecardData,
  FindingsInfographicAudience,
  FindingsInfographicContentMode,
  FindingsInfographicData,
  FindingsInfographicLayout,
  FindingsInfographicNode,
} from "../types";
import {
  INFOGRAPHIC_CONTENT_MODES,
  INFOGRAPHIC_DIAGNOSIS_PRESETS,
  INFOGRAPHIC_LAYOUT_OPTIONS,
  buildInfographicCompanion,
  buildInfographicScene,
  contentModeMeta,
  emptyInfographicNode,
  ensureDualAudienceCopy,
  layoutDisplayLabel,
  normalizeFindingsInfographicData,
  projectInfographicForAudience,
  resolveInfographicDiagnosis,
} from "../lib/findingsInfographic";
import { getScorecardGovernance } from "../lib/clinicalIntelligence";
import { infographicFromScorecard } from "../lib/infographicFromModules";
import { FindingsInfographicCanvas } from "./FindingsInfographicCanvas";

interface FindingsInfographicModuleProps {
  selectedModel: string;
  reportText: string;
  studyType?: string;
  clinicalHistory?: string;
  infographicData: FindingsInfographicData | null;
  setInfographicData: (data: FindingsInfographicData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
  /** When present, categoryAssigned governs diagnosis / criteria nodes. */
  scorecardData?: ClinicalScorecardData | null;
}

const QUICK_LAYOUTS: FindingsInfographicLayout[] = [
  "convergence",
  "constellation",
  "radial",
  "cascade",
  "funnel",
  "pillars",
  "stack",
  "timeline",
  "split_compare",
  "tree",
];

export const FindingsInfographicModule: React.FC<FindingsInfographicModuleProps> = ({
  selectedModel,
  reportText,
  studyType,
  clinicalHistory,
  infographicData,
  setInfographicData,
  includeInReport,
  setIncludeInReport,
  scorecardData = null,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presetId, setPresetId] = useState("auto");
  const [customDiagnosis, setCustomDiagnosis] = useState("");
  const [contentMode, setContentMode] =
    useState<FindingsInfographicContentMode>("justify_diagnosis");
  const [layoutChoice, setLayoutChoice] = useState<FindingsInfographicLayout | "auto">(
    "convergence"
  );

  const scoreGov = getScorecardGovernance(scorecardData);
  const diagnosisLabel =
    presetId === "auto" && scoreGov?.categoryAssigned
      ? scoreGov.categoryAssigned
      : resolveInfographicDiagnosis(presetId, customDiagnosis);
  const modeMeta = contentModeMeta(contentMode);
  const audience: FindingsInfographicAudience =
    infographicData?.activeAudience === "patient" ? "patient" : "clinician";

  const projected = useMemo(
    () =>
      infographicData
        ? projectInfographicForAudience(ensureDualAudienceCopy(infographicData), audience)
        : null,
    [infographicData, audience]
  );

  const scene = useMemo(
    () => (projected ? buildInfographicScene(projected) : null),
    [projected]
  );

  const companion = useMemo(
    () => (projected ? buildInfographicCompanion(projected) : null),
    [projected]
  );

  const setAudience = (next: FindingsInfographicAudience) => {
    if (!infographicData) return;
    setInfographicData({
      ...ensureDualAudienceCopy(infographicData),
      activeAudience: next,
    });
  };

  const handleContentModeChange = (mode: FindingsInfographicContentMode) => {
    setContentMode(mode);
    const meta = contentModeMeta(mode);
    if (layoutChoice !== "auto" && meta.suggestedLayouts[0]) {
      setLayoutChoice(meta.suggestedLayouts[0]);
      if (infographicData) {
        setInfographicData({
          ...infographicData,
          contentMode: mode,
          layout: meta.suggestedLayouts[0],
          title: meta.defaultTitle,
        });
      }
    } else if (infographicData) {
      setInfographicData({ ...infographicData, contentMode: mode, title: meta.defaultTitle });
    }
  };

  const handleGenerate = async () => {
    if (!reportText.trim()) {
      setError("El informe está vacío. Genera o redacta un informe primero.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // Prefer scorecard bridge when category governs classification criteria
      if (
        scorecardData &&
        scoreGov?.categoryAssigned &&
        (contentMode === "classification_criteria" || presetId === "auto")
      ) {
        const fromScore = infographicFromScorecard(scorecardData);
        setInfographicData(
          normalizeFindingsInfographicData(
            {
              ...fromScore,
              contentMode:
                contentMode === "classification_criteria"
                  ? "classification_criteria"
                  : fromScore.contentMode,
              layout:
                layoutChoice === "auto" ? fromScore.layout : layoutChoice,
              title:
                contentMode === "classification_criteria"
                  ? modeMeta.defaultTitle
                  : fromScore.title,
            },
            scoreGov.categoryAssigned,
            layoutChoice === "auto" ? fromScore.layout : layoutChoice,
            contentMode === "classification_criteria"
              ? "classification_criteria"
              : fromScore.contentMode
          )
        );
        setIncludeInReport(true);
        return;
      }

      const response = await fetch("/api/generate-findings-infographic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: reportText,
          studyType: studyType || "",
          clinicalHistory: clinicalHistory || "",
          diagnosis: diagnosisLabel,
          diagnosisPreset: presetId,
          layout: layoutChoice,
          contentMode,
          scorecardCategory: scoreGov?.categoryAssigned || undefined,
          scorecardProtocol: scoreGov?.protocolName || undefined,
          scorecardRecommendation: scoreGov?.recommendation || undefined,
        }),
      });
      const json = await response.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || "No se pudo generar la infografía.");
      }
      const lockedDiagnosis = scoreGov?.categoryAssigned || diagnosisLabel;
      setInfographicData(
        normalizeFindingsInfographicData(
          {
            ...json.data,
            diagnosis: lockedDiagnosis,
          },
          lockedDiagnosis,
          layoutChoice,
          contentMode
        )
      );
      setIncludeInReport(true);
    } catch (err: any) {
      console.error("Error generando infografía de hallazgos:", err);
      setError(err?.message || "Error al generar la infografía.");
    } finally {
      setIsLoading(false);
    }
  };

  const updateNode = (id: string, patch: Partial<FindingsInfographicNode>) => {
    if (!infographicData) return;
    setInfographicData({
      ...infographicData,
      nodes: infographicData.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    });
  };

  const removeNode = (id: string) => {
    if (!infographicData) return;
    const next = infographicData.nodes.filter((n) => n.id !== id);
    setInfographicData({
      ...infographicData,
      nodes: next.length ? next : [emptyInfographicNode()],
    });
  };

  const addNode = () => {
    if (!infographicData) {
      setInfographicData(
        normalizeFindingsInfographicData(
          {
            title: modeMeta.defaultTitle,
            diagnosis: diagnosisLabel,
            contentMode,
            layout: layoutChoice === "auto" ? "convergence" : layoutChoice,
            nodes: [],
          },
          diagnosisLabel,
          layoutChoice,
          contentMode
        )
      );
      return;
    }
    if (infographicData.nodes.length >= 10) return;
    setInfographicData({
      ...infographicData,
      nodes: [...infographicData.nodes, emptyInfographicNode()],
    });
  };

  const changeLayout = (next: FindingsInfographicLayout) => {
    setLayoutChoice(next);
    if (infographicData) {
      setInfographicData({ ...infographicData, layout: next });
    }
  };

  return (
    <div
      id="findings-infographic-module"
      className="bg-slate-900/95 border-2 border-teal-500/30 rounded-3xl p-5 md:p-7 shadow-2xl space-y-5 text-slate-100 animate-fadeIn"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-gradient-to-br from-teal-500/20 to-cyan-500/10 border border-teal-500/40 rounded-2xl text-teal-300 shadow-md shrink-0">
            <Hexagon className="h-6 w-6 text-teal-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm md:text-base font-black uppercase tracking-wider text-slate-100 font-mono">
                Infografía de hallazgos
              </h3>
              <span className="text-[9px] font-black uppercase tracking-widest bg-teal-950/50 text-teal-300 border border-teal-700/40 px-2 py-0.5 rounded">
                Flexible
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-xl leading-relaxed">
              Misma anatomía, dos lecturas: médico (técnica) y paciente (lenguaje llano).
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeInReport}
              onChange={(e) => setIncludeInReport(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-teal-500 focus:ring-teal-500"
            />
            Incluir en PDF
          </label>
          {infographicData && includeInReport && (
            <div className="flex flex-col items-end gap-1 text-[10px] text-slate-400">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={infographicData.includeClinicianInPdf !== false}
                  onChange={(e) =>
                    setInfographicData({
                      ...infographicData,
                      includeClinicianInPdf: e.target.checked,
                    })
                  }
                  className="rounded border-slate-600 bg-slate-800 text-teal-500"
                />
                Anexo médico
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={infographicData.includePatientInPdf !== false}
                  onChange={(e) =>
                    setInfographicData({
                      ...infographicData,
                      includePatientInPdf: e.target.checked,
                    })
                  }
                  className="rounded border-slate-600 bg-slate-800 text-teal-500"
                />
                Anexo paciente
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Tipo de contenido
          </label>
          <select
            value={contentMode}
            onChange={(e) =>
              handleContentModeChange(e.target.value as FindingsInfographicContentMode)
            }
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-teal-500 cursor-pointer"
          >
            {INFOGRAPHIC_CONTENT_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} — {m.desc}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Diagnóstico / tema ancla
          </label>
          <select
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-teal-500 cursor-pointer"
          >
            {INFOGRAPHIC_DIAGNOSIS_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Detalle del ancla
          </label>
          <input
            type="text"
            value={customDiagnosis}
            onChange={(e) => setCustomDiagnosis(e.target.value)}
            placeholder="Ej. colecistitis aguda / BI-RADS 4…"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-teal-500"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Representación visual
          </label>
          <select
            value={layoutChoice}
            onChange={(e) => {
              const v = e.target.value as FindingsInfographicLayout | "auto";
              setLayoutChoice(v);
              if (v !== "auto" && infographicData) {
                setInfographicData({ ...infographicData, layout: v });
              }
            }}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-teal-500 cursor-pointer"
          >
            {INFOGRAPHIC_LAYOUT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label} — {o.desc}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white text-xs font-black uppercase tracking-wider cursor-pointer"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {infographicData ? "Regenerar infografía" : "Generar infografía"}
        </button>
        {infographicData && (
          <>
            <button
              type="button"
              onClick={addNode}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-teal-700/50 text-teal-300 hover:bg-teal-950/40 text-[10px] font-bold uppercase cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Nodo
            </button>
            {QUICK_LAYOUTS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => changeLayout(m)}
                className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase cursor-pointer border ${
                  infographicData.layout === m
                    ? "bg-teal-700/40 border-teal-500 text-teal-100"
                    : "border-slate-700 text-slate-400 hover:text-slate-200"
                }`}
              >
                {layoutDisplayLabel(m)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setInfographicData(null);
                setIncludeInReport(false);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 text-[10px] font-bold uppercase cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Quitar del informe
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-800/50 rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      {isLoading && !infographicData && (
        <div className="flex items-center gap-3 text-teal-300 text-xs font-mono py-8 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          Componiendo la lámina ({modeMeta.label})…
        </div>
      )}

      {infographicData && scene && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Vista previa
            </span>
            <div className="inline-flex rounded-xl border border-slate-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setAudience("clinician")}
                className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider cursor-pointer ${
                  audience === "clinician"
                    ? "bg-teal-600 text-white"
                    : "bg-slate-950 text-slate-400 hover:text-slate-200"
                }`}
              >
                Médico
              </button>
              <button
                type="button"
                onClick={() => setAudience("patient")}
                className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider cursor-pointer ${
                  audience === "patient"
                    ? "bg-cyan-600 text-white"
                    : "bg-slate-950 text-slate-400 hover:text-slate-200"
                }`}
              >
                Paciente
              </button>
            </div>
            <span className="text-[10px] text-slate-500">
              Misma lámina · {audience === "patient" ? "lenguaje llano" : "léxico técnico"}
            </span>
          </div>

          <div className="rounded-2xl border border-teal-500/25 overflow-hidden bg-slate-950 -mx-1 sm:mx-0">
            <FindingsInfographicCanvas
              scene={scene}
              className="w-full h-auto block min-h-[420px] sm:min-h-[520px]"
            />
          </div>

          {companion && (
            <div className="rounded-2xl border border-slate-700/60 bg-slate-50 text-slate-800 p-4 md:p-5 space-y-4 shadow-inner">
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-teal-700">
                  {companion.synthesisEyebrow}
                  {" · "}
                  {audience === "patient" ? "Paciente" : "Médico"}
                </p>
                <textarea
                  value={
                    audience === "patient"
                      ? infographicData.patientSynthesis ?? ""
                      : infographicData.synthesis ?? ""
                  }
                  onChange={(e) =>
                    setInfographicData({
                      ...infographicData,
                      ...(audience === "patient"
                        ? { patientSynthesis: e.target.value }
                        : { synthesis: e.target.value }),
                    })
                  }
                  placeholder={companion.synthesis}
                  rows={3}
                  className="w-full bg-white/80 border border-slate-200 rounded-xl px-3 py-2 text-[12px] leading-relaxed text-slate-700 outline-none focus:border-teal-500 resize-y placeholder:text-slate-400"
                />
                <p className="text-[10px] text-slate-500">
                  Editable · vacío = texto sugerido según {modeMeta.label.toLowerCase()}.
                </p>
              </div>
              <div className="border-t border-slate-200 pt-3 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-teal-700">
                  {companion.listEyebrow}
                </p>
                <ol className="space-y-2">
                  {companion.items.map((item) => (
                    <li key={item.index} className="flex gap-2.5 text-[12px] leading-snug">
                      <span className="font-mono text-teal-700/80 shrink-0 w-5 text-right">
                        {item.index}.
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                          <span className="font-semibold text-slate-800">{item.title}</span>
                          {item.tag && (
                            <span className="text-[10px] uppercase tracking-wider text-slate-500">
                              {item.tag}
                            </span>
                          )}
                        </div>
                        {item.note && (
                          <p className="text-[11px] text-slate-500 mt-0.5">{item.note}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-teal-500/20 bg-gradient-to-br from-teal-950/20 via-slate-950/80 to-slate-950 p-4 space-y-2">
            <div className="flex items-center gap-2 text-teal-300/90">
              <Pencil className="h-3.5 w-3.5" />
              <span className="text-[10px] font-black uppercase tracking-widest">
                Editable · {audience === "patient" ? "Paciente" : "Médico"}
              </span>
            </div>
            <input
              type="text"
              value={
                audience === "patient"
                  ? infographicData.patientDiagnosis || ""
                  : infographicData.diagnosis
              }
              onChange={(e) =>
                setInfographicData({
                  ...infographicData,
                  ...(audience === "patient"
                    ? { patientDiagnosis: e.target.value }
                    : { diagnosis: e.target.value }),
                })
              }
              placeholder={
                audience === "patient"
                  ? "Ancla en lenguaje llano"
                  : "Ancla / diagnóstico (médico)"
              }
              className="w-full bg-transparent border-b border-teal-800/40 pb-1 text-sm font-black text-slate-100 outline-none focus:border-teal-400"
            />
            <input
              type="text"
              value={
                audience === "patient"
                  ? infographicData.patientTitle || ""
                  : infographicData.title
              }
              onChange={(e) =>
                setInfographicData({
                  ...infographicData,
                  ...(audience === "patient"
                    ? { patientTitle: e.target.value }
                    : { title: e.target.value }),
                })
              }
              placeholder={audience === "patient" ? "Título paciente" : "Título médico"}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 outline-none focus:border-teal-500"
            />
            <input
              type="text"
              value={infographicData.studyRegion || ""}
              onChange={(e) =>
                setInfographicData({ ...infographicData, studyRegion: e.target.value })
              }
              placeholder="Región (opcional, compartida)"
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 outline-none focus:border-teal-500"
            />
          </div>

          <div className="space-y-3">
            {infographicData.nodes.map((node, idx) => (
              <div
                key={node.id}
                className="rounded-2xl border border-slate-800 bg-slate-950/70 overflow-hidden"
              >
                <div className="flex items-center justify-between gap-2 px-3.5 py-2 border-b border-slate-800/80 bg-slate-900/50">
                  <span className="text-[10px] font-black uppercase tracking-widest text-teal-400/90 font-mono">
                    Nodo {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeNode(node.id)}
                    className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-rose-300 font-bold uppercase cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                    Eliminar
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 p-3.5">
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                      Etiqueta médico
                    </span>
                    <input
                      type="text"
                      value={node.label}
                      onChange={(e) => updateNode(node.id, { label: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-200 outline-none focus:border-teal-500"
                    />
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                      Etiqueta paciente
                    </span>
                    <input
                      type="text"
                      value={node.patientLabel || ""}
                      onChange={(e) =>
                        updateNode(node.id, { patientLabel: e.target.value })
                      }
                      className="w-full bg-slate-900 border border-cyan-900/40 rounded-xl px-3 py-2 text-[11px] text-slate-200 outline-none focus:border-cyan-500"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                      Polaridad
                    </span>
                    <select
                      value={node.polarity || "neutral"}
                      onChange={(e) =>
                        updateNode(node.id, {
                          polarity: e.target.value as FindingsInfographicNode["polarity"],
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-200 outline-none focus:border-teal-500 cursor-pointer"
                    >
                      <option value="present">Presente</option>
                      <option value="ruled_out">Descartado</option>
                      <option value="criterion">Criterio</option>
                      <option value="neutral">Neutro</option>
                    </select>
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                      Detalle médico
                    </span>
                    <textarea
                      value={node.detail || ""}
                      onChange={(e) => updateNode(node.id, { detail: e.target.value })}
                      rows={2}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-300 outline-none focus:border-teal-500 resize-y"
                    />
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                      Detalle paciente
                    </span>
                    <textarea
                      value={node.patientDetail || ""}
                      onChange={(e) =>
                        updateNode(node.id, { patientDetail: e.target.value })
                      }
                      rows={2}
                      className="w-full bg-slate-900 border border-cyan-900/40 rounded-xl px-3 py-2 text-[11px] text-slate-300 outline-none focus:border-cyan-500 resize-y"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                      Grupo / estructura
                    </span>
                    <input
                      type="text"
                      value={node.group || ""}
                      onChange={(e) => updateNode(node.id, { group: e.target.value })}
                      placeholder="Ej. vesícula, lóbulo dcho…"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-200 outline-none focus:border-teal-500"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          {!includeInReport && (
            <p className="text-[10px] text-amber-300/90 bg-amber-950/30 border border-amber-800/40 rounded-xl px-3 py-2">
              La infografía está generada pero <strong>no se incluirá en el PDF</strong> hasta que
              actives «Incluir en PDF».
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default FindingsInfographicModule;
