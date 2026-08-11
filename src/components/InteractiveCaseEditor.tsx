import React from "react";
import { 
  Activity, Layers, Stethoscope, Scale, CheckCircle2, 
  ArrowDown, Plus, Trash2 
} from "lucide-react";
import { CaseAnalysisData, CaseAnalysisElementsConfig } from "../types";
import CaseAnalysisRenderer from "./CaseAnalysisRenderer";

interface InteractiveCaseEditorProps {
  selectedCaseFormat: string;
  editableCaseData: CaseAnalysisData | null;
  setEditableCaseData: React.Dispatch<React.SetStateAction<CaseAnalysisData | null>>;
  caseElements: CaseAnalysisElementsConfig;
  setCaseElements: React.Dispatch<React.SetStateAction<CaseAnalysisElementsConfig>>;
  checkedDetails: boolean[];
  setCheckedDetails: React.Dispatch<React.SetStateAction<boolean[]>>;
  checkedDifferentials: boolean[];
  setCheckedDifferentials: React.Dispatch<React.SetStateAction<boolean[]>>;
  checkedDecisionSteps: boolean[];
  setCheckedDecisionSteps: React.Dispatch<React.SetStateAction<boolean[]>>;
}

export default function InteractiveCaseEditor({
  selectedCaseFormat,
  editableCaseData,
  setEditableCaseData,
  caseElements,
  setCaseElements,
  checkedDetails,
  setCheckedDetails,
  checkedDifferentials,
  setCheckedDifferentials,
  checkedDecisionSteps,
  setCheckedDecisionSteps,
}: InteractiveCaseEditorProps) {
  if (!editableCaseData) return null;

  const getFilteredCaseDataForPreview = () => {
    try {
      const copy = JSON.parse(JSON.stringify(editableCaseData)) as CaseAnalysisData;
      copy.format = selectedCaseFormat as any;
      copy.elementsConfig = {
        ...caseElements,
        includeSonographicDetails: caseElements.includeSonographic && (copy.sonographicPillar?.details?.length ?? 0) > 0,
        includeDiscardedDifferentials: caseElements.includeDifferentials && (copy.diagnostics?.filter((d: any) => d.refutingCriteria).length ?? 0) > 0
      };
      
      // Filter details
      if (copy.sonographicPillar?.details) {
        copy.sonographicPillar.details = copy.sonographicPillar.details.filter((_, i) => checkedDetails[i]);
      }
      // Filter diagnostics
      if (copy.diagnostics) {
        copy.diagnostics = copy.diagnostics.filter((_, i) => checkedDifferentials[i]);
      }
      // Filter decision flow
      if (copy.decisionFlow) {
        copy.decisionFlow = copy.decisionFlow.filter((_, i) => checkedDecisionSteps[i]);
      }
      return copy;
    } catch (e) {
      return editableCaseData;
    }
  };

  const previewData = getFilteredCaseDataForPreview();

  return (
    <div className="bg-slate-950/40 border border-slate-850 rounded-3xl p-5 md:p-6 max-h-[55vh] overflow-y-auto relative scrollbar-thin scrollbar-thumb-slate-800">
      
      {/* OPTION 1: FLUJOGRAMA SEMIOLÓGICO */}
      {selectedCaseFormat === "flujograma_semiologico" && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-slate-800 space-y-6 relative">
          <div className="absolute left-[33px] top-8 bottom-8 w-0.5 border-l border-dashed border-slate-350 z-0" />
          
          {/* Step 1: Hallazgo Ecográfico Principal */}
          <div className={`relative z-10 flex gap-4 items-start transition-all ${caseElements.includeSonographic ? "" : "opacity-45"}`}>
            <div className="h-8 w-8 rounded-full bg-white border border-slate-300 flex items-center justify-center shrink-0 shadow-sm">
              <Activity className="h-4 w-4 text-indigo-500" />
            </div>
            <div className={`flex-1 p-3 rounded-lg border transition-all ${caseElements.includeSonographic ? "bg-white border-slate-200 shadow-sm" : "bg-slate-100 border-dashed border-slate-300 text-slate-400"}`}>
              <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={caseElements.includeSonographic}
                    onChange={(e) => setCaseElements(prev => ({ ...prev, includeSonographic: e.target.checked }))}
                    className="h-4 w-4 rounded bg-white border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-[11px] font-black tracking-wide uppercase text-slate-700">1. HALLAZGO ECOGRÁFICO PRINCIPAL</span>
                </label>
                {!caseElements.includeSonographic && <span className="text-[9px] font-bold text-rose-500 uppercase font-mono bg-rose-50 px-1.5 py-0.5 rounded">Excluido</span>}
              </div>
              {caseElements.includeSonographic && (
                <textarea
                  rows={2}
                  value={editableCaseData.sonographicPillar?.primaryFinding || ""}
                  onChange={(e) => {
                    const pillar = { ...(editableCaseData.sonographicPillar || { primaryFinding: "", details: [], severity: "altered" }) };
                    pillar.primaryFinding = e.target.value;
                    setEditableCaseData({ ...editableCaseData, sonographicPillar: pillar });
                  }}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded text-slate-800 focus:border-indigo-500 focus:ring-0 leading-normal"
                />
              )}
            </div>
          </div>

          {/* Step 2: Características y Hallazgos Secundarios */}
          <div className="relative z-10 flex gap-4 items-start">
            <div className="h-8 w-8 rounded-full bg-white border border-slate-300 flex items-center justify-center shrink-0 shadow-sm">
              <Layers className="h-4 w-4 text-sky-500" />
            </div>
            <div className="flex-1 p-3 rounded-lg border bg-white border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-100">
                <span className="text-[11px] font-black tracking-wide uppercase text-slate-700">2. CARACTERÍSTICAS Y HALLAZGOS SECUNDARIOS</span>
              </div>
              <div className="space-y-2">
                {(editableCaseData.sonographicPillar?.details || []).map((detail, dIdx) => (
                  <div key={dIdx} className={`flex items-start gap-2 p-1.5 rounded transition-all ${checkedDetails[dIdx] ? "bg-slate-50 border border-slate-200" : "bg-slate-100 opacity-50 border border-dashed border-slate-300"}`}>
                    <input 
                      type="checkbox"
                      checked={checkedDetails[dIdx] || false}
                      onChange={(e) => {
                        const updated = [...checkedDetails];
                        updated[dIdx] = e.target.checked;
                        setCheckedDetails(updated);
                      }}
                      className="h-4 w-4 mt-0.5 rounded bg-white border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                    <input 
                      type="text"
                      value={detail}
                      onChange={(e) => {
                        const pillar = { ...(editableCaseData.sonographicPillar || { primaryFinding: "", details: [], severity: "altered" }) };
                        pillar.details[dIdx] = e.target.value;
                        setEditableCaseData({ ...editableCaseData, sonographicPillar: pillar });
                      }}
                      disabled={!checkedDetails[dIdx]}
                      className="w-full text-xs bg-transparent border-none p-0 text-slate-800 focus:ring-0 placeholder-slate-400 font-medium"
                      placeholder="Hallazgo secundario..."
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const pillar = { ...(editableCaseData.sonographicPillar || { primaryFinding: "", details: [], severity: "altered" }) };
                        pillar.details = pillar.details.filter((_, idx) => idx !== dIdx);
                        setEditableCaseData({ ...editableCaseData, sonographicPillar: pillar });
                        setCheckedDetails(prev => prev.filter((_, idx) => idx !== dIdx));
                      }}
                      className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const pillar = { ...(editableCaseData.sonographicPillar || { primaryFinding: "", details: [], severity: "altered" }) };
                    pillar.details = [...(pillar.details || []), ""];
                    setEditableCaseData({ ...editableCaseData, sonographicPillar: pillar });
                    setCheckedDetails(prev => [...prev, true]);
                  }}
                  className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-850 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>Añadir Hallazgo Secundario</span>
                </button>
              </div>
            </div>
          </div>

          {/* Step 3: Integración Clínico-Anatómica */}
          <div className={`relative z-10 flex gap-4 items-start transition-all ${caseElements.includeClinicalCorr ? "" : "opacity-45"}`}>
            <div className="h-8 w-8 rounded-full bg-white border border-slate-300 flex items-center justify-center shrink-0 shadow-sm">
              <Stethoscope className="h-4 w-4 text-emerald-500" />
            </div>
            <div className={`flex-1 p-3 rounded-lg border transition-all ${caseElements.includeClinicalCorr ? "bg-white border-slate-200 shadow-sm" : "bg-slate-100 border-dashed border-slate-300 text-slate-400"}`}>
              <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={caseElements.includeClinicalCorr}
                    onChange={(e) => setCaseElements(prev => ({ ...prev, includeClinicalCorr: e.target.checked }))}
                    className="h-4 w-4 rounded bg-white border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-[11px] font-black tracking-wide uppercase text-slate-700">3. INTEGRACIÓN CLÍNICO-ANATÓMICA</span>
                </label>
                {!caseElements.includeClinicalCorr && <span className="text-[9px] font-bold text-rose-500 uppercase font-mono bg-rose-50 px-1.5 py-0.5 rounded">Excluido</span>}
              </div>
              {caseElements.includeClinicalCorr && (
                <textarea
                  rows={2}
                  value={editableCaseData.clinicalCorrelation || ""}
                  onChange={(e) => setEditableCaseData({ ...editableCaseData, clinicalCorrelation: e.target.value })}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded text-slate-800 focus:border-indigo-500 focus:ring-0 leading-normal"
                />
              )}
            </div>
          </div>

          {/* Step 4: Criterios Descartados */}
          <div className="relative z-10 flex gap-4 items-start">
            <div className="h-8 w-8 rounded-full bg-white border border-slate-300 flex items-center justify-center shrink-0 shadow-sm">
              <Scale className="h-4 w-4 text-rose-500" />
            </div>
            <div className="flex-1 p-3 rounded-lg border bg-white border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-100">
                <span className="text-[11px] font-black tracking-wide uppercase text-slate-700">4. DIAGNÓSTICOS EXCLUIDOS Y CRITERIOS DE DESCARTE</span>
              </div>
              <div className="space-y-3">
                {(editableCaseData.diagnostics || []).map((diag, idx) => {
                  if (idx === 0) return null;
                  return (
                    <div key={idx} className={`p-2.5 rounded border transition-all ${checkedDifferentials[idx] ? "bg-slate-50 border-slate-200" : "bg-slate-100 opacity-40 border-dashed border-slate-300 text-slate-400"}`}>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <label className="flex items-center gap-2 cursor-pointer flex-1">
                          <input 
                            type="checkbox"
                            checked={checkedDifferentials[idx] || false}
                            onChange={(e) => {
                              const updated = [...checkedDifferentials];
                              updated[idx] = e.target.checked;
                              setCheckedDifferentials(updated);
                            }}
                            className="h-4 w-4 rounded bg-white border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                          />
                          <input 
                            type="text"
                            value={diag.name}
                            onChange={(e) => {
                              const diags = [...(editableCaseData.diagnostics || [])];
                              diags[idx] = { ...diags[idx], name: e.target.value };
                              setEditableCaseData({ ...editableCaseData, diagnostics: diags });
                            }}
                            disabled={!checkedDifferentials[idx]}
                            className="bg-transparent border-none p-0 text-xs text-rose-600 font-bold focus:ring-0 focus:outline-none flex-1 font-mono uppercase"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const diags = (editableCaseData.diagnostics || []).filter((_, i) => i !== idx);
                            setEditableCaseData({ ...editableCaseData, diagnostics: diags });
                            setCheckedDifferentials(prev => prev.filter((_, i) => i !== idx));
                          }}
                          className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {checkedDifferentials[idx] && (
                        <input 
                          type="text"
                          value={diag.refutingCriteria || ""}
                          onChange={(e) => {
                            const diags = [...(editableCaseData.diagnostics || [])];
                            diags[idx] = { ...diags[idx], refutingCriteria: e.target.value };
                            setEditableCaseData({ ...editableCaseData, diagnostics: diags });
                          }}
                          className="w-full text-xs p-1.5 bg-white border border-slate-200 rounded text-slate-700 focus:ring-0 focus:border-indigo-500/40"
                          placeholder="Criterio de descarte..."
                        />
                      )}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    const diags = [...(editableCaseData.diagnostics || [])];
                    diags.push({ name: "", refutingCriteria: "", supportingCriteria: "", confirmatoryTest: "", probability: 0 });
                    setEditableCaseData({ ...editableCaseData, diagnostics: diags });
                    setCheckedDifferentials(prev => [...prev, true]);
                  }}
                  className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-850 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>Añadir Diferencial Excluido</span>
                </button>
              </div>
            </div>
          </div>

          {/* Step 5: Conclusión y Juicio Diagnóstico */}
          <div className={`relative z-10 flex gap-4 items-start transition-all ${caseElements.includeDifferentials ? "" : "opacity-45"}`}>
            <div className="h-8 w-8 rounded-full bg-white border border-slate-300 flex items-center justify-center shrink-0 shadow-sm">
              <CheckCircle2 className="h-4 w-4 text-amber-500" />
            </div>
            <div className={`flex-1 p-3 rounded-lg border transition-all ${caseElements.includeDifferentials ? "bg-white border-slate-200 shadow-sm" : "bg-slate-100 border-dashed border-slate-300 text-slate-400"}`}>
              <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={caseElements.includeDifferentials}
                    onChange={(e) => setCaseElements(prev => ({ ...prev, includeDifferentials: e.target.checked }))}
                    className="h-4 w-4 rounded bg-white border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-[11px] font-black tracking-wide uppercase text-slate-700">5. CONCLUSIÓN Y DIAGNÓSTICO DEFINITIVO</span>
                </label>
                {!caseElements.includeDifferentials && <span className="text-[9px] font-bold text-rose-500 uppercase font-mono bg-rose-50 px-1.5 py-0.5 rounded">Excluido</span>}
              </div>
              {caseElements.includeDifferentials && (
                <div className="space-y-3">
                  <input 
                    type="text"
                    value={editableCaseData.diagnostics?.[0]?.name || ""}
                    onChange={(e) => {
                      const diags = [...(editableCaseData.diagnostics || [])];
                      if (diags.length === 0) diags.push({ name: e.target.value, probability: 100, supportingCriteria: "" });
                      else diags[0] = { ...diags[0], name: e.target.value };
                      setEditableCaseData({ ...editableCaseData, diagnostics: diags });
                    }}
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded text-slate-800 font-bold"
                    placeholder="Diagnóstico Principal..."
                  />

                  {/* Recomendación */}
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={caseElements.includeManagement}
                        onChange={(e) => setCaseElements(prev => ({ ...prev, includeManagement: e.target.checked }))}
                        className="h-3.5 w-3.5 rounded bg-white border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                      <span className="text-[10px] font-bold uppercase text-slate-600">B. Conducta y Pruebas Sugeridas</span>
                    </label>
                    {caseElements.includeManagement && (
                      <textarea
                        rows={2}
                        value={editableCaseData.managementRecommendation || ""}
                        onChange={(e) => setEditableCaseData({ ...editableCaseData, managementRecommendation: e.target.value })}
                        className="w-full text-xs p-2 bg-white border border-slate-200 rounded text-slate-700 focus:ring-0"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OPTION 2: FLUJOGRAMA ALGORÍTMICO */}
      {selectedCaseFormat === "flujograma_algoritmico" && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-slate-800 space-y-3">
          {(editableCaseData.decisionFlow || []).map((step, idx) => (
            <React.Fragment key={idx}>
              <div className={`p-3.5 rounded-xl border transition-all ${checkedDecisionSteps[idx] ? "bg-white border-slate-200 shadow-sm" : "bg-slate-100 border-dashed border-slate-300 text-slate-400"}`}>
                <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100">
                  <label className="flex items-center gap-2 cursor-pointer flex-1">
                    <input 
                      type="checkbox"
                      checked={checkedDecisionSteps[idx] || false}
                      onChange={(e) => {
                        const updated = [...checkedDecisionSteps];
                        updated[idx] = e.target.checked;
                        setCheckedDecisionSteps(updated);
                      }}
                      className="h-4 w-4 rounded bg-white border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                    <input 
                      type="text"
                      value={step.title || ""}
                      onChange={(e) => {
                        const flow = [...(editableCaseData.decisionFlow || [])];
                        flow[idx] = { ...flow[idx], title: e.target.value };
                        setEditableCaseData({ ...editableCaseData, decisionFlow: flow });
                      }}
                      disabled={!checkedDecisionSteps[idx]}
                      className="bg-transparent border-none p-0 text-xs font-bold text-indigo-600 focus:ring-0 focus:outline-none flex-1 uppercase font-mono"
                      placeholder={`Paso #${idx + 1}`}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const flow = (editableCaseData.decisionFlow || []).filter((_, i) => i !== idx);
                      setEditableCaseData({ ...editableCaseData, decisionFlow: flow });
                      setCheckedDecisionSteps(prev => prev.filter((_, i) => i !== idx));
                    }}
                    className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {checkedDecisionSteps[idx] && (
                  <textarea
                    rows={2}
                    value={step.desc || ""}
                    onChange={(e) => {
                      const flow = [...(editableCaseData.decisionFlow || [])];
                      flow[idx] = { ...flow[idx], desc: e.target.value };
                      setEditableCaseData({ ...editableCaseData, decisionFlow: flow });
                    }}
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded text-slate-800 focus:ring-0"
                    placeholder="Descripción del paso..."
                  />
                )}
              </div>
              {idx < (editableCaseData.decisionFlow || []).length - 1 && (
                <div className="flex justify-center my-0.5 text-indigo-500">
                  <ArrowDown className="h-4 w-4 animate-bounce" />
                </div>
              )}
            </React.Fragment>
          ))}
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={() => {
                const flow = [...(editableCaseData.decisionFlow || [])];
                flow.push({ step: flow.length + 1, title: "", desc: "" });
                setEditableCaseData({ ...editableCaseData, decisionFlow: flow });
                setCheckedDecisionSteps(prev => [...prev, true]);
              }}
              className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-850 bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-lg shadow-sm cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Añadir Paso Algorítmico</span>
            </button>
          </div>
        </div>
      )}

      {/* OPTION 3: ESQUEMA INTEGRADOR POR PILARES */}
      {selectedCaseFormat === "esquema_pilares" && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Pilar 1 */}
          <div className={`p-4 rounded-xl border transition-all ${caseElements.includeSonographic ? "bg-white border-slate-200 shadow-sm" : "bg-slate-100 border-dashed border-slate-300 text-slate-400"}`}>
            <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={caseElements.includeSonographic}
                  onChange={(e) => setCaseElements(prev => ({ ...prev, includeSonographic: e.target.checked }))}
                  className="h-4 w-4 rounded bg-white border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                />
                <span className="text-[10px] font-black tracking-wide uppercase text-indigo-600 font-mono">PILAR 1 — IMAGENOLÓGICO</span>
              </label>
            </div>
            {caseElements.includeSonographic && (
              <div className="space-y-3">
                <textarea
                  rows={2}
                  value={editableCaseData.sonographicPillar?.primaryFinding || ""}
                  onChange={(e) => {
                    const pillar = { ...(editableCaseData.sonographicPillar || { primaryFinding: "", details: [], severity: "altered" }) };
                    pillar.primaryFinding = e.target.value;
                    setEditableCaseData({ ...editableCaseData, sonographicPillar: pillar });
                  }}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-800"
                />
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Detalles secundarios:</span>
                  {(editableCaseData.sonographicPillar?.details || []).map((detail, dIdx) => (
                    <div key={dIdx} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 p-1 rounded">
                      <input 
                        type="text"
                        value={detail}
                        onChange={(e) => {
                          const pillar = { ...(editableCaseData.sonographicPillar || { primaryFinding: "", details: [], severity: "altered" }) };
                          pillar.details[dIdx] = e.target.value;
                          setEditableCaseData({ ...editableCaseData, sonographicPillar: pillar });
                        }}
                        className="w-full text-xs bg-transparent border-none p-0 text-slate-700 focus:ring-0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Pilar 2 */}
          <div className={`p-4 rounded-xl border transition-all ${caseElements.includeClinicalCorr ? "bg-white border-slate-200 shadow-sm" : "bg-slate-100 border-dashed border-slate-300 text-slate-400"}`}>
            <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={caseElements.includeClinicalCorr}
                  onChange={(e) => setCaseElements(prev => ({ ...prev, includeClinicalCorr: e.target.checked }))}
                  className="h-4 w-4 rounded bg-white border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                />
                <span className="text-[10px] font-black tracking-wide uppercase text-emerald-600 font-mono">PILAR 2 — CORRELACIÓN CLÍNICA</span>
              </label>
            </div>
            {caseElements.includeClinicalCorr && (
              <textarea
                rows={6}
                value={editableCaseData.clinicalCorrelation || ""}
                onChange={(e) => setEditableCaseData({ ...editableCaseData, clinicalCorrelation: e.target.value })}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded text-slate-700"
              />
            )}
          </div>

          {/* Pilar 3 */}
          <div className={`p-4 rounded-xl border transition-all ${caseElements.includeDifferentials ? "bg-white border-slate-200 shadow-sm" : "bg-slate-100 border-dashed border-slate-300 text-slate-400"}`}>
            <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={caseElements.includeDifferentials}
                  onChange={(e) => setCaseElements(prev => ({ ...prev, includeDifferentials: e.target.checked }))}
                  className="h-4 w-4 rounded bg-white border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                />
                <span className="text-[10px] font-black tracking-wide uppercase text-amber-600 font-mono">PILAR 3 — CONCLUSIÓN & DIAGNÓSTICO</span>
              </label>
            </div>
            {caseElements.includeDifferentials && (
              <div className="space-y-3">
                <input 
                  type="text"
                  value={editableCaseData.diagnostics?.[0]?.name || ""}
                  onChange={(e) => {
                    const diags = [...(editableCaseData.diagnostics || [])];
                    if (diags.length === 0) diags.push({ name: e.target.value, probability: 100, supportingCriteria: "" });
                    else diags[0] = { ...diags[0], name: e.target.value };
                    setEditableCaseData({ ...editableCaseData, diagnostics: diags });
                  }}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded font-bold"
                  placeholder="Diagnóstico Principal..."
                />
              </div>
            )}
          </div>

          {/* Pilar 4 */}
          <div className={`p-4 rounded-xl border transition-all ${caseElements.includeManagement ? "bg-white border-slate-200 shadow-sm" : "bg-slate-100 border-dashed border-slate-300 text-slate-400"}`}>
            <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={caseElements.includeManagement}
                  onChange={(e) => setCaseElements(prev => ({ ...prev, includeManagement: e.target.checked }))}
                  className="h-4 w-4 rounded bg-white border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                />
                <span className="text-[10px] font-black tracking-wide uppercase text-purple-600 font-mono">PILAR 4 — CONDUCTA & MANEJO</span>
              </label>
            </div>
            {caseElements.includeManagement && (
              <textarea
                rows={6}
                value={editableCaseData.managementRecommendation || ""}
                onChange={(e) => setEditableCaseData({ ...editableCaseData, managementRecommendation: e.target.value })}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded text-slate-700"
              />
            )}
          </div>
        </div>
      )}

      {/* OPTION 4: MAPA DE DIAGNÓSTICOS DIFERENCIALES */}
      {selectedCaseFormat === "mapa_diferenciales" && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-slate-800 space-y-4">
          
          {/* Central Root Node */}
          <div className="flex flex-col items-center justify-center text-center pb-4 border-b border-slate-200">
            <div className={`px-4 py-2.5 rounded-xl border max-w-md shadow-sm transition-all ${caseElements.includeSonographic ? "bg-indigo-50 border-indigo-200" : "bg-slate-100 border-dashed border-slate-300 text-slate-400"}`}>
              <div className="flex items-center justify-center gap-2 mb-1">
                <input 
                  type="checkbox"
                  checked={caseElements.includeSonographic}
                  onChange={(e) => setCaseElements(prev => ({ ...prev, includeSonographic: e.target.checked }))}
                  className="h-3.5 w-3.5 rounded bg-white border-indigo-300 text-indigo-600 focus:ring-0 cursor-pointer"
                />
                <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest font-mono">Hallazgo Sonográfico Primario</span>
              </div>
              {caseElements.includeSonographic && (
                <input 
                  type="text"
                  value={editableCaseData.sonographicPillar?.primaryFinding || ""}
                  onChange={(e) => {
                    const pillar = { ...(editableCaseData.sonographicPillar || { primaryFinding: "", details: [], severity: "altered" }) };
                    pillar.primaryFinding = e.target.value;
                    setEditableCaseData({ ...editableCaseData, sonographicPillar: pillar });
                  }}
                  className="bg-transparent border-none p-0 text-xs text-center font-bold text-slate-800 focus:ring-0 w-full"
                />
              )}
            </div>
            <div className="h-4 w-0.5 bg-indigo-500"></div>
          </div>

          {/* Radiating Mindmap Nodes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(editableCaseData.diagnostics || []).map((diag, idx) => (
              <div key={idx} className={`p-4 rounded-xl border shadow-sm transition-all ${checkedDifferentials[idx] ? "bg-white border-slate-200" : "bg-slate-100 opacity-40 border-dashed border-slate-300"}`}>
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-3">
                  <div className="flex items-center gap-2 flex-1">
                    <input 
                      type="checkbox"
                      checked={checkedDifferentials[idx] || false}
                      onChange={(e) => {
                        const updated = [...checkedDifferentials];
                        updated[idx] = e.target.checked;
                        setCheckedDifferentials(updated);
                      }}
                      className="h-4 w-4 rounded bg-white border-slate-300 text-teal-600 focus:ring-0 cursor-pointer"
                    />
                    <input 
                      type="text"
                      value={diag.name || ""}
                      onChange={(e) => {
                        const diags = [...(editableCaseData.diagnostics || [])];
                        diags[idx] = { ...diags[idx], name: e.target.value };
                        setEditableCaseData({ ...editableCaseData, diagnostics: diags });
                      }}
                      disabled={!checkedDifferentials[idx]}
                      className="bg-transparent border-none p-0 text-xs font-bold text-slate-800 focus:ring-0 flex-1 font-mono uppercase"
                      placeholder="Diagnóstico Diferencial..."
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const diags = (editableCaseData.diagnostics || []).filter((_, i) => i !== idx);
                      setEditableCaseData({ ...editableCaseData, diagnostics: diags });
                      setCheckedDifferentials(prev => prev.filter((_, i) => i !== idx));
                    }}
                    className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {checkedDifferentials[idx] && (
                  <div className="space-y-2">
                    <div className="bg-emerald-50 border border-emerald-100 p-2 rounded">
                      <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider block mb-1">✓ A Favor (Sonográfico)</span>
                      <input 
                        type="text"
                        value={diag.supportingCriteria || ""}
                        onChange={(e) => {
                          const diags = [...(editableCaseData.diagnostics || [])];
                          diags[idx] = { ...diags[idx], supportingCriteria: e.target.value };
                          setEditableCaseData({ ...editableCaseData, diagnostics: diags });
                        }}
                        className="w-full text-xs bg-white border border-slate-200 rounded p-1 text-slate-700 focus:ring-0"
                      />
                    </div>
                    <div className="bg-rose-50 border border-rose-100 p-2 rounded">
                      <span className="text-[9px] font-black text-rose-500 uppercase tracking-wider block mb-1">✗ En Contra / Ausente</span>
                      <input 
                        type="text"
                        value={diag.refutingCriteria || ""}
                        onChange={(e) => {
                          const diags = [...(editableCaseData.diagnostics || [])];
                          diags[idx] = { ...diags[idx], refutingCriteria: e.target.value };
                          setEditableCaseData({ ...editableCaseData, diagnostics: diags });
                        }}
                        className="w-full text-xs bg-white border border-slate-200 rounded p-1 text-slate-700 focus:ring-0"
                      />
                    </div>
                    <div className="bg-purple-50 border border-purple-100 p-2 rounded">
                      <span className="text-[9px] font-black text-purple-600 uppercase tracking-wider block mb-1">🧪 Test Confirmativo / Conducta</span>
                      <input 
                        type="text"
                        value={diag.confirmatoryTest || ""}
                        onChange={(e) => {
                          const diags = [...(editableCaseData.diagnostics || [])];
                          diags[idx] = { ...diags[idx], confirmatoryTest: e.target.value };
                          setEditableCaseData({ ...editableCaseData, diagnostics: diags });
                        }}
                        className="w-full text-xs bg-white border border-slate-200 rounded p-1 text-slate-700 focus:ring-0 font-semibold"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={() => {
                const diags = [...(editableCaseData.diagnostics || [])];
                diags.push({ name: "", refutingCriteria: "", supportingCriteria: "", confirmatoryTest: "", probability: 50 });
                setEditableCaseData({ ...editableCaseData, diagnostics: diags });
                setCheckedDifferentials(prev => [...prev, true]);
              }}
              className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-850 bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-lg shadow-sm cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Añadir Diagnóstico Diferencial</span>
            </button>
          </div>
        </div>
      )}

      {/* OPTION 5: MATRIZ SEMIÓTICA COMPARATIVA */}
      {selectedCaseFormat === "matriz_semiotica" && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-slate-800 space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-black font-mono uppercase text-slate-800">
                EDITOR DE MATRIZ SEMIÓTICA COMPARATIVA
              </span>
            </div>
            <span className="text-[9px] font-bold uppercase font-mono text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
              Inclusivos vs. Refutadores
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Column 1: Signos Peticionantes (Inclusivos) */}
            <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                <span className="text-xs font-black text-emerald-700 font-mono uppercase flex items-center gap-1.5">
                  ✓ SIGNOS PETICIONANTES (A FAVOR)
                </span>
                <span className="text-[9px] font-bold text-emerald-600">Criterios Inclusivos</span>
              </div>
              <div className="space-y-2">
                {((editableCaseData.semioticMatrix?.requestingSigns?.length 
                  ? editableCaseData.semioticMatrix.requestingSigns 
                  : [
                      ...(editableCaseData.sonographicPillar?.primaryFinding ? [editableCaseData.sonographicPillar.primaryFinding] : []),
                      ...(editableCaseData.sonographicPillar?.details || [])
                    ]
                ) || []).map((sign, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded border border-emerald-200 shadow-sm">
                    <span className="text-emerald-500 font-bold text-xs">•</span>
                    <input 
                      type="text"
                      value={sign}
                      onChange={(e) => {
                        const matrix = { ...(editableCaseData.semioticMatrix || {}) };
                        const currentSigns = matrix.requestingSigns?.length 
                          ? [...matrix.requestingSigns] 
                          : [
                              ...(editableCaseData.sonographicPillar?.primaryFinding ? [editableCaseData.sonographicPillar.primaryFinding] : []),
                              ...(editableCaseData.sonographicPillar?.details || [])
                            ];
                        currentSigns[idx] = e.target.value;
                        matrix.requestingSigns = currentSigns;
                        setEditableCaseData({ ...editableCaseData, semioticMatrix: matrix });
                      }}
                      className="w-full text-xs bg-transparent border-none p-0 text-slate-800 focus:ring-0 font-medium"
                      placeholder="Signo peticionante o hallazgo a favor..."
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const matrix = { ...(editableCaseData.semioticMatrix || {}) };
                        const currentSigns = matrix.requestingSigns?.length 
                          ? [...matrix.requestingSigns] 
                          : [
                              ...(editableCaseData.sonographicPillar?.primaryFinding ? [editableCaseData.sonographicPillar.primaryFinding] : []),
                              ...(editableCaseData.sonographicPillar?.details || [])
                            ];
                        matrix.requestingSigns = currentSigns.filter((_, i) => i !== idx);
                        setEditableCaseData({ ...editableCaseData, semioticMatrix: matrix });
                      }}
                      className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const matrix = { ...(editableCaseData.semioticMatrix || {}) };
                    const currentSigns = matrix.requestingSigns?.length 
                      ? [...matrix.requestingSigns] 
                      : [
                          ...(editableCaseData.sonographicPillar?.primaryFinding ? [editableCaseData.sonographicPillar.primaryFinding] : []),
                          ...(editableCaseData.sonographicPillar?.details || [])
                        ];
                    matrix.requestingSigns = [...currentSigns, ""];
                    setEditableCaseData({ ...editableCaseData, semioticMatrix: matrix });
                  }}
                  className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>Añadir Signo Peticionante</span>
                </button>
              </div>
            </div>

            {/* Column 2: Signos Exclusivos & Criterios de Descarte */}
            <div className="p-4 bg-rose-50/70 border border-rose-200/80 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-rose-200 pb-2">
                <span className="text-xs font-black text-rose-700 font-mono uppercase flex items-center gap-1.5">
                  ✗ SIGNOS EXCLUSIVOS & DESCARTE
                </span>
                <span className="text-[9px] font-bold text-rose-600">Criterios Refutadores</span>
              </div>
              <div className="space-y-2">
                {((editableCaseData.semioticMatrix?.exclusiveSigns?.length 
                  ? editableCaseData.semioticMatrix.exclusiveSigns 
                  : (editableCaseData.diagnostics || []).filter(d => d.refutingCriteria).map(d => `${d.name}: ${d.refutingCriteria}`)
                ) || []).map((sign, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded border border-rose-200 shadow-sm">
                    <span className="text-rose-500 font-bold text-xs">•</span>
                    <input 
                      type="text"
                      value={sign}
                      onChange={(e) => {
                        const matrix = { ...(editableCaseData.semioticMatrix || {}) };
                        const currentSigns = matrix.exclusiveSigns?.length 
                          ? [...matrix.exclusiveSigns] 
                          : (editableCaseData.diagnostics || []).filter(d => d.refutingCriteria).map(d => `${d.name}: ${d.refutingCriteria}`);
                        currentSigns[idx] = e.target.value;
                        matrix.exclusiveSigns = currentSigns;
                        setEditableCaseData({ ...editableCaseData, semioticMatrix: matrix });
                      }}
                      className="w-full text-xs bg-transparent border-none p-0 text-slate-800 focus:ring-0 font-medium"
                      placeholder="Criterio de exclusión o descarte..."
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const matrix = { ...(editableCaseData.semioticMatrix || {}) };
                        const currentSigns = matrix.exclusiveSigns?.length 
                          ? [...matrix.exclusiveSigns] 
                          : (editableCaseData.diagnostics || []).filter(d => d.refutingCriteria).map(d => `${d.name}: ${d.refutingCriteria}`);
                        matrix.exclusiveSigns = currentSigns.filter((_, i) => i !== idx);
                        setEditableCaseData({ ...editableCaseData, semioticMatrix: matrix });
                      }}
                      className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const matrix = { ...(editableCaseData.semioticMatrix || {}) };
                    const currentSigns = matrix.exclusiveSigns?.length 
                      ? [...matrix.exclusiveSigns] 
                      : (editableCaseData.diagnostics || []).filter(d => d.refutingCriteria).map(d => `${d.name}: ${d.refutingCriteria}`);
                    matrix.exclusiveSigns = [...currentSigns, ""];
                    setEditableCaseData({ ...editableCaseData, semioticMatrix: matrix });
                  }}
                  className="flex items-center gap-1 text-[10px] font-bold text-rose-700 hover:text-rose-900 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>Añadir Criterio de Descarte</span>
                </button>
              </div>
            </div>
          </div>

          {/* Veredicto y Conducta */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
            <span className="text-xs font-black text-slate-800 font-mono uppercase block border-b border-slate-100 pb-2">
              SÍNTESIS DIAGNÓSTICA Y CONDUCTA SUGERIDA
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase font-mono block mb-1">
                  Correlación Clínica:
                </label>
                <textarea
                  rows={2}
                  value={editableCaseData.clinicalCorrelation || ""}
                  onChange={(e) => setEditableCaseData({ ...editableCaseData, clinicalCorrelation: e.target.value })}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded text-slate-800 focus:border-indigo-500 focus:ring-0"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={caseElements.includeManagement}
                      onChange={(e) => setCaseElements(prev => ({ ...prev, includeManagement: e.target.checked }))}
                      className="h-3.5 w-3.5 rounded bg-white border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                    <span className="text-[10px] font-bold text-indigo-600 uppercase font-mono">
                      Conducta y Manejo Recomendado:
                    </span>
                  </label>
                  {caseElements.includeManagement ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCaseElements(prev => ({ ...prev, includeManagement: false }));
                        setEditableCaseData({ ...editableCaseData, managementRecommendation: "" });
                      }}
                      className="text-[9px] font-bold text-rose-500 hover:text-rose-700 font-mono flex items-center gap-1 cursor-pointer"
                      title="Eliminar sección de conducta"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Eliminar</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setCaseElements(prev => ({ ...prev, includeManagement: true }));
                      }}
                      className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 font-mono flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Incluir</span>
                    </button>
                  )}
                </div>
                {caseElements.includeManagement ? (
                  <textarea
                    rows={2}
                    value={editableCaseData.managementRecommendation || ""}
                    onChange={(e) => setEditableCaseData({ ...editableCaseData, managementRecommendation: e.target.value })}
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded text-slate-800 focus:border-indigo-500 focus:ring-0 font-medium"
                    placeholder="Escriba la conducta o manejo recomendado..."
                  />
                ) : (
                  <div className="p-2.5 bg-slate-100/70 rounded border border-dashed border-slate-300 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 italic">
                      Sección de conducta y manejo excluida.
                    </span>
                    <button
                      type="button"
                      onClick={() => setCaseElements(prev => ({ ...prev, includeManagement: true }))}
                      className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                    >
                      Añadir Conducta
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {previewData && (
        <div className="mt-8 border-t border-slate-800/80 pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-[11px] font-black uppercase text-indigo-400 tracking-wider font-mono flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400 animate-pulse" />
              Previsualización Exacta del Reporte PDF (Tiempo Real)
            </h5>
            <span className="text-[9px] bg-slate-900 text-slate-400 font-bold px-2 py-0.5 rounded border border-slate-800 font-mono uppercase">
              Renderizado Final
            </span>
          </div>
          <div className="bg-[#0b1219]/90 border border-slate-850 rounded-2xl p-4 select-none">
            <CaseAnalysisRenderer data={previewData} isDarkTheme={true} />
          </div>
        </div>
      )}

    </div>
  );
}
