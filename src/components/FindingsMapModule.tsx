import React, { useEffect, useMemo, useState } from "react";
import { MapPinned, Crosshair, RefreshCw } from "lucide-react";
import type {
  Atlas3DData,
  ClinicalScorecardData,
  FindingsInfographicData,
  FocalLesion3DData,
  SuiteImageAnnotation,
} from "../types";
import {
  collectFindingsForMap,
  findingsMapSummary,
  listFindingsMapCanvases,
  placeFindingsAsAnnotations,
  resolveFindingsMapCanvas,
  type FindingsMapSuiteSource,
} from "../lib/findingsMap";
import { SuiteImageAnnotationLayer } from "./SuiteImageAnnotationLayer";

interface FindingsMapModuleProps {
  diagnosisAnchor?: string;
  atlasData: Atlas3DData | null;
  setAtlasData: (data: Atlas3DData | null) => void;
  focalLesion3dData?: FocalLesion3DData | null;
  setFocalLesion3dData?: (data: FocalLesion3DData | null) => void;
  suiteSources?: FindingsMapSuiteSource[];
  preferredSuiteId?: string | null;
  preferredSuiteLabel?: string | null;
  /** Persist pins onto the active source (focal / suite id / atlas3d). */
  onUpdateSourceAnnotations?: (
    sourceId: string,
    annotations: SuiteImageAnnotation[]
  ) => void;
  scorecardData?: ClinicalScorecardData | null;
  findingsInfographic?: FindingsInfographicData | null;
}

