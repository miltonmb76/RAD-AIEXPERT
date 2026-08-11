import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Activity,
  Flame,
  ShieldAlert,
  Loader2,
  Check,
  Copy,
  FileText,
  Sliders,
  RotateCcw,
  Sparkles,
  Info,
  ChevronRight,
  TrendingUp,
  Zap,
  Target
} from "lucide-react";

export interface BiomechanicalAxis {
  key: string;
  label: string;
  score: number; // 0 to 10
  level: string; // e.g. "Fisiológico", "Leve", "Moderado", "Severo", "Crítico"
  finding: string;
  justification: string;
}

export interface BiomechanicalRadarData {
  globalLoadIndex: string; // "Baja", "Moderada", "Elevada", "Crítica"
  globalScore: number;
  dominantVector: string;
  radarMode?: string; // "msk" | "visceral" | "oncology" | "rotator_cuff" | "knee_oa" | "cholecystitis" | "hepatic"
  axes: BiomechanicalAxis[];
  clinicalSummary: string;
  recommendation: string;
}

interface BiomechanicalRadarModuleProps {
  selectedModel: string;
  reportText: string;
  studyType?: string;
  onReportUpdated: (newText: string) => void;
  onRadarDataUpdated?: (data: BiomechanicalRadarData | null) => void;
}

const DEFAULT_AXES: BiomechanicalAxis[] = [
  {
    key: "inflamacion",
    label: "Inflamación / Edema",
    score: 0,
    level: "Fisiológico",
    finding: "Sin efusión o edema significativo.",
    justification: "Ausencia de fluido anormal o reacción inflamatoria aguda."
  },
  {
    key: "estructural",
    label: "Compromiso Estructural",
    score: 0,
    level: "Fisiológico",
    finding: "Integridad tisular conservada.",
    justification: "Sin desgarros, rupturas ni soluciones de continuidad."
  },
  {
    key: "biomecanica",
    label: "Inestabilidad Biomecánica",
    score: 0,
    level: "Fisiológico",
    finding: "Ejes dinámicos y congruencia conservada.",
    justification: "Sin signos de sobrecarga ni incongruencia articular."
  },
  {
    key: "vascularizacion",
    label: "Vascularización / Hiperemia",
    score: 0,
    level: "Fisiológico",
    finding: "Señal Doppler dentro de límites normales.",
    justification: "Sin hiperemia perilesional ni neovascularización."
  },
  {
    key: "tension",
    label: "Tensión / Irritación",
    score: 0,
    level: "Fisiológico",
    finding: "Unión miotendinosa sin tracción anómala.",
    justification: "Sin contractura ni respuesta miofascial reactiva."
  },
  {
    key: "cronicidad",
    label: "Cronicidad / Fibrosis",
    score: 0,
    level: "Fisiológico",
    finding: "Patrón fibrilar o tisular habitual.",
    justification: "Sin cambios tendinósicos crónicos ni calcificaciones."
  }
];

