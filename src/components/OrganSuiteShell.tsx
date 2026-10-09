import React, { useState } from "react";
import {
  Activity,
  Sparkles,
  Loader2,
  Check,
  RefreshCw,
  X,
  Layers,
  Trash2,
  Maximize2,
  Wand2,
  FlipHorizontal,
  Edit3,
  Compass,
  Plus,
  Heart,
  Gauge,
  ShieldCheck,
} from "lucide-react";
import { ClinicalScorecardData, SuiteImageAnnotation } from "../types";
import { runBackgroundTask } from "../lib/backgroundTasks";
import { applyScorecardGovernanceToFigurePack } from "../lib/clinicalIntelligence";
import { flipImageDataUrl, swapLateralityLabel } from "../lib/imageFlip";
import { remapAnnotationsPanelLetters } from "../lib/suiteImageAnnotations";
import {
  ORGAN_SUITE_THEMES,
  OrganSuiteConfig,
  OrganSuiteData,
  OrganSuitePanel,
} from "../lib/organSuiteConfig";
import { SuiteImageAnnotationLayer } from "./SuiteImageAnnotationLayer";

export interface OrganSuiteShellProps {
  config: OrganSuiteConfig;
  reportText: string;
  activeProtocol?: string;
  laterality?: string;
  selectedModel?: string;
  data: OrganSuiteData | null;
  setData: (data: OrganSuiteData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
  onClose?: () => void;
  scorecardData?: ClinicalScorecardData | null;
  externalDirectives?: string;
}

/**
 * Shared UI/logic shell for organ 3D suites (Abdomen, Knee, …).
 * Organ-specific copy, APIs, table schema and regen presets come from `config`.
 */
export const OrganSuiteShell: React.FC<OrganSuiteShellProps> = ({
  config,
  reportText,
  activeProtocol,
  laterality,
  selectedModel,
  data,
  setData,
  includeInReport,
  setIncludeInReport,
  onClose,
  scorecardData,
  externalDirectives,
}) => {
  const theme = ORGAN_SUITE_THEMES[config.accent];
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [zoomPanel, setZoomPanel] = useState<OrganSuitePanel | null>(null);
  const [isEditingText, setIsEditingText] = useState(false);
  const [customDirectives, setCustomDirectives] = useState("");
  const [selectedStudyType, setSelectedStudyType] = useState(() =>
    config.detectStudyType(reportText || "", activeProtocol)
  );
  const [selectedLaterality, setSelectedLaterality] = useState(() =>
    laterality && laterality.trim() ? laterality.trim() : "auto"
  );
  const [editingPanelLetter, setEditingPanelLetter] = useState<string | null>(null);
  const [panelDirectives, setPanelDirectives] = useState<Record<string, string>>({});
  const [regeneratingPanelLetter, setRegeneratingPanelLetter] = useState<string | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  React.useEffect(() => {
    if (externalDirectives && externalDirectives.trim()) {
      setCustomDirectives((prev) => {
        if (
          prev.includes("PATOLOGÍA ACTIVA DEL SCORECARD") ||
          prev.includes(config.scorecardMarker)
        ) {
          return externalDirectives.trim();
        }
        if (!prev.trim()) return externalDirectives.trim();
        return prev;
      });
    }
  }, [externalDirectives, config.scorecardMarker]);

  React.useEffect(() => {
    const fromScorecard = config.buildScorecardDirectives(scorecardData || null);
    if (!fromScorecard) return;
    setCustomDirectives((prev) => {
      if (
        !prev.trim() ||
        prev.includes("PATOLOGÍA ACTIVA DEL SCORECARD") ||
        prev.includes(config.scorecardMarker)
      ) {
        return fromScorecard;
      }
      return prev;
    });
  }, [scorecardData, config]);

  const mergeMandatoryDirectives = (extraPanelDirective?: string) => {
    const scorecardDirectives = config.buildScorecardDirectives(scorecardData || null);
    const userExtra = customDirectives.trim();
    const extraIsScorecardEcho =
      !!scorecardDirectives &&
      !!userExtra &&
      (userExtra === scorecardDirectives ||
        userExtra.includes(config.scorecardMarker) ||
        userExtra.includes("PATOLOGÍA ACTIVA DEL SCORECARD"));
    return [
      config.topographyDirective,
      scorecardDirectives,
      extraIsScorecardEcho ? "" : userExtra,
      (extraPanelDirective || "").trim(),
    ]
      .filter(Boolean)
      .join("\n\n");
  };

  const handleGenerate = async () => {
    if (!reportText?.trim()) {
      setErrorMessage(config.noReportError);
      return;
    }
    setIsGenerating(true);
    setErrorMessage(null);
    setGenerationStep(config.analyzingStep);
    try {
      setGenerationStep(config.buildingStep);
      const mergedDirectives = mergeMandatoryDirectives();
      await runBackgroundTask(config.taskId, config.taskTitle, async () => {
        const response = await fetch(config.generateUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportText,
            [config.studyTypeBodyKey]: selectedStudyType,
            laterality: selectedLaterality !== "auto" ? selectedLaterality : undefined,
            customDirectives: mergedDirectives || undefined,
            requestedModel: selectedModel,
          }),
        });
        const resData = await response.json();
        if (!resData.success) {
          throw new Error(resData.error || `Error al generar ${config.title}.`);
        }
        const stamped = applyScorecardGovernanceToFigurePack(
          config.attachSuggestions(resData.data as OrganSuiteData),
          scorecardData || null
        ) as OrganSuiteData;
        setData(stamped);
        setIncludeInReport(true);
      });
    } catch (err: any) {
      console.error(`Error generando ${config.id}:`, err);
      setErrorMessage(err?.message || `Error al procesar ${config.title}.`);
    } finally {
      setIsGenerating(false);
      setGenerationStep("");
    }
  };

  const handleFlipHorizontal = async (panelLetter: string) => {
    if (!data) return;
    const panel = data.panels.find((p) => p.panelLetter === panelLetter);
    if (!panel?.imageUrl) return;
    try {
      const flippedDataUrl = await flipImageDataUrl(panel.imageUrl);
      const updatedPanels = data.panels.map((p) => {
        if (p.panelLetter !== panelLetter) return p;
        return {
          ...p,
          imageUrl: flippedDataUrl,
          isCustomFlipped: !p.isCustomFlipped,
          laterality: swapLateralityLabel(p.laterality) || p.laterality,
        };
      });
      setData({ ...data, panels: updatedPanels });
      if (zoomPanel?.panelLetter === panelLetter) {
        const updated = updatedPanels.find((p) => p.panelLetter === panelLetter);
        if (updated) setZoomPanel(updated);
      }
    } catch (flipErr) {
      console.error("Error al voltear panel:", flipErr);
      setErrorMessage("No se pudo voltear la imagen en espejo.");
    }
  };

  const handleDeleteSinglePanel = (panelLetter: string) => {
    if (!data || data.panels.length <= 1) return;
    const remaining = data.panels.filter((p) => p.panelLetter !== panelLetter);
    const alphabet = ["A", "B", "C", "D", "E", "F"];
    const letterMap: Record<string, string> = {};
    const updatedPanels = remaining.map((p, idx) => {
      const newLetter = alphabet[idx] || String.fromCharCode(65 + idx);
      letterMap[p.panelLetter] = newLetter;
      return { ...p, panelLetter: newLetter };
    });

    let updatedTitle = data.figureTitle;
    if (updatedTitle) {
      if (updatedPanels.length === 1) {
        updatedTitle = updatedTitle
          .replace(/Paneles\s+A\s*(?:y|,)\s*B/gi, "Panel A")
          .replace(/Paneles\s+A,\s*B\s*y\s*C/gi, "Panel A")
          .replace(/\bPaneles\b/gi, "Panel");
      } else if (updatedPanels.length === 2) {
        updatedTitle = updatedTitle.replace(/Paneles\s+A,\s*B\s*y\s*C/gi, "Paneles A y B");
      }
    }

    setPanelDirectives((prev) => {
      const next: Record<string, string> = {};
      for (const letter of Object.keys(prev)) {
        if (letter === panelLetter) continue;
        next[letterMap[letter] || letter] = prev[letter];
      }
      return next;
    });
    if (editingPanelLetter === panelLetter) setEditingPanelLetter(null);
    else if (editingPanelLetter && letterMap[editingPanelLetter]) {
      setEditingPanelLetter(letterMap[editingPanelLetter]);
    }
    if (regeneratingPanelLetter === panelLetter) setRegeneratingPanelLetter(null);
    else if (regeneratingPanelLetter && letterMap[regeneratingPanelLetter]) {
      setRegeneratingPanelLetter(letterMap[regeneratingPanelLetter]);
    }
    if (zoomPanel?.panelLetter === panelLetter) setZoomPanel(null);
    else if (zoomPanel && letterMap[zoomPanel.panelLetter]) {
      const remapped = updatedPanels.find(
        (p) => p.panelLetter === letterMap[zoomPanel.panelLetter]
      );
      if (remapped) setZoomPanel(remapped);
    }

    setData({
      ...data,
      figureTitle: updatedTitle,
      panels: updatedPanels,
      imageAnnotations: remapAnnotationsPanelLetters(
        data.imageAnnotations,
        letterMap,
        panelLetter
      ),
    });
  };

  const setImageAnnotations = (next: SuiteImageAnnotation[]) => {
    if (!data) return;
    setData({ ...data, imageAnnotations: next });
  };

  const handleRegenerateSinglePanel = async (
    panel: OrganSuitePanel,
    explicitDirectiveOverride?: string
  ) => {
    if (!data) return;
    setRegeneratingPanelLetter(panel.panelLetter);
    setErrorMessage(null);
    const directive =
      explicitDirectiveOverride || panelDirectives[panel.panelLetter] || "";
    if (explicitDirectiveOverride) {
      setPanelDirectives((prev) => ({
        ...prev,
        [panel.panelLetter]: explicitDirectiveOverride,
      }));
    }
    const mergedDirectives = mergeMandatoryDirectives(directive);
    try {
      const response = await fetch(config.regenerateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportText,
          [config.studyTypeBodyKey]: selectedStudyType,
          panel,
          laterality: panel.laterality,
          userDirective: directive,
          customDirectives: mergedDirectives || undefined,
          requestedModel: selectedModel,
        }),
      });
      const resData = await response.json();
      if (!resData.success) {
        throw new Error(resData.error || `Error al regenerar panel ${panel.panelLetter}`);
      }
      const updatedPanels = data.panels.map((p) =>
        p.panelLetter === panel.panelLetter ? resData.panel : p
      );
      const stamped = applyScorecardGovernanceToFigurePack(
        { ...data, panels: updatedPanels },
        scorecardData || null
      ) as OrganSuiteData;
      setData(stamped);
      setEditingPanelLetter(null);
      setPanelDirectives((prev) => ({ ...prev, [panel.panelLetter]: "" }));
    } catch (err: any) {
      console.error("Error regenerando panel:", err);
      setErrorMessage(err?.message || "Error al regenerar panel.");
    } finally {
      setRegeneratingPanelLetter(null);
    }
  };

  const strField = (key: string): string => String(data?.[key] ?? "");

  const tableRows = (): Array<Record<string, string>> => {
    const rows = data?.[config.tableProperty];
    return Array.isArray(rows) ? (rows as Array<Record<string, string>>) : [];
  };

  const withTableRows = (rows: Array<Record<string, string>>): OrganSuiteData => {
    if (!data) return data as any;
    return { ...data, [config.tableProperty]: rows };
  };

  const handleAddTableRow = () => {
    if (!data) return;
    setData(withTableRows([...tableRows(), { ...config.newRowDefaults }]));
  };

  const handleDeleteTableRow = (idx: number) => {
    if (!data) return;
    const updated = [...tableRows()];
    updated.splice(idx, 1);
    setData(withTableRows(updated));
  };

  const handleUpdateTableRow = (idx: number, field: string, value: string) => {
    if (!data) return;
    const updated = [...tableRows()];
    updated[idx] = { ...updated[idx], [field]: value };
    setData(withTableRows(updated));
  };

  return (
    <div
      className={`bg-white rounded-xl shadow-lg border ${theme.border} overflow-hidden transition-all duration-300`}
    >
      <div
        className={`bg-gradient-to-r ${theme.headerGrad} px-5 py-4 text-white flex flex-wrap items-center justify-between gap-3`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg border flex items-center justify-center ${theme.iconBox}`}
          >
            <Activity className={`w-5 h-5 ${theme.icon}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base md:text-lg tracking-wide text-white">
                {config.title}
              </h3>
              <span
                className={`${theme.badge} border text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full`}
              >
                {config.badge}
              </span>
            </div>
            <p className={`text-xs ${theme.subtitle}`}>{config.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIncludeInReport(!includeInReport)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              includeInReport
                ? "bg-emerald-500 text-white shadow-sm hover:bg-emerald-600"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600"
            }`}
          >
            <Check className={`w-3.5 h-3.5 ${includeInReport ? "opacity-100" : "opacity-40"}`} />
            {includeInReport ? "Incluido en PDF" : "Excluido de PDF"}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              title="Cerrar vista previa"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="bg-slate-50 border-b border-slate-200 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Heart className={`w-3.5 h-3.5 ${theme.accentIcon}`} />
              {config.studyTypeLabel}
            </label>
            <select
              value={selectedStudyType}
              onChange={(e) => setSelectedStudyType(e.target.value)}
              className={`w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 font-medium ${theme.focusRing} focus:outline-none`}
            >
              {config.studyTypes.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Compass className={`w-3.5 h-3.5 ${theme.accentIcon}`} />
              Lateralidad del Estudio
            </label>
            <select
              value={selectedLaterality}
              onChange={(e) => setSelectedLaterality(e.target.value)}
              className={`w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 font-medium ${theme.focusRing} focus:outline-none`}
            >
              <option value="auto">Detección Automática</option>
              <option value="Bilateral">Bilateral</option>
              <option value="Derecha">Unilateral Derecha</option>
              <option value="Izquierda">Unilateral Izquierda</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Wand2 className={`w-3.5 h-3.5 ${theme.accentIcon}`} />
              Directivas clínicas
              {scorecardData?.criteria?.length ? (
                <span
                  className={`inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded border text-[10px] font-black uppercase tracking-wide ${theme.scoreBadge}`}
                >
                  <ShieldCheck className="w-3 h-3" />
                  {config.scorecardBadge}
                </span>
              ) : (
                <span className="text-slate-400 font-medium normal-case">
                  (adicionales opcionales)
                </span>
              )}
            </label>
            <textarea
              value={customDirectives}
              onChange={(e) => setCustomDirectives(e.target.value)}
              placeholder={config.directivesPlaceholder}
              rows={scorecardData?.criteria?.length ? 5 : 2}
              className={`w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 placeholder-slate-400 ${theme.focusRing} focus:outline-none font-mono leading-relaxed`}
            />
            {scorecardData?.criteria?.length ? (
              <p className={`mt-1 text-[10px] ${theme.scoreHint}`}>{config.scorecardHint}</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-slate-500">
            {data ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                {config.syncedLabel(data.panels?.length || 0)}
              </span>
            ) : (
              config.emptyHint
            )}
          </div>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${theme.btnGrad} text-white rounded-lg text-xs font-bold shadow-md transition-all disabled:opacity-50`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>{generationStep || config.processingLabel}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-white/90" />
                <span>{data ? config.regenerateLabel : config.generateLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {isGenerating && (
        <div className="p-12 text-center space-y-4">
          <div className="relative w-16 h-16 mx-auto">
            <div
              className={`absolute inset-0 rounded-full border-4 ${theme.loadingRing} animate-pulse`}
            />
            <div
              className={`absolute inset-0 rounded-full border-4 ${theme.loadingSpin} border-t-transparent animate-spin`}
            />
            <Activity
              className={`absolute inset-0 m-auto w-6 h-6 ${theme.loadingIcon} animate-bounce`}
            />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">
              {generationStep || config.processingLabel}
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">{config.loadingDetail}</p>
          </div>
        </div>
      )}

      {!isGenerating && data && (
        <div className="p-5 space-y-6">
          <div
            className={`border ${theme.border} bg-slate-50/80 rounded-lg p-3 flex items-center justify-between`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-6 rounded-full ${theme.panelBadge}`} />
              <div>
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  {data.territoryLabel || config.defaultTerritory} •{" "}
                  {data.laterality || "—"}
                </span>
                <h4 className="text-xs font-bold text-slate-800">
                  {data.figureTitle || config.defaultFigureTitle}
                </h4>
              </div>
            </div>
            <button
              onClick={() => setIsEditingText(!isEditingText)}
              className={`text-xs font-semibold flex items-center gap-1 ${theme.editLink}`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              {isEditingText ? "Guardar edición" : "Editar textos"}
            </button>
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className={`w-3.5 h-3.5 ${theme.accentIcon}`} />
                {config.panelsHeading(data.panels?.length || 0)}
              </h4>
              <button
                type="button"
                onClick={() => {
                  const suggested = config.suggestMore(data);
                  if (!suggested.length) return;
                  setData({
                    ...data,
                    imageAnnotations: [...(data.imageAnnotations || []), ...suggested],
                  });
                }}
                className={`text-[10px] font-bold border rounded-lg px-2.5 py-1 ${theme.suggestBtn}`}
                title={config.suggestTitle}
              >
                Sugerir anotaciones desde tabla
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(data.panels || []).map((panel, idx) => (
                <div
                  key={panel.id || idx}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
                >
                  <div className="relative bg-slate-900 aspect-[4/3] group overflow-hidden flex items-center justify-center">
                    {panel.imageUrl ? (
                      <img
                        src={panel.imageUrl}
                        alt={panel.panelTitle}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="text-center p-4 text-slate-400">
                        <Activity className="w-8 h-8 mx-auto mb-1 text-slate-500 opacity-50" />
                        <span className="text-xs">Render no disponible</span>
                      </div>
                    )}

                    {panel.imageUrl && (
                      <SuiteImageAnnotationLayer
                        panelLetter={panel.panelLetter}
                        annotations={data.imageAnnotations || []}
                        onChange={setImageAnnotations}
                        mode="layer"
                        editable
                        selectedId={selectedAnnotationId}
                        onSelectId={setSelectedAnnotationId}
                      />
                    )}

                    <div
                      className={`absolute top-2 left-2 z-10 ${theme.panelBadge} text-white font-bold text-[10px] px-2 py-0.5 rounded shadow`}
                    >
                      PANEL {panel.panelLetter}
                    </div>

                    <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm p-1 rounded-lg">
                      <button
                        onClick={() => handleFlipHorizontal(panel.panelLetter)}
                        className={`p-1 rounded text-white hover:bg-white/20 transition-colors ${
                          panel.isCustomFlipped ? "text-amber-300" : ""
                        }`}
                        title="Invertir en espejo (Flip horizontal)"
                      >
                        <FlipHorizontal className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setZoomPanel(panel)}
                        className="p-1 rounded text-white hover:bg-white/20 transition-colors"
                        title="Ver en pantalla completa"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                      {data.panels.length > 1 && (
                        <button
                          onClick={() => handleDeleteSinglePanel(panel.panelLetter)}
                          className="p-1 rounded text-white hover:bg-rose-500/40 transition-colors"
                          title="Eliminar este panel"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {regeneratingPanelLetter === panel.panelLetter && (
                      <div className="absolute inset-0 z-20 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-white mb-2" />
                        <span className="text-xs font-semibold">Regenerando modelo 3D...</span>
                      </div>
                    )}
                  </div>

                  <div className="p-3 space-y-2">
                    {panel.imageUrl && (
                      <SuiteImageAnnotationLayer
                        panelLetter={panel.panelLetter}
                        annotations={data.imageAnnotations || []}
                        onChange={setImageAnnotations}
                        mode="toolbar"
                        editable
                        selectedId={selectedAnnotationId}
                        onSelectId={setSelectedAnnotationId}
                      />
                    )}
                    <div>
                      {isEditingText ? (
                        <input
                          type="text"
                          value={panel.panelTitle}
                          onChange={(e) => {
                            const updated = data.panels.map((p) =>
                              p.panelLetter === panel.panelLetter
                                ? { ...p, panelTitle: e.target.value }
                                : p
                            );
                            setData({ ...data, panels: updated });
                          }}
                          className="w-full text-xs font-bold text-slate-800 border border-slate-300 rounded px-1.5 py-1 mb-1"
                        />
                      ) : (
                        <h5 className="font-bold text-xs text-slate-900 line-clamp-2">
                          {panel.panelTitle}
                        </h5>
                      )}
                      {isEditingText ? (
                        <textarea
                          rows={3}
                          value={panel.anatomicalFocus}
                          onChange={(e) => {
                            const updated = data.panels.map((p) =>
                              p.panelLetter === panel.panelLetter
                                ? { ...p, anatomicalFocus: e.target.value }
                                : p
                            );
                            setData({ ...data, panels: updated });
                          }}
                          className="w-full text-[11px] text-slate-600 border border-slate-300 rounded px-1.5 py-1"
                        />
                      ) : (
                        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed line-clamp-3">
                          {panel.anatomicalFocus}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      {editingPanelLetter === panel.panelLetter ? (
                        <div className="space-y-2 bg-slate-50 p-2 rounded border border-slate-200">
                          <label className="block text-[10px] font-bold text-slate-700">
                            Directiva de regeneración quirúrgica:
                          </label>
                          <input
                            type="text"
                            value={panelDirectives[panel.panelLetter] || ""}
                            onChange={(e) =>
                              setPanelDirectives((prev) => ({
                                ...prev,
                                [panel.panelLetter]: e.target.value,
                              }))
                            }
                            placeholder={config.regenPlaceholder}
                            className="w-full text-xs text-slate-900 placeholder:text-slate-400 bg-white border border-slate-300 rounded px-2 py-1"
                          />
                          {config.regenPresets?.length ? (
                            <div className="grid grid-cols-2 gap-1">
                              {config.regenPresets.map((preset) => (
                                <button
                                  key={preset.label}
                                  type="button"
                                  disabled={regeneratingPanelLetter === panel.panelLetter}
                                  onClick={() =>
                                    handleRegenerateSinglePanel(panel, preset.directive)
                                  }
                                  className={preset.className}
                                >
                                  {preset.label}
                                </button>
                              ))}
                            </div>
                          ) : null}
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setEditingPanelLetter(null)}
                              className="px-2 py-1 text-[10px] text-slate-600 hover:text-slate-800"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleRegenerateSinglePanel(panel)}
                              disabled={regeneratingPanelLetter === panel.panelLetter}
                              className={`px-2.5 py-1 text-[10px] text-white font-bold rounded flex items-center gap-1 ${theme.regenBtn}`}
                            >
                              <RefreshCw className="w-2.5 h-2.5" />
                              Re-renderizar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingPanelLetter(panel.panelLetter)}
                          className={`w-full py-1 text-[10px] font-semibold rounded flex items-center justify-center gap-1 transition-colors ${theme.regenIdle}`}
                        >
                          <RefreshCw className="w-2.5 h-2.5" />
                          Re-generar este panel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className={`rounded-2xl border ${theme.fichaBorder} bg-gradient-to-br ${theme.fichaGrad} p-4 space-y-5 text-slate-100`}
          >
            <p
              className={`text-[10px] font-mono font-bold uppercase tracking-[0.18em] ${theme.fichaEyebrow}`}
            >
              {config.fichaTitle}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                className={`md:col-span-2 rounded-xl border ${theme.summaryBorder} bg-slate-950/70 p-3`}
              >
                <p
                  className={`text-[10px] font-mono font-black uppercase tracking-widest ${theme.summaryLabel} mb-2`}
                >
                  {config.summaryLabel}
                </p>
                {isEditingText ? (
                  <textarea
                    rows={3}
                    className="w-full text-xs bg-slate-900 border border-slate-700 rounded p-2 text-slate-100"
                    value={strField(config.summaryField)}
                    onChange={(e) =>
                      setData({ ...data, [config.summaryField]: e.target.value })
                    }
                  />
                ) : (
                  <p className="text-[13px] text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {strField(config.summaryField) || "Sin resumen."}
                  </p>
                )}
              </div>
              <div className="min-w-0 rounded-xl border border-slate-700/70 bg-slate-950/70 p-3">
                <p className="text-[10px] font-mono font-black uppercase tracking-widest text-cyan-300 mb-2">
                  {config.morphologyLabel}
                </p>
                {isEditingText ? (
                  <textarea
                    rows={5}
                    className="w-full text-xs bg-slate-900 border border-slate-700 rounded p-2 text-slate-100"
                    value={strField(config.morphologyField)}
                    onChange={(e) =>
                      setData({ ...data, [config.morphologyField]: e.target.value })
                    }
                  />
                ) : (
                  <p className="text-[13px] text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {strField(config.morphologyField) || "Sin notas morfológicas."}
                  </p>
                )}
              </div>
              <div className="min-w-0 rounded-xl border border-slate-700/70 bg-slate-950/70 p-3">
                <p
                  className={`text-[10px] font-mono font-black uppercase tracking-widest ${config.domainStatusAccent} mb-2`}
                >
                  {config.domainStatusLabel}
                </p>
                {isEditingText ? (
                  <textarea
                    rows={5}
                    className="w-full text-xs bg-slate-900 border border-slate-700 rounded p-2 text-slate-100"
                    value={strField(config.domainStatusField)}
                    onChange={(e) =>
                      setData({ ...data, [config.domainStatusField]: e.target.value })
                    }
                  />
                ) : (
                  <p className="text-[13px] text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {strField(config.domainStatusField) || "Sin descripción."}
                  </p>
                )}
              </div>
              {config.hasKeyPoints !== false && (
                <div className="md:col-span-2 rounded-xl border border-emerald-800/40 bg-slate-950/70 p-3">
                  <p
                    className={`text-[10px] font-mono font-black uppercase tracking-widest ${config.keyPointsAccent} mb-2`}
                  >
                    Puntos clave
                  </p>
                  {isEditingText ? (
                    <textarea
                      rows={4}
                      className="w-full text-xs bg-slate-900 border border-slate-700 rounded p-2 text-slate-100"
                      value={(data.keyPoints || []).join("\n")}
                      onChange={(e) =>
                        setData({
                          ...data,
                          keyPoints: e.target.value
                            .split("\n")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="Un punto por línea"
                    />
                  ) : (
                    <ul className="space-y-1.5">
                      {(data.keyPoints || []).length ? (
                        data.keyPoints!.map((kp, i) => (
                          <li key={i} className="text-[13px] text-slate-200 flex gap-2">
                            <span className="text-emerald-400">•</span>
                            <span>{kp}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-[13px] text-slate-400">Sin puntos clave.</li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Gauge className={`w-3.5 h-3.5 ${theme.accentIcon}`} />
                {data.tableTitle || config.defaultTableTitle}
              </h4>
              <button
                onClick={handleAddTableRow}
                className={`text-xs font-semibold flex items-center gap-1 ${theme.editLink}`}
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Fila
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                    {config.tableFields.map((field, i) => {
                      const colKey = `col${i + 1}`;
                      const fromData =
                        data.tableHeaders &&
                        (data.tableHeaders as Record<string, string | undefined>)[colKey];
                      return (
                        <th key={field} className="py-2.5 px-3 whitespace-nowrap">
                          {fromData || config.defaultColumnHeaders[i] || field}
                        </th>
                      );
                    })}
                    <th className="py-2.5 px-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tableRows().map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 1 ? "bg-slate-50/70" : "bg-white"}>
                      {config.tableFields.map((field) => (
                        <td
                          key={field}
                          className={`py-2 px-3 ${
                            field === "location" || field === "structure"
                              ? "font-semibold text-slate-900"
                              : "text-slate-600"
                          }`}
                        >
                          {isEditingText ? (
                            <input
                              type="text"
                              value={row[field] || ""}
                              onChange={(e) =>
                                handleUpdateTableRow(idx, field, e.target.value)
                              }
                              className="w-full text-xs border border-slate-300 rounded px-1.5 py-0.5"
                            />
                          ) : (
                            row[field] || "—"
                          )}
                        </td>
                      ))}
                      <td className="py-2 px-2 text-right">
                        <button
                          onClick={() => handleDeleteTableRow(idx)}
                          className="text-slate-400 hover:text-red-600 transition-colors p-1"
                          title="Eliminar fila"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div
            className={`${theme.synthesisBg} border-l-4 ${theme.synthesisBorder} rounded-r-lg p-4 space-y-1.5`}
          >
            <h4
              className={`text-xs font-bold uppercase tracking-wider ${theme.synthesisTitle}`}
            >
              {data.synthesisTitle || config.defaultSynthesisTitle}
            </h4>
            {isEditingText ? (
              <textarea
                rows={3}
                value={data.morphologicalSynthesis || ""}
                onChange={(e) =>
                  setData({ ...data, morphologicalSynthesis: e.target.value })
                }
                className={`w-full text-xs text-slate-800 border rounded p-2 ${theme.focusRing} focus:outline-none`}
              />
            ) : (
              <p className="text-xs text-slate-700 leading-relaxed">
                {data.morphologicalSynthesis}
              </p>
            )}
          </div>
        </div>
      )}

      {zoomPanel && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setZoomPanel(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-[4/3] bg-black">
              <img
                src={zoomPanel.imageUrl}
                alt={zoomPanel.panelTitle}
                className="w-full h-full object-contain"
              />
              {zoomPanel.imageUrl && (
                <SuiteImageAnnotationLayer
                  panelLetter={zoomPanel.panelLetter}
                  annotations={data?.imageAnnotations || []}
                  onChange={setImageAnnotations}
                  mode="layer"
                  editable
                  selectedId={selectedAnnotationId}
                  onSelectId={setSelectedAnnotationId}
                />
              )}
              <button
                onClick={() => setZoomPanel(null)}
                className="absolute top-4 right-4 z-20 bg-black/60 text-white p-2 rounded-full hover:bg-black transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className={`text-xs font-bold uppercase ${theme.zoomAccent}`}>
                  PANEL {zoomPanel.panelLetter}
                </span>
                <h3 className="text-sm font-bold text-white">{zoomPanel.panelTitle}</h3>
                <p className="text-xs text-slate-300 mt-1">{zoomPanel.anatomicalFocus}</p>
              </div>
              <button
                onClick={() => handleFlipHorizontal(zoomPanel.panelLetter)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
              >
                <FlipHorizontal className="w-4 h-4" />
                {zoomPanel.isCustomFlipped ? "Restaurar vista original" : "Invertir en espejo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
