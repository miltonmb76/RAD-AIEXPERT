import React, { useState } from "react";
import {
  Waypoints,
  Loader2,
  RefreshCw,
  Sparkles,
  Flag,
  GitBranch,
  CheckCircle2,
  XCircle,
  HelpCircle,
  MinusCircle,
  Trophy,
  Zap,
} from "lucide-react";
import {
  ClinicalScorecardData,
  ProtocolDecisionGraphData,
  ProtocolGraphNode,
  ScorecardCriterionStatus,
} from "../types";
import {
  protocolGraphKindLabel,
  protocolGraphStatusLabel,
} from "../lib/scorecardReasoningBridge";
import { scorecardTrafficLabel } from "../lib/clinicalIntelligence";

interface ScorecardReasoningBridgeModuleProps {
  selectedModel: string;
  reportText: string;
  studyType?: string;
  scorecardData: ClinicalScorecardData | null;
  setScorecardData?: (data: ClinicalScorecardData | null) => void;
  graphData: ProtocolDecisionGraphData | null;
  setGraphData: (data: ProtocolDecisionGraphData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
}

const statusVisual = (status?: string) => {
  switch (status) {
    case "met":
      return {
        ring: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300",
        bar: "bg-emerald-500",
        badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
        Icon: CheckCircle2,
      };
    case "not_met":
      return {
        ring: "border-rose-500/50 bg-rose-500/15 text-rose-300",
        bar: "bg-rose-500",
        badge: "bg-rose-500/15 text-rose-300 border-rose-500/40",
        Icon: XCircle,
      };
    case "equivocal":
      return {
        ring: "border-amber-500/50 bg-amber-500/15 text-amber-300",
        bar: "bg-amber-500",
        badge: "bg-amber-500/15 text-amber-300 border-amber-500/40",
        Icon: HelpCircle,
      };
    case "not_mentioned":
      return {
        ring: "border-slate-500/50 bg-slate-500/15 text-slate-300",
        bar: "bg-slate-500",
        badge: "bg-slate-500/15 text-slate-300 border-slate-500/40",
        Icon: MinusCircle,
      };
    case "outcome":
      return {
        ring: "border-teal-500/50 bg-teal-500/15 text-teal-300",
        bar: "bg-teal-500",
        badge: "bg-teal-500/15 text-teal-300 border-teal-500/40",
        Icon: Trophy,
      };
    default:
      return {
        ring: "border-sky-500/50 bg-sky-500/15 text-sky-300",
        bar: "bg-sky-500",
        badge: "bg-sky-500/15 text-sky-300 border-sky-500/40",
        Icon: Flag,
      };
  }
};

function orderedNodes(graph: ProtocolDecisionGraphData): ProtocolGraphNode[] {
  if (!graph.edges?.length) return graph.nodes;
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, string[]>();
  graph.edges.forEach((e) => {
    const list = outgoing.get(e.from) || [];
    list.push(e.to);
    outgoing.set(e.from, list);
  });
  const starts = graph.nodes.filter((n) => n.kind === "start");
  const start = starts[0] || graph.nodes[0];
  if (!start) return graph.nodes;

  const ordered: ProtocolGraphNode[] = [];
  const seen = new Set<string>();
  const queue = [start.id];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = byId.get(id);
    if (node) ordered.push(node);
    (outgoing.get(id) || []).forEach((to) => {
      if (!seen.has(to)) queue.push(to);
    });
  }
  graph.nodes.forEach((n) => {
    if (!seen.has(n.id)) ordered.push(n);
  });
  return ordered;
}