export const BiomechanicalRadarModule: React.FC<BiomechanicalRadarModuleProps> = ({
  selectedModel,
  reportText,
  studyType,
  onReportUpdated,
  onRadarDataUpdated
}) => {
  const [data, setData] = useState<BiomechanicalRadarData | null>(null);
  const [axes, setAxes] = useState<BiomechanicalAxis[]>(DEFAULT_AXES);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [injected, setInjected] = useState<boolean>(false);
  const [selectedAxisKey, setSelectedAxisKey] = useState<string | null>(null);
  const [selectedRadarMode, setSelectedRadarMode] = useState<"auto" | "msk" | "visceral" | "oncology" | "rotator_cuff" | "knee_oa" | "cholecystitis" | "hepatic">("auto");

  const handleAnalyze = async (modeOverride?: "auto" | "msk" | "visceral" | "oncology" | "rotator_cuff" | "knee_oa" | "cholecystitis" | "hepatic") => {
    if (!reportText.trim()) {
      setError("El reporte clínico está vacío. Redacta o genera un informe primero.");
      return;
    }

    const modeToUse = modeOverride || selectedRadarMode;
    if (modeOverride) {
      setSelectedRadarMode(modeOverride);
    }

    setIsLoading(true);
    setError(null);
    setInjected(false);

    try {
      const response = await fetch("/api/generate-biomechanical-radar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: reportText,
          studyType: studyType || "",
          radarMode: modeToUse
        })
      });

      const resData = await response.json();
      if (resData.success && resData.data) {
        setData(resData.data);
        if (resData.data.radarMode) {
          setSelectedRadarMode(resData.data.radarMode as any);
        }
        if (resData.data.axes && Array.isArray(resData.data.axes)) {
          setAxes(resData.data.axes);
        }
        if (onRadarDataUpdated) {
          onRadarDataUpdated(resData.data);
        }
      } else {
        setError(resData.error || "No se pudo calcular el Radar Biomecánico.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Error de comunicación con el servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleScoreChange = (index: number, newScore: number) => {
    const updated = [...axes];
    let level = "Fisiológico";
    if (newScore >= 9) level = "Masivo / Crítico";
    else if (newScore >= 7) level = "Severo";
    else if (newScore >= 5) level = "Moderado";
    else if (newScore >= 2) level = "Leve";

    updated[index] = {
      ...updated[index],
      score: newScore,
      level
    };
    setAxes(updated);

    if (data) {
      const avg = +(updated.reduce((acc, a) => acc + a.score, 0) / updated.length).toFixed(1);
      let loadIdx = "Baja";
      if (avg >= 7.5) loadIdx = "Crítica";
      else if (avg >= 5.0) loadIdx = "Elevada";
      else if (avg >= 2.5) loadIdx = "Moderada";

      const updatedData = {
        ...data,
        globalScore: avg,
        globalLoadIndex: loadIdx,
        axes: updated
      };
      setData(updatedData);
      if (onRadarDataUpdated) {
        onRadarDataUpdated(updatedData);
      }
    }
  };

  const calculateGlobalAverage = () => {
    if (axes.length === 0) return 0;
    const sum = axes.reduce((acc, a) => acc + a.score, 0);
    return +(sum / axes.length).toFixed(1);
  };

  const globalAvg = data ? data.globalScore : calculateGlobalAverage();

  const getScoreColor = (score: number) => {
    if (score >= 8) return { text: "text-rose-400", bg: "bg-rose-500/20", border: "border-rose-500/40", stroke: "#f43f5e" };
    if (score >= 6) return { text: "text-amber-400", bg: "bg-amber-500/20", border: "border-amber-500/40", stroke: "#f59e0b" };
    if (score >= 3) return { text: "text-cyan-400", bg: "bg-cyan-500/20", border: "border-cyan-500/40", stroke: "#06b6d4" };
    return { text: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/40", stroke: "#10b981" };
  };

  const generateReportTextSection = () => {
    const avg = globalAvg;
    const dominant = data?.dominantVector || "Perfil Funcional Tisular";
    const summary = data?.clinicalSummary || "Evaluación sinérgica de los vectores de respuesta inflamatoria, daño tisular y respuesta hemodinámica Doppler.";

    let text = `--- RADAR BIOMECÁNICO E INFLAMATORIO ---\n\n`;
    text += `PUNTAJE GLOBAL DE CARGA TISULAR: ${avg} / 10.0 (Carga: ${(data?.globalLoadIndex || "Moderada").toUpperCase()})\n`;
    text += `VECTOR PATOLÓGICO DOMINANTE: ${dominant}\n\n`;
    text += `MATRIZ DE VECTORES CLAVE:\n`;

    axes.forEach(a => {
      text += `• ${a.label.toUpperCase()} [${a.score}/10 - ${a.level.toUpperCase()}]: ${a.finding} (${a.justification})\n`;
    });

    text += `\nSÍNTESIS BIOMECÁNICO-INFLAMATORIA:\n${summary}\n`;

    return text;
  };

  const handleInjectToReport = () => {
    const radarSection = generateReportTextSection();
    if (reportText.includes("--- RADAR BIOMECÁNICO E INFLAMATORIO ---")) {
      const parts = reportText.split("--- RADAR BIOMECÁNICO E INFLAMATORIO ---");
      const before = parts[0].trim();
      const afterParts = parts[1].split("\n\n");
      // keep whatever was after the radar if any, or cleanly replace
      const newFull = before + "\n\n" + radarSection;
      onReportUpdated(newFull);
    } else {
      const newFull = reportText.trim() + "\n\n" + radarSection;
      onReportUpdated(newFull);
    }
    setInjected(true);
    setTimeout(() => setInjected(false), 4000);
  };

  const handleCopyText = () => {
    const radarSection = generateReportTextSection();
    navigator.clipboard.writeText(radarSection);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // SVG Radar calculations
  const svgSize = 320;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const maxRadius = 110;
  const numAxes = axes.length;

  const getCoordinates = (index: number, scoreValue: number) => {
    const angle = (Math.PI * 2 / numAxes) * index - Math.PI / 2;
    const r = (scoreValue / 10) * maxRadius;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    return { x, y, angle };
  };

  // Generate polygon points for radar fill
  const radarPoints = axes
    .map((a, i) => {
      const { x, y } = getCoordinates(i, a.score);
      return `${x},${y}`;
    })
    .join(" ");

  const activeAxisObj = axes.find(a => a.key === selectedAxisKey) || axes[0];

  return (
    <div className="bg-slate-950/90 border-2 border-indigo-500/20 rounded-2xl p-4 md:p-6 shadow-2xl space-y-6 antialiased text-slate-100">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-600/30 to-rose-600/30 border border-indigo-500/40 rounded-xl shadow-inner">
            <Activity className="h-6 w-6 text-indigo-400 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm md:text-base font-black uppercase tracking-wider text-white font-mono">
                Radar Multivectorial Adaptativo 6D (IA)
              </h3>
              <span className="text-[9px] font-black uppercase font-mono tracking-widest bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 px-2 py-0.5 rounded-md">
                7 MATRICES
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Cuantificación multivectorial adaptada: MSK/Osteomuscular, Manguito Rotador, Artrosis Rodilla 6D, Colecistitis Aguda 6D, Valoración Hepática 6D, Visceral e Inflamatorio y Oncológico.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleAnalyze()}
            disabled={isLoading}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer font-mono"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : (
              <Sparkles className="h-4 w-4 text-amber-300" />
            )}
            {isLoading ? "Calculando Radar..." : data ? "Recalcular Radar" : "Analizar Radar IA"}
          </button>
        </div>
      </div>

      {/* MANUAL MODALITY SELECTION RIBBON */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2 flex flex-wrap items-center justify-between gap-3 shadow-inner">
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-300 pl-1">
          <Sliders className="h-4 w-4 text-indigo-400" />
          <span>Matriz Vectorial:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleAnalyze("auto")}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedRadarMode === "auto"
                ? "bg-indigo-600 text-white shadow-md border border-indigo-400/50"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
            }`}
            title="La IA autodetecta la matriz óptima según los hallazgos del reporte"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>Auto (IA)</span>
          </button>

          <button
            type="button"
            onClick={() => handleAnalyze("rotator_cuff")}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedRadarMode === "rotator_cuff"
                ? "bg-teal-600 text-white shadow-md border border-teal-400/50"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
            }`}
          >
            <span>🩹 Manguito Rotador</span>
          </button>

          <button
            type="button"
            onClick={() => handleAnalyze("knee_oa")}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedRadarMode === "knee_oa"
                ? "bg-emerald-600 text-white shadow-md border border-emerald-400/50"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
            }`}
          >
            <span>🦵 Artrosis Rodilla</span>
          </button>

          <button
            type="button"
            onClick={() => handleAnalyze("cholecystitis")}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedRadarMode === "cholecystitis"
                ? "bg-rose-600 text-white shadow-md border border-rose-400/50"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
            }`}
          >
            <span>🫁 Colecistitis Aguda</span>
          </button>

          <button
            type="button"
            onClick={() => handleAnalyze("hepatic")}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedRadarMode === "hepatic"
                ? "bg-amber-600 text-white shadow-md border border-amber-400/50"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
            }`}
          >
            <span>🔬 Valoración Hepática</span>
          </button>

          <button
            type="button"
            onClick={() => handleAnalyze("msk")}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedRadarMode === "msk"
                ? "bg-indigo-600 text-white shadow-md border border-indigo-400/50"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
            }`}
          >
            <span>🦴 Articular / MSK</span>
          </button>

          <button
            type="button"
            onClick={() => handleAnalyze("visceral")}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedRadarMode === "visceral"
                ? "bg-rose-600 text-white shadow-md border border-rose-400/50"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
            }`}
          >
            <span>🫀 Visceral e Inflamatorio</span>
          </button>

          <button
            type="button"
            onClick={() => handleAnalyze("oncology")}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedRadarMode === "oncology"
                ? "bg-amber-600 text-white shadow-md border border-amber-400/50"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
            }`}
          >
            <span>🔬 Oncológico / Tumoral</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: RADAR SPIDER CHART */}
        <div className="lg:col-span-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col items-center justify-center relative min-h-[360px]">
          {/* Badge indicator */}
          <div className="w-full flex items-center justify-between mb-2 px-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-ping"></span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 font-mono">
                Diagrama de Vectores Tisulares
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg text-xs font-mono font-bold">
              <span className="text-slate-400">Puntaje Global:</span>
              <span className={getScoreColor(globalAvg).text}>{globalAvg} / 10</span>
            </div>
          </div>

          {/* SVG RADAR GRAPH */}
          <div className="relative flex items-center justify-center my-2">
            <svg width={svgSize} height={svgSize} className="overflow-visible select-none">
              <defs>
                <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity="0.45" />
                  <stop offset="70%" stopColor="#f43f5e" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="radarStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#818cf8" />
                  <stop offset="50%" stopColor="#f43f5e" />
                  <stop offset="100%" stopColor="#fbbf24" />
                </linearGradient>
              </defs>

              {/* Concentric Guide Hexagons */}
              {[0.2, 0.4, 0.6, 0.8, 1.0].map((scale, levelIdx) => {
                const hexPoints = axes
                  .map((_, i) => {
                    const { x, y } = getCoordinates(i, scale * 10);
                    return `${x},${y}`;
                  })
                  .join(" ");
                return (
                  <polygon
                    key={levelIdx}
                    points={hexPoints}
                    fill="none"
                    stroke="#334155"
                    strokeWidth={levelIdx === 4 ? "1.5" : "0.8"}
                    strokeDasharray={levelIdx < 4 ? "3,3" : "none"}
                    opacity={0.6}
                  />
                );
              })}

              {/* Radial Axis Lines */}
              {axes.map((_, i) => {
                const { x, y } = getCoordinates(i, 10);
                return (
                  <line
                    key={i}
                    x1={cx}
                    y1={cy}
                    x2={x}
                    y2={y}
                    stroke="#334155"
                    strokeWidth="1"
                    opacity={0.7}
                  />
                );
              })}

              {/* Data Filled Polygon */}
              <polygon
                points={radarPoints}
                fill="url(#radarGlow)"
                stroke="url(#radarStroke)"
                strokeWidth="2.5"
                className="transition-all duration-500 ease-out"
              />

              {/* Vertex Dots & Score Labels */}
              {axes.map((a, i) => {
                const { x, y, angle } = getCoordinates(i, a.score);
                const labelRadius = maxRadius + 22;
                const cosVal = Math.cos(angle);
                const sinVal = Math.sin(angle);
                
                let anchor = "middle";
                let lx = cx + labelRadius * cosVal;
                let ly = cy + labelRadius * sinVal;

                if (cosVal > 0.25) {
                  anchor = "start";
                  lx += 4;
                } else if (cosVal < -0.25) {
                  anchor = "end";
                  lx -= 4;
                }

                if (sinVal < -0.8) {
                  ly -= 4;
                } else if (sinVal > 0.8) {
                  ly += 6;
                }

                const isSelected = a.key === selectedAxisKey;
                const colors = getScoreColor(a.score);
                const cleanText = a.label.split(" / ")[0];

                return (
                  <g key={a.key} className="cursor-pointer" onClick={() => setSelectedAxisKey(a.key)}>
                    {/* Glowing outer circle on vertex */}
                    <circle
                      cx={x}
                      cy={y}
                      r={isSelected ? 7 : 5}
                      fill={colors.stroke}
                      stroke="#0f172a"
                      strokeWidth="2"
                      className="transition-all duration-300"
                    />

                    {/* Outer Label */}
                    <text
                      x={lx}
                      y={ly}
                      textAnchor={anchor}
                      dominantBaseline="middle"
                      className={`text-[10px] font-mono font-bold tracking-tight transition-all fill-current ${
                        isSelected ? "fill-white font-black scale-105" : "fill-slate-300 hover:fill-white"
                      }`}
                    >
                      {cleanText}
                    </text>

                    {/* Badge Score over vertex */}
                    <text
                      x={x}
                      y={y - 10}
                      textAnchor="middle"
                      className="text-[9px] font-black font-mono fill-indigo-300"
                    >
                      {a.score}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Scale Legend */}
          <div className="flex items-center gap-3 text-[10px] font-mono font-semibold text-slate-400 mt-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800/80">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500"></span>0-2: Fisiológico</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-cyan-500"></span>3-4: Leve</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500"></span>5-6: Mod</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500"></span>7-10: Sev/Crítico</span>
          </div>
        </div>

        {/* RIGHT COLUMN: AXES SLIDERS & DETAILED BREAKDOWN */}
        <div className="lg:col-span-6 space-y-4">
          {/* Dominant Vector Card */}
          {data && (
            <div className="bg-gradient-to-r from-indigo-950/60 to-rose-950/40 border border-indigo-500/30 rounded-xl p-3.5 space-y-1.5 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-black uppercase text-indigo-300 tracking-wider flex items-center gap-1">
                  <Target className="h-3.5 w-3.5 text-rose-400" /> Vector Dominante
                </span>
                <span className={`text-[9.5px] font-mono font-black uppercase px-2 py-0.5 rounded border ${
                  data.globalLoadIndex === "Crítica" ? "bg-rose-950/80 text-rose-300 border-rose-800" :
                  data.globalLoadIndex === "Elevada" ? "bg-amber-950/80 text-amber-300 border-amber-800" :
                  "bg-indigo-950/80 text-indigo-300 border-indigo-800"
                }`}>
                  Carga {data.globalLoadIndex}
                </span>
              </div>
              <p className="text-xs md:text-sm font-black text-white font-sans">
                {data.dominantVector}
              </p>
            </div>
          )}

          {/* Interactive Sliders for 6 Axes */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-indigo-400" />
                Ajuste Manual de Vectores (0-10)
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Modificable en tiempo real</span>
            </div>

            <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
              {axes.map((a, idx) => {
                const colors = getScoreColor(a.score);
                const isSelected = a.key === selectedAxisKey;

                return (
                  <div
                    key={a.key}
                    onClick={() => setSelectedAxisKey(a.key)}
                    className={`p-2 rounded-xl transition-all border ${
                      isSelected
                        ? "bg-indigo-950/40 border-indigo-500/50 shadow-inner"
                        : "bg-slate-950/50 border-slate-800/60 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-200 font-sans text-[11px] flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${colors.bg} ${colors.border}`}></span>
                        {a.label}
                      </span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className={`text-[10px] font-bold ${colors.text}`}>{a.level}</span>
                        <span className="text-xs font-black text-white bg-slate-900 border border-slate-800 px-1.5 py-0.2 rounded">
                          {a.score}/10
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="1"
                        value={a.score}
                        onChange={(e) => handleScoreChange(idx, parseInt(e.target.value, 10))}
                        className="w-full accent-indigo-500 bg-slate-800 rounded-lg h-1.5 cursor-pointer"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* All Vectors Details Grid */}
          {data && data.axes && data.axes.length > 0 && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-2">
              <span className="text-[10px] font-mono font-bold text-indigo-300 uppercase flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                <Info className="h-3.5 w-3.5 text-indigo-400" /> Detalle y Justificación de los Vectores
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                {data.axes.map((axis, idx) => (
                  <div key={idx} className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 space-y-1">
                    <div className="flex items-start justify-between gap-1.5 border-b border-slate-800/80 pb-1">
                      <span className="text-[11px] font-bold text-slate-200 font-sans leading-tight min-w-0 flex-1">
                        {idx + 1}. {axis.label}
                      </span>
                      <span className={`text-[10px] font-mono font-bold shrink-0 whitespace-nowrap ${getScoreColor(axis.score).text}`}>
                        ({axis.level})
                      </span>
                    </div>
                    {axis.finding && (
                      <p className="text-[10.5px] text-slate-300 leading-snug">
                        <strong className="text-white">Hallazgo:</strong> {axis.finding}
                      </p>
                    )}
                    {axis.justification && axis.justification !== axis.finding && (
                      <p className="text-[10px] text-slate-400 italic leading-snug">
                        <strong className="text-slate-300 not-italic">Justificación:</strong> {axis.justification}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Clinical Summary Box (Without Recommendations) */}
      {data && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-1.5 w-full max-w-full box-border min-w-0 overflow-hidden">
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-indigo-400" /> Síntesis Biomecánico-Inflamatoria Final
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed font-sans w-full max-w-full box-border break-words whitespace-normal overflow-wrap-anywhere m-0">
            {data.clinicalSummary}
          </p>
        </div>
      )}

      {/* Action Footer Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
        <div className="flex items-center gap-2">
          <button
            onClick={handleInjectToReport}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer ${
              injected
                ? "bg-emerald-600 text-white border border-emerald-400"
                : "bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white border border-indigo-400/40"
            }`}
          >
            {injected ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
            {injected ? "Anexo Inyectado al Reporte" : "Inyectar Anexo al Reporte PDF"}
          </button>

          <button
            onClick={handleCopyText}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 px-3 py-2.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiado!" : "Copiar Matriz"}
          </button>
        </div>

        <span className="text-[10px] text-slate-500 font-mono">
          Formato homologado para inclusión automática en informes y PDFs oficiales.
        </span>
      </div>
    </div>
  );
};

export default BiomechanicalRadarModule;