export const FindingsMapModule: React.FC<FindingsMapModuleProps> = ({
  diagnosisAnchor = "",
  atlasData,
  setAtlasData,
  focalLesion3dData = null,
  setFocalLesion3dData,
  suiteSources = [],
  preferredSuiteId = null,
  preferredSuiteLabel = null,
  onUpdateSourceAnnotations,
  scorecardData = null,
  findingsInfographic = null,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<string>("");
  const [forcedSourceId, setForcedSourceId] = useState<string>("");

  const availableCanvases = useMemo(
    () =>
      listFindingsMapCanvases({
        focalLesion3dData,
        atlas3dData: atlasData,
        suiteSources,
      }),
    [focalLesion3dData, atlasData, suiteSources]
  );

  const canvas = useMemo(
    () =>
      resolveFindingsMapCanvas({
        focalLesion3dData,
        atlas3dData: atlasData,
        suiteSources,
        preferredSuiteId,
        forcedSourceId: forcedSourceId || null,
      }),
    [
      focalLesion3dData,
      atlasData,
      suiteSources,
      preferredSuiteId,
      forcedSourceId,
    ]
  );

  // Keep forced source valid when sources change.
  useEffect(() => {
    if (!forcedSourceId) return;
    if (!availableCanvases.some((c) => c.sourceId === forcedSourceId)) {
      setForcedSourceId("");
    }
  }, [availableCanvases, forcedSourceId]);

  const panelLetters = useMemo(
    () => (canvas?.panels || []).map((p) => p.panelLetter),
    [canvas]
  );

  const findings = useMemo(
    () =>
      collectFindingsForMap({
        atlasData,
        scorecardData,
        findingsInfographic,
        panelLetters,
      }),
    [atlasData, scorecardData, findingsInfographic, panelLetters]
  );

  const panels = canvas?.panels || [];
  const panelLetter =
    activePanel ||
    panels[0]?.panelLetter ||
    findings[0]?.panelLetter ||
    "A";
  const panel = panels.find((p) => p.panelLetter === panelLetter) || panels[0];
  const annotations = canvas?.imageAnnotations || [];

  const persistAnnotations = (next: SuiteImageAnnotation[]) => {
    if (!canvas) return;
    const id = canvas.sourceId;
    if (onUpdateSourceAnnotations) {
      onUpdateSourceAnnotations(id, next);
      return;
    }
    if (id === "atlas3d" && atlasData) {
      setAtlasData({ ...atlasData, imageAnnotations: next });
      return;
    }
    if (id === "focal" && focalLesion3dData && setFocalLesion3dData) {
      setFocalLesion3dData({ ...focalLesion3dData, imageAnnotations: next });
    }
  };

  const handlePlacePins = () => {
    if (!canvas || !findings.length) return;
    const next = placeFindingsAsAnnotations(canvas, findings);
    persistAnnotations(next);
    if (!activePanel && findings[0]) setActivePanel(findings[0].panelLetter);
  };

  const handleSelectFinding = (id: string, letter: string) => {
    setSelectedId(`map-pin-${id}`);
    setActivePanel(letter);
  };

  return (
    <div
      id="findings-map-module"
      className="bg-slate-900/95 border-2 border-indigo-500/30 rounded-3xl p-5 md:p-7 shadow-2xl space-y-5 text-slate-100 animate-fadeIn"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-violet-500/10 border border-indigo-500/40 rounded-2xl text-indigo-300 shadow-md shrink-0">
            <MapPinned className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm md:text-base font-black uppercase tracking-wider text-slate-100 font-mono">
                Mapa de hallazgos
              </h3>
              <span className="text-[9px] font-black uppercase tracking-widest bg-indigo-950/50 text-indigo-300 border border-indigo-700/40 px-2 py-0.5 rounded">
                Pins 3D
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-xl leading-relaxed">
              Coloca hallazgos del scorecard / justificación como pines sobre Corte Focal, la suite
              3D del estudio
              {preferredSuiteLabel ? ` («${preferredSuiteLabel}»)` : ""} o el Atlas. Arrastra tip y
              etiqueta para afinar.
              {diagnosisAnchor.trim() ? (
                <span className="text-indigo-300/90"> Ancla: «{diagnosisAnchor.trim()}».</span>
              ) : null}
            </p>
          </div>
        </div>
      </div>

      {!canvas || !panels.length ? (
        <p className="text-[11px] text-indigo-200/90 bg-indigo-950/30 border border-indigo-800/40 rounded-xl px-3 py-2">
          Genera primero el <strong>Corte Focal 3D</strong>, la{" "}
          <strong>suite 3D del estudio</strong>
          {preferredSuiteLabel ? ` (${preferredSuiteLabel})` : ""} o el <strong>Atlas 3D</strong>{" "}
          (con al menos un panel con imagen) para mapear hallazgos.
        </p>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
            <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Fuente imagen
              <select
                value={canvas.sourceId}
                onChange={(e) => {
                  setForcedSourceId(e.target.value);
                  setActivePanel("");
                }}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 outline-none focus:border-indigo-500 cursor-pointer normal-case tracking-normal font-semibold"
              >
                {availableCanvases.map((c) => (
                  <option key={c.sourceId} value={c.sourceId}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handlePlacePins}
              disabled={!findings.length}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider cursor-pointer"
            >
              <Crosshair className="h-4 w-4" />
              Colocar pines en {canvas.label}
            </button>
            <button
              type="button"
              onClick={handlePlacePins}
              disabled={!findings.length}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-700/50 text-indigo-300 hover:bg-indigo-950/40 text-[10px] font-bold uppercase cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reubicar
            </button>
            <span className="text-[10px] text-slate-500 font-mono sm:ml-auto">
              {findingsMapSummary(findings)} · {canvas.label}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400/90">
                Inventario
              </p>
              {findings.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  No hay hallazgos: genera scorecard, justificación o sincroniza overlays del Atlas.
                </p>
              ) : (
                <ul className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                  {findings.map((f) => {
                    const active = selectedId === `map-pin-${f.id}`;
                    return (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectFinding(f.id, f.panelLetter)}
                          className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors cursor-pointer ${
                            active
                              ? "border-indigo-400 bg-indigo-950/50 ring-1 ring-indigo-500/40"
                              : "border-slate-800 bg-slate-950/70 hover:border-indigo-700/50"
                          }`}
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[12px] font-semibold text-slate-100">
                              <span className="font-mono text-indigo-400 mr-1.5">{f.marker}.</span>
                              {f.label}
                            </span>
                            <span className="text-[9px] uppercase tracking-wider text-slate-500 shrink-0">
                              Panel {f.panelLetter}
                            </span>
                          </div>
                          {f.detail && (
                            <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{f.detail}</p>
                          )}
                          <p className="text-[9px] text-slate-600 mt-1 uppercase tracking-wider">
                            {f.source}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="lg:col-span-3 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {panels.map((p) => (
                  <button
                    key={p.panelLetter}
                    type="button"
                    onClick={() => setActivePanel(p.panelLetter)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase cursor-pointer border ${
                      panel?.panelLetter === p.panelLetter
                        ? "bg-indigo-700/40 border-indigo-400 text-indigo-100"
                        : "border-slate-700 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {p.panelLetter}
                  </button>
                ))}
              </div>
              {panel?.imageUrl ? (
                <>
                  <div className="relative rounded-2xl overflow-hidden border border-indigo-500/20 bg-black">
                    <img
                      src={panel.imageUrl}
                      alt={panel.panelTitle || `Panel ${panel.panelLetter}`}
                      className="w-full h-auto block"
                    />
                    <SuiteImageAnnotationLayer
                      panelLetter={panel.panelLetter}
                      annotations={annotations}
                      onChange={persistAnnotations}
                      mode="layer"
                      editable
                      selectedId={selectedId}
                      onSelectId={setSelectedId}
                    />
                  </div>
                  <SuiteImageAnnotationLayer
                    panelLetter={panel.panelLetter}
                    annotations={annotations}
                    onChange={persistAnnotations}
                    mode="toolbar"
                    editable
                    selectedId={selectedId}
                    onSelectId={setSelectedId}
                  />
                </>
              ) : (
                <p className="text-[11px] text-slate-500">Panel sin imagen.</p>
              )}
              {panel && (
                <p className="text-[10px] text-slate-500 truncate">
                  {panel.panelTitle || panel.anatomicalFocus}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FindingsMapModule;