export const ScorecardReasoningBridgeModule: React.FC<ScorecardReasoningBridgeModuleProps> = ({
  selectedModel,
  reportText,
  studyType,
  scorecardData,
  setScorecardData,
  graphData,
  setGraphData,
  includeInReport,
  setIncludeInReport,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!reportText.trim() && !scorecardData) {
      setError("Necesitás un informe o un Scorecard generado primero.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/generate-scorecard-decision-graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: reportText || "",
          studyType: studyType || "",
          scorecard: scorecardData || undefined,
          protocolId: scorecardData?.protocolId || "auto",
        }),
      });
      const json = await response.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || "No se pudo generar el grafo de decisión.");
      }
      setGraphData(json.data as ProtocolDecisionGraphData);
      if (json.scorecard && setScorecardData) {
        setScorecardData(json.scorecard as ClinicalScorecardData);
      }
      setIncludeInReport(true);
    } catch (err: any) {
      console.error("Error generando puente Scorecard→razonamiento:", err);
      setError(err?.message || "Error al generar el grafo de decisión.");
    } finally {
      setIsLoading(false);
    }
  };

  const nodes = graphData ? orderedNodes(graphData) : [];

  return (
    <div
      id="scorecard-reasoning-bridge-module"
      className="bg-slate-900/95 border-2 border-teal-500/30 rounded-3xl p-5 md:p-7 shadow-2xl space-y-5 text-slate-100 animate-fadeIn"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border border-teal-500/40 rounded-2xl text-teal-300 shadow-md">
            <Waypoints className="h-6 w-6 text-teal-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm md:text-base font-black uppercase tracking-wider text-slate-100 font-mono">
                Puente Scorecard → razonamiento
              </h3>
              <span className="text-[9px] font-black uppercase tracking-widest bg-teal-950/50 text-teal-300 border border-teal-700/40 px-2 py-0.5 rounded">
                Protocolo
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-xl">
              Grafo de decisión del protocolo iluminado con criterios del Scorecard (cumplidos, no cumplidos, equívocos).
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={includeInReport}
            onChange={(e) => setIncludeInReport(e.target.checked)}
            className="rounded border-slate-600 bg-slate-800 text-teal-500 focus:ring-teal-500"
          />
          Incluir en PDF
        </label>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="flex-1 text-[11px] text-slate-400 bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2">
          {scorecardData ? (
            <span>
              Scorecard listo: <strong className="text-teal-300">{scorecardData.protocolName}</strong>
              {" · "}
              {scorecardData.scoreMet}/{scorecardData.scoreTotal} · {scorecardData.categoryAssigned}
            </span>
          ) : (
            <span>
              Sin Scorecard aún — se generará junto con el grafo a partir del informe.
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white text-xs font-black uppercase tracking-wider cursor-pointer"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {graphData ? "Regenerar grafo" : "Generar grafo"}
        </button>
        {graphData && (
          <button
            type="button"
            onClick={() => setGraphData(null)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 text-[10px] font-bold uppercase cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Limpiar
          </button>
        )}
      </div>

      {error && (
        <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-800/50 rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      {isLoading && !graphData && (
        <div className="flex items-center gap-3 text-teal-300 text-xs font-mono py-8 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          Mapeando criterios del protocolo al grafo de decisión…
        </div>
      )}

      {graphData && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-teal-500/30 bg-teal-950/20 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-teal-300/80 font-mono">
              {graphData.title}
            </p>
            <p className="text-sm font-bold text-slate-100 mt-1">
              {graphData.protocolName} → {graphData.outcomeLabel || graphData.categoryAssigned}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Criterios positivos: {graphData.scoreMet}/{graphData.scoreTotal}
              {" · "}
              Semáforo: {scorecardTrafficLabel(graphData.trafficLight)}
            </p>
          </div>

          <div className="relative pl-1">
            <div className="absolute left-[22px] top-3 bottom-3 w-px border-l border-dashed border-slate-700 z-0" />
            <div className="space-y-3 relative z-10">
              {nodes.map((node, idx) => {
                const vis = statusVisual(node.status);
                const Icon = node.kind === "start" ? Zap : node.kind === "gate" ? GitBranch : vis.Icon;
                return (
                  <div key={node.id || idx} className="flex gap-3 items-start">
                    <div
                      className={`shrink-0 w-11 h-11 rounded-full border-2 flex items-center justify-center ${vis.ring}`}
                      title={protocolGraphKindLabel(node.kind)}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0 rounded-2xl border border-slate-800 bg-slate-950/70 overflow-hidden">
                      <div className={`h-1 w-full ${vis.bar}`} />
                      <div className="p-3 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${vis.badge}`}>
                            {idx + 1}. {protocolGraphKindLabel(node.kind)}
                          </span>
                          {node.status && (
                            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${vis.badge}`}>
                              {protocolGraphStatusLabel(node.status as ScorecardCriterionStatus | string)}
                            </span>
                          )}
                          {node.weight && (
                            <span className="text-[9px] font-bold uppercase text-slate-500">
                              {node.weight}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-slate-100">{node.label}</p>
                        {node.value && (
                          <p className="text-[11px] text-teal-200/90">Valor: {node.value}</p>
                        )}
                        {node.detail && (
                          <p className="text-[11px] text-slate-400 leading-relaxed">{node.detail}</p>
                        )}
                        {node.evidence && (
                          <p className="text-[10px] text-slate-500 italic">“{node.evidence}”</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {graphData.pathNarrative && (
            <div className="rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono">
                Narrativa del recorrido
              </p>
              <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">{graphData.pathNarrative}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
