import React, { useMemo, useState } from "react";
import { MapPinned, Crosshair, RefreshCw } from "lucide-react";
import type {
  Atlas3DData,
  ClinicalScorecardData,
  FindingsInfographicData,
} from "../types";
import {
  collectFindingsForMap,
  findingsMapSummary,
  placeFindingsAsAnnotations,
} from "../lib/findingsMap";
import { SuiteImageAnnotationLayer } from "./SuiteImageAnnotationLayer";

interface FindingsMapModuleProps {
  diagnosisAnchor?: string;
  atlasData: Atlas3DData | null;
  setAtlasData: (data: Atlas3DData | null) => void;
  scorecardData?: ClinicalScorecardData | null;
  findingsInfographic?: FindingsInfographicData | null;
}

export const FindingsMapModule: React.FC<FindingsMapModuleProps> = ({
  diagnosisAnchor = "",
  atlasData,
  setAtlasData,
  scorecardData = null,
  findingsInfographic = null,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<string>("");

  const findings = useMemo(
    () =>
      collectFindingsForMap({
        atlasData,
        scorecardData,
        findingsInfographic,
      }),
    [atlasData, scorecardData, findingsInfographic]
  );

  const panels = atlasData?.panels?.filter((p) => p.imageUrl) || [];
  const panelLetter =
    activePanel ||
    panels[0]?.panelLetter ||
    findings[0]?.panelLetter ||
    "A";
  const panel = panels.find((p) => p.panelLetter === panelLetter) || panels[0];

  const handlePlacePins = () => {
    if (!atlasData || !findings.length) return;
    const next = placeFindingsAsAnnotations(atlasData, findings);
    setAtlasData(next);
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
                Mapa de hallazgos sobre Atlas
              </h3>
              <span className="text-[9px] font-black uppercase tracking-widest bg-indigo-950/50 text-indigo-300 border border-indigo-700/40 px-2 py-0.5 rounded">
                Pins 3D
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-xl leading-relaxed">
              Coloca los hallazgos del scorecard / justificación como pines sobre los paneles del
              Atlas. Arrastra tip y etiqueta para afinar.
              {diagnosisAnchor.trim() ? (
                <span className="text-indigo-300/90"> Ancla: «{diagnosisAnchor.trim()}».</span>
              ) : null}
            </p>
          </div>
        </div>
      </div>

      {!atlasData || !panels.length ? (
        <p className="text-[11px] text-indigo-200/90 bg-indigo-950/30 border border-indigo-800/40 rounded-xl px-3 py-2">
          Genera primero el <strong>Atlas 3D</strong> (con al menos un panel con imagen) para mapear
          hallazgos.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePlacePins}
              disabled={!findings.length}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider cursor-pointer"
            >
              <Crosshair className="h-4 w-4" />
              Colocar pines en Atlas
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
            <span className="text-[10px] text-slate-500 font-mono ml-auto">
              {findingsMapSummary(findings)}
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
                      annotations={atlasData.imageAnnotations || []}
                      onChange={(next) =>
                        setAtlasData({ ...atlasData, imageAnnotations: next })
                      }
                      mode="layer"
                      editable
                      selectedId={selectedId}
                      onSelectId={setSelectedId}
                    />
                  </div>
                  <SuiteImageAnnotationLayer
                    panelLetter={panel.panelLetter}
                    annotations={atlasData.imageAnnotations || []}
                    onChange={(next) =>
                      setAtlasData({ ...atlasData, imageAnnotations: next })
                    }
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
