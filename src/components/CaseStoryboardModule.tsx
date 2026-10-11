import React, { useMemo, useState } from "react";
import {
  Clapperboard,
  Loader2,
  Sparkles,
  RefreshCw,
  Pencil,
  Stethoscope,
  HeartHandshake,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type {
  CaseStoryboardAudience,
  CaseStoryboardData,
  CaseStoryboardFrame,
  ClinicalScorecardData,
  UsPlaneSimulatorData,
} from "../types";
import {
  attachStoryboardImages,
  caseStoryboardIsRenderable,
  normalizeCaseStoryboardData,
  seedCaseStoryboardFromContext,
  storyboardFrameCopy,
} from "../lib/caseStoryboard";

interface CaseStoryboardModuleProps {
  selectedModel: string;
  reportText: string;
  studyType?: string;
  clinicalHistory?: string;
  diagnosisAnchor?: string;
  scorecardData?: ClinicalScorecardData | null;
  usPlaneData?: UsPlaneSimulatorData | null;
  galleryImages?: Array<{
    id: string;
    url: string;
    label?: string;
    caption?: string;
    isSelected?: boolean;
  }>;
  storyboardData: CaseStoryboardData | null;
  setStoryboardData: (data: CaseStoryboardData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (v: boolean) => void;
}

const ROLE_CHIP: Record<string, string> = {
  context: "01",
  finding: "02",
  anatomy3d: "03",
  justification: "04",
  impression: "05",
  custom: "·",
};

export const CaseStoryboardModule: React.FC<CaseStoryboardModuleProps> = ({
  selectedModel,
  reportText,
  studyType,
  clinicalHistory,
  diagnosisAnchor = "",
  scorecardData = null,
  usPlaneData = null,
  galleryImages = [],
  storyboardData,
  setStoryboardData,
  includeInReport,
  setIncludeInReport,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const audience: CaseStoryboardAudience =
    storyboardData?.activeAudience === "patient" ? "patient" : "clinician";

  const galleryPick = useMemo(() => {
    const list = galleryImages.filter((g) => g?.url);
    if (!list.length) return null;
    const scored = [...list].sort(
      (a, b) =>
        (b.isSelected ? 4 : 0) +
        (String(b.caption || "").trim() ? 2 : 0) -
        ((a.isSelected ? 4 : 0) + (String(a.caption || "").trim() ? 2 : 0))
    );
    return scored[0];
  }, [galleryImages]);

  const enrich = (raw: CaseStoryboardData) =>
    attachStoryboardImages(raw, {
      usPlaneData,
      galleryUrl: galleryPick?.url,
      galleryCaption: galleryPick?.caption || galleryPick?.label,
    });

  const handleGenerate = async () => {
    if (!reportText.trim()) {
      setError("El informe está vacío. Genera o redacta un informe primero.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/generate-case-storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: reportText,
          studyType: studyType || "",
          clinicalHistory: clinicalHistory || "",
          diagnosis: diagnosisAnchor || scorecardData?.categoryAssigned || "",
          scorecardCategory: scorecardData?.categoryAssigned || "",
          scorecardSummary: scorecardData?.clinicalSummary || "",
          scorecardRecommendation: scorecardData?.recommendation || "",
          lesionTarget: usPlaneData?.lesionTarget || "",
          planeLabel: usPlaneData?.planeLabelEs || "",
        }),
      });
      const json = await response.json();
      if (!response.ok || !json?.success || !json?.data) {
        throw new Error(json?.error || "No se pudo generar el storyboard.");
      }
      const normalized = enrich(
        normalizeCaseStoryboardData(json.data, {
          diagnosis: diagnosisAnchor || scorecardData?.categoryAssigned,
        })
      );
      if (!caseStoryboardIsRenderable(normalized)) {
        throw new Error("La IA no devolvió viñetas utilizables.");
      }
      setStoryboardData(normalized);
      setIncludeInReport(true);
    } catch (e: any) {
      // Soft fallback so the UX still lands
      const seeded = enrich(
        seedCaseStoryboardFromContext({
          studyType,
          clinicalHistory,
          diagnosisAnchor,
          scorecardData,
        })
      );
      if (caseStoryboardIsRenderable(seeded)) {
        setStoryboardData({
          ...seeded,
          title: seeded.title || "Storyboard del caso",
        });
        setIncludeInReport(true);
        setError(
          `${e?.message || "Error de generación"}. Se armó un borrador editable con los datos del caso.`
        );
      } else {
        setError(e?.message || "Error al generar el storyboard.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const setAudience = (next: CaseStoryboardAudience) => {
    if (!storyboardData) return;
    setStoryboardData({ ...storyboardData, activeAudience: next });
  };

  const updateFrame = (id: string, patch: Partial<CaseStoryboardFrame>) => {
    if (!storyboardData) return;
    setStoryboardData({
      ...storyboardData,
      frames: storyboardData.frames.map((f) =>
        f.id === id ? { ...f, ...patch } : f
      ),
    });
  };

  const frames = storyboardData?.frames || [];
  const heroDx =
    audience === "patient"
      ? storyboardData?.patientDiagnosis || storyboardData?.diagnosis
      : storyboardData?.diagnosis || storyboardData?.patientDiagnosis;

  return (
    <div
      id="case-storyboard-module"
      className="relative overflow-hidden rounded-3xl border border-teal-500/25 bg-[#061820] text-slate-100 shadow-2xl"
    >
      {/* Atmosphere */}
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 10% 0%, rgba(45,212,191,0.18), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 20%, rgba(251,146,60,0.12), transparent 50%), linear-gradient(180deg, #07202a 0%, #061820 45%, #041018 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, transparent, transparent 11px, rgba(255,255,255,0.35) 11px, rgba(255,255,255,0.35) 12px)",
        }}
      />

      <div className="relative p-5 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-3 rounded-2xl bg-teal-400/10 border border-teal-300/30 text-teal-200 shadow-lg shadow-teal-950/40">
              <Clapperboard className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.28em] uppercase text-teal-300/80 mb-1">
                Secuencia narrativa
              </p>
              <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-white font-[Georgia,Cambria,serif]">
                Storyboard del caso
              </h3>
              <p className="text-[12px] text-slate-300/90 mt-1 max-w-xl leading-relaxed">
                5 viñetas que cuentan el estudio: contexto → hallazgo → anatomía 3D →
                justificación → impresión. Un tono para el médico, otro para el paciente.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none px-3 py-2 rounded-xl bg-black/20 border border-white/10">
              <input
                type="checkbox"
                checked={includeInReport && caseStoryboardIsRenderable(storyboardData)}
                onChange={(e) => setIncludeInReport(e.target.checked)}
                disabled={!caseStoryboardIsRenderable(storyboardData)}
                className="rounded border-slate-600 bg-slate-800 text-teal-500 focus:ring-teal-500 disabled:opacity-40"
              />
              Incluir en PDF
            </label>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isLoading || !reportText.trim()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-slate-950 shadow-lg shadow-teal-900/40 disabled:opacity-40 transition-all"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : storyboardData ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isLoading ? "Creando…" : storyboardData ? "Regenerar" : "Generar storyboard"}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-[11px] text-amber-200 bg-amber-950/40 border border-amber-700/40 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {storyboardData && caseStoryboardIsRenderable(storyboardData) && (
          <>
            {/* Audience + diagnosis strip */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-orange-300/80 font-semibold mb-1">
                  {audience === "patient" ? "Para el paciente" : "Para el clínico"}
                </p>
                <h4 className="text-lg md:text-xl font-[Georgia,Cambria,serif] text-white leading-snug max-w-2xl">
                  {heroDx ||
                    (audience === "patient"
                      ? storyboardData.patientTitle
                      : storyboardData.title)}
                </h4>
                {storyboardData.studyRegion && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    {storyboardData.studyRegion}
                  </p>
                )}
              </div>

              <div className="inline-flex p-1 rounded-2xl bg-black/35 border border-white/10">
                <button
                  type="button"
                  onClick={() => setAudience("clinician")}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${
                    audience === "clinician"
                      ? "bg-teal-500 text-slate-950 shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Stethoscope className="h-3.5 w-3.5" />
                  Clínico
                </button>
                <button
                  type="button"
                  onClick={() => setAudience("patient")}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${
                    audience === "patient"
                      ? "bg-orange-400 text-slate-950 shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <HeartHandshake className="h-3.5 w-3.5" />
                  Paciente
                </button>
              </div>
            </div>

            {/* Film strip */}
            <div className="relative">
              <div className="absolute left-4 right-4 top-[2.15rem] h-px bg-gradient-to-r from-transparent via-teal-400/50 to-transparent hidden md:block" />
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 md:gap-3.5">
                <AnimatePresence mode="popLayout">
                  {frames.map((frame, idx) => {
                    const copy = storyboardFrameCopy(frame, audience);
                    const isEditing = editingId === frame.id;
                    const accent =
                      audience === "patient"
                        ? "from-orange-400/20 to-transparent border-orange-400/35"
                        : "from-teal-400/20 to-transparent border-teal-400/35";
                    return (
                      <motion.article
                        key={frame.id}
                        layout
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.07, duration: 0.35 }}
                        className={`group relative flex flex-col rounded-2xl border bg-gradient-to-b ${accent} bg-black/25 backdrop-blur-sm overflow-hidden min-h-[220px] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30 transition-all duration-300`}
                      >
                        <div className="flex items-center justify-between px-3 pt-3">
                          <span
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-black tracking-wider ${
                              audience === "patient"
                                ? "bg-orange-400 text-slate-950"
                                : "bg-teal-400 text-slate-950"
                            }`}
                          >
                            {ROLE_CHIP[frame.role] || String(frame.step).padStart(2, "0")}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingId(isEditing ? null : frame.id)
                            }
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                            title="Editar viñeta"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {frame.imageUrl ? (
                          <div className="mx-3 mt-2 rounded-xl overflow-hidden border border-white/10 bg-slate-950 aspect-[4/3]">
                            <img
                              src={frame.imageUrl}
                              alt={copy.title}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            />
                          </div>
                        ) : (
                          <div className="mx-3 mt-2 rounded-xl border border-dashed border-white/10 bg-white/[0.03] aspect-[4/3] flex items-center justify-center">
                            <span className="text-[10px] uppercase tracking-widest text-slate-500 px-3 text-center">
                              {frame.role === "finding"
                                ? "Eco (genera Bridge US–3D)"
                                : frame.role === "anatomy3d"
                                  ? "Corte 3D (Bridge)"
                                  : "Viñeta narrativa"}
                            </span>
                          </div>
                        )}

                        <div className="p-3.5 flex-1 flex flex-col gap-1.5">
                          {isEditing ? (
                            <>
                              <input
                                value={
                                  audience === "patient"
                                    ? frame.patientTitle
                                    : frame.clinicianTitle
                                }
                                onChange={(e) =>
                                  updateFrame(
                                    frame.id,
                                    audience === "patient"
                                      ? { patientTitle: e.target.value }
                                      : { clinicianTitle: e.target.value }
                                  )
                                }
                                className="w-full bg-black/40 border border-white/15 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-white outline-none focus:border-teal-400"
                              />
                              <textarea
                                value={
                                  audience === "patient"
                                    ? frame.patientBody
                                    : frame.clinicianBody
                                }
                                onChange={(e) =>
                                  updateFrame(
                                    frame.id,
                                    audience === "patient"
                                      ? { patientBody: e.target.value }
                                      : { clinicianBody: e.target.value }
                                  )
                                }
                                rows={3}
                                className="w-full bg-black/40 border border-white/15 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 outline-none focus:border-teal-400 resize-none"
                              />
                            </>
                          ) : (
                            <>
                              <h5 className="text-[13px] font-semibold text-white leading-snug font-[Georgia,Cambria,serif]">
                                {copy.title}
                              </h5>
                              <p className="text-[11.5px] text-slate-300/95 leading-relaxed">
                                {copy.body}
                              </p>
                            </>
                          )}
                          {frame.imageCaption && (
                            <p className="mt-auto pt-2 text-[9px] uppercase tracking-wider text-slate-500">
                              {frame.imageCaption}
                            </p>
                          )}
                        </div>
                      </motion.article>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-[10px] text-slate-400">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={storyboardData.includeClinicianInPdf !== false}
                  onChange={(e) =>
                    setStoryboardData({
                      ...storyboardData,
                      includeClinicianInPdf: e.target.checked,
                    })
                  }
                  className="rounded border-slate-600 bg-slate-800 text-teal-500"
                />
                PDF tono clínico
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={storyboardData.includePatientInPdf !== false}
                  onChange={(e) =>
                    setStoryboardData({
                      ...storyboardData,
                      includePatientInPdf: e.target.checked,
                    })
                  }
                  className="rounded border-slate-600 bg-slate-800 text-orange-400"
                />
                PDF tono paciente
              </label>
            </div>
          </>
        )}

        {!storyboardData && !isLoading && (
          <div className="rounded-2xl border border-dashed border-teal-500/25 bg-black/20 px-5 py-10 text-center">
            <p className="font-[Georgia,Cambria,serif] text-lg text-teal-100/90">
              Una película corta de su caso
            </p>
            <p className="text-[12px] text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
              Genera el storyboard cuando tengas el informe. Si ya existe Bridge US–3D,
              las viñetas de hallazgo y anatomía mostrarán eco real + corte 3D.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CaseStoryboardModule;
