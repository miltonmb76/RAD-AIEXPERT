import React, { useState, useEffect } from "react";
import { 
  Activity, 
  RefreshCw, 
  Sparkles, 
  Check, 
  HelpCircle, 
  AlertTriangle,
  RotateCcw
} from "lucide-react";

interface BreastAnatomyViewerProps {
  selectedModel?: string;
  generatedReport: string;
  onChangeReport?: (newReport: string) => void;
  onExportTable: (tableText: string) => void;
  onExportNarrative?: (narrativeText: string) => void;
  includeInReport?: boolean;
  setIncludeInReport?: (val: boolean) => void;
  onChangeStates?: (states: Record<string, string>) => void;
  onChangeDescriptions?: (descriptions: Record<string, string>) => void;
}

export default function BreastAnatomyViewer({
  selectedModel,
  generatedReport,
  onChangeReport,
  onExportTable,
  onExportNarrative,
  includeInReport = true,
  setIncludeInReport,
  onChangeStates,
  onChangeDescriptions
}: BreastAnatomyViewerProps) {
  
  // Breast structures state:
  // - "no_descrito": Omitted from table/diagrams
  // - "normal": Within normal limits (not included in the findings table)
  // - "hallazgo": Active pathologic finding (included in table)
  // Two breasts: Right (md_) and Left (mi_)
  const initialKeys = [
    // Right Breast
    "md_eje1", "md_eje2", "md_eje3", "md_eje4", "md_eje5", "md_eje6", 
    "md_eje7", "md_eje8", "md_eje9", "md_eje10", "md_eje11", "md_eje12",
    "md_retroareolar", "md_cola_spence", "md_axila",
    // Left Breast
    "mi_eje1", "mi_eje2", "mi_eje3", "mi_eje4", "mi_eje5", "mi_eje6", 
    "mi_eje7", "mi_eje8", "mi_eje9", "mi_eje10", "mi_eje11", "mi_eje12",
    "mi_retroareolar", "mi_cola_spence", "mi_axila"
  ];

  const [states, setStates] = useState<Record<string, string>>(() => {
    const s: Record<string, string> = {};
    initialKeys.forEach(k => {
      s[k] = "no_descrito";
    });
    return s;
  });

  const [customDescriptions, setCustomDescriptions] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    initialKeys.forEach(k => {
      d[k] = "";
    });
    return d;
  });

  const [activeHover, setActiveHover] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<string>("md_retroareolar");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [lastSyncedReport, setLastSyncedReport] = useState<string>("");

  useEffect(() => {
    if (onChangeStates) {
      onChangeStates(states);
    }
  }, [states, onChangeStates]);

  useEffect(() => {
    if (onChangeDescriptions) {
      onChangeDescriptions(customDescriptions);
    }
  }, [customDescriptions, onChangeDescriptions]);

  const getStructureLabel = (id: string): string => {
    const isRight = id.startsWith("md_");
    const name = id.replace("md_", "").replace("mi_", "");
    const side = isRight ? "Mama Derecha" : "Mama Izquierda";

    if (name.startsWith("eje")) {
      const idx = name.replace("eje", "");
      return `${side} - Eje ${idx}`;
    }
    if (name === "retroareolar") {
      return `${side} - Región Retroareolar`;
    }
    if (name === "cola_spence") {
      return `${side} - Cola de Spence`;
    }
    if (name === "axila") {
      return `${side} - Región Axilar`;
    }
    return id;
  };

  // Helper keyword matcher
  const getStructureKeywords = (id: string): { primary: string[]; contexts: string[] } => {
    const isRight = id.startsWith("md_");
    const name = id.replace("md_", "").replace("mi_", "");
    
    // Primary keywords for identifying sub-regions
    let primary: string[] = [];
    if (name.startsWith("eje")) {
      const num = name.replace("eje", "");
      primary = [
        `eje ${num}`, `eje de las ${num}`, `hora ${num}`, `sector ${num}`, `posicion ${num}`
      ];
    } else if (name === "retroareolar") {
      primary = ["retroareolar", "retro del pezon", "detras del pezon", "areolar", "retro-areolar"];
    } else if (name === "cola_spence") {
      primary = ["cola de spence", "prolongacion axilar", "cola spence"];
    } else if (name === "axila") {
      primary = ["axilar", "axila", "ganglio axilar", "hueco axilar"];
    }

    // Breast context headers to prevent bleeding right and left
    const contexts = isRight 
      ? ["mama derecha", "m. derecha", "md:", "md ", "hemidif de la derecha", "derecha"] 
      : ["mama izquierda", "m. izquierda", "mi:", "mi ", "hemidif de la izquierda", "izquierda"];

    return { primary, contexts };
  };

  const getSimplifiedDescription = (id: string, stateInput?: string): string => {
    const s = stateInput || states[id] || "no_descrito";
    if (s === "no_descrito") {
      return "No descrito en el reporte.";
    }
    if (s === "normal") {
      return "Ecosonográficamente normal, sin alteraciones discretas.";
    }
    
    const isRight = id.startsWith("md_");
    const name = id.replace("md_", "").replace("mi_", "");

    if (name === "axila") {
      return "Linfadenopatía de morfología inespecífica en estudio.";
    }
    if (name === "retroareolar") {
      return "Ectasia de conductos galactóforos.";
    }
    if (name === "cola_spence") {
      return "Tejido fibroglandular denso de aspecto habitual.";
    }
    return "Nódulo hipoecoico bien delimitado compatible con fibroadenoma.";
  };

  // Generate table markdown
  const exportTableData = () => {
    let md = `\n| Región | Hallazgo |\n`;
    md += `| :--- | :--- |\n`;

    let hasFindings = false;
    initialKeys.forEach(k => {
      const s = states[k];
      if (s === "hallazgo") {
        const desc = customDescriptions[k]?.trim() || getSimplifiedDescription(k);
        md += `| **${getStructureLabel(k)}** | ${desc} |\n`;
        hasFindings = true;
      }
    });

    if (!hasFindings) {
      md += `| **Examen de Mamas** | No se describen hallazgos patológicos o nódulos sospechosos en los ejes explorados. |\n`;
    }

    onExportTable(md);
  };

  const runLocalHeuristics = (logs: string[]) => {
    logs.push("Ejecutando análisis local de mamas por heurísticas de proximidad...");
    const textOriginal = generatedReport;
    const textLower = textOriginal.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Let's divide text into right breast block and left breast block to avoid false mapping!
    let rightBlock = "";
    let leftBlock = "";

    // Locate boundary markers
    const idxMD = Math.max(textLower.indexOf("mama derecha"), textLower.indexOf("m. derecha"), textLower.indexOf("md:"));
    const idxMI = Math.max(textLower.indexOf("mama izquierda"), textLower.indexOf("m. izquierda"), textLower.indexOf("mi:"));

    if (idxMD !== -1 && idxMI !== -1) {
      if (idxMD < idxMI) {
        rightBlock = textLower.slice(idxMD, idxMI);
        leftBlock = textLower.slice(idxMI);
      } else {
        leftBlock = textLower.slice(idxMI, idxMD);
        rightBlock = textLower.slice(idxMD);
      }
    } else if (idxMD !== -1) {
      rightBlock = textLower.slice(idxMD);
      leftBlock = textLower;
    } else if (idxMI !== -1) {
      leftBlock = textLower.slice(idxMI);
      rightBlock = textLower;
    } else {
      // No explicit headers, use full text for both as fallback but restrict carefully
      rightBlock = textLower;
      leftBlock = textLower;
    }

    const nextStates = { ...states };
    const nextDescriptions = { ...customDescriptions };

    initialKeys.forEach(id => {
      const isRight = id.startsWith("md_");
      const { primary } = getStructureKeywords(id);
      const targetBlock = isRight ? rightBlock : leftBlock;

      if (!targetBlock) {
        nextStates[id] = "no_descrito";
        nextDescriptions[id] = "No mencionado.";
        return;
      }

      // Check if primary keywords are mentioned in the contextual block
      const foundKeyword = primary.find(kw => targetBlock.includes(kw));

      if (!foundKeyword) {
        nextStates[id] = "no_descrito";
        nextDescriptions[id] = "No mencionado.";
        return;
      }

      // Locate sentence around this keyword to verify normal vs finding
      const kwIdx = targetBlock.indexOf(foundKeyword);
      const startContext = Math.max(0, kwIdx - 40);
      const endContext = Math.min(targetBlock.length, kwIdx + 85);
      const contextText = targetBlock.slice(startContext, endContext);

      // Check if normal/negated
      const isNormal = [
        "normal", "conservado", "conservada", "homogeneo", "homogenea", "habitual", "negativo",
        "sin hallazgos", "sin alteraciones", "sin nodulos", "sin lesiones", "no se observan masas",
        "sin masas", "sin quistes", "no hay quistes", "libre de", "adenopatia reactiva de aspecto habitual"
      ].some(p => contextText.includes(p));

      // Attempt to capture pathology / actual suspicious text
      if (isNormal) {
        nextStates[id] = "normal";
        nextDescriptions[id] = "Dentro de límites normales.";
        logs.push(`[Local] ${getStructureLabel(id)} clasificado como NORMAL.`);
      } else {
        nextStates[id] = "hallazgo";
        
        // Extract a clinical synopsis around the found keyword
        // Let's grab the actual sentence from the original (non-normalized) case text
        const keywordInOriginal = textOriginal.slice(startContext, endContext);
        
        let customDesc = "Alteración ecográfica descrita.";
        
        // Let's isolate the sentence
        const sentences = keywordInOriginal.split(/[.;:]/);
        const relatedSentence = sentences.find(s => {
          const sNorm = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return primary.some(kw => sNorm.includes(kw));
        });

        if (relatedSentence && relatedSentence.trim().length > 6) {
          customDesc = relatedSentence.trim()
            .replace(/^, -/, "")
            .replace(/\s+/g, " ");
          
          if (customDesc.length > 80) {
            customDesc = customDesc.substring(0, 77) + "...";
          }
        }

        nextDescriptions[id] = customDesc;
        logs.push(`[Local] ${getStructureLabel(id)} clasificado como HALLAZGO: ${customDesc}`);
      }
    });

    setStates(nextStates);
    setCustomDescriptions(nextDescriptions);
  };

  const handleScanReportText = async (showFeedback: boolean = false) => {
    if (!generatedReport) {
      if (showFeedback) {
        setSyncLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: No hay reporte clínico disponible para analizar.`]);
      }
      return;
    }

    setIsSyncing(true);
    const logs: string[] = [];
    logs.push(`Iniciando extracción inteligente de hallazgos en Ultrasonido de Mamas...`);

    const structuresList = initialKeys.map(k => ({
      id: k,
      label: getStructureLabel(k),
      allowedStates: ["no_descrito", "normal", "hallazgo"]
    }));

    try {
      const response = await fetch("/api/analyze-anatomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel || "gemini-3.5-flash",
          reportText: generatedReport,
          studyType: "Ultrasonido de Mamas",
          structures: structuresList
        })
      });

      const data = await response.json();
      if (data.success && data.states && data.descriptions) {
        let parsedCount = 0;
        let foundPathologies = 0;

        const nextStates = { ...states };
        const nextDescriptions = { ...customDescriptions };

        initialKeys.forEach(k => {
          if (data.states[k] !== undefined) {
            nextStates[k] = data.states[k];
            nextDescriptions[k] = data.descriptions[k] || "No descrito.";
            parsedCount++;
            if (data.states[k] === "hallazgo") {
              foundPathologies++;
            }
          }
        });

        setStates(nextStates);
        setCustomDescriptions(nextDescriptions);
        setLastSyncedReport(generatedReport);

        logs.push(`Sincronización exitosa con la IA.`);
        logs.push(`Se evaluaron ${parsedCount} sub-divisiones bilaterales clínicas.`);
        logs.push(`Se detectaron ${foundPathologies} hallazgos focales activos.`);
      } else {
        logs.push("La API de IA no devolvió resultados compatibles. Corriendo heurísticas locales secundarias...");
        runLocalHeuristics(logs);
      }
    } catch (err: any) {
      console.error("Failed integration sync with Gemini API:", err);
      logs.push("Fallo en la comunicación con el servidor. Aplicando algoritmo local de proximidad...");
      runLocalHeuristics(logs);
    } finally {
      setIsSyncing(false);
      setSyncLogs(logs);
    }
  };

  const handleReset = () => {
    const s: Record<string, string> = {};
    const d: Record<string, string> = {};
    initialKeys.forEach(k => {
      s[k] = "no_descrito";
      d[k] = "";
    });
    setStates(s);
    setCustomDescriptions(d);
    setSyncLogs(["Mapeo reiniciado a valores neutros."]);
  };

  // Helper mathematical path sector plotter
  const getPathForSector = (
    cx: number,
    cy: number,
    r_in: number,
    r_out: number,
    startDeg: number,
    endDeg: number
  ) => {
    const startRad = (startDeg * Math.PI) / 180;
    const endRad = (endDeg * Math.PI) / 180;

    const x1_out = cx + r_out * Math.cos(startRad);
    const y1_out = cy + r_out * Math.sin(startRad);
    const x2_out = cx + r_out * Math.cos(endRad);
    const y2_out = cy + r_out * Math.sin(endRad);

    const x1_in = cx + r_in * Math.cos(startRad);
    const y1_in = cy + r_in * Math.sin(startRad);
    const x2_in = cx + r_in * Math.cos(endRad);
    const y2_in = cy + r_in * Math.sin(endRad);

    return `M ${x1_out} ${y1_out} A ${r_out} ${r_out} 0 0 1 ${x2_out} ${y2_out} L ${x2_in} ${y2_in} A ${r_in} ${r_in} 0 0 0 ${x1_in} ${y1_in} Z`;
  };

  // Status-based colors
  const getColorsForState = (stateValue: string, isCurrentHover: boolean, isCurrentSelected: boolean) => {
    let baseFill = "fill-slate-900/10";
    let baseStroke = "stroke-slate-700/40";
    let glow = "";

    if (stateValue === "normal") {
      baseFill = "fill-emerald-500/15";
      baseStroke = "stroke-emerald-500/80";
      if (isCurrentHover) {
        baseFill = "fill-emerald-500/35";
        baseStroke = "stroke-emerald-400";
      }
    } else if (stateValue === "hallazgo") {
      baseFill = "fill-rose-500/25";
      baseStroke = "stroke-rose-500";
      glow = "drop-shadow-[0_0_4px_rgba(239,68,68,0.4)]";
      if (isCurrentHover) {
        baseFill = "fill-rose-500/45";
        baseStroke = "stroke-rose-400";
      }
    } else {
      // no_descrito
      if (isCurrentHover) {
        baseFill = "fill-indigo-500/20";
        baseStroke = "stroke-indigo-400";
      }
    }

    if (isCurrentSelected) {
      baseStroke = "stroke-indigo-400 stroke-[2.5]";
      if (stateValue === "no_descrito") {
        baseFill = "fill-indigo-500/25";
      }
    }

    return { baseFill, baseStroke, glow };
  };

  const renderBreastSvg = (isRight: boolean) => {
    const cx = 160;
    const cy = 110;
    const r_in = 22;
    const r_out = 65;
    const prefix = isRight ? "md_" : "mi_";

    // 12 Sectors
    const sectorElements: React.ReactNode[] = [];
    for (let h = 1; h <= 12; h++) {
      const id = `${prefix}eje${h}`;
      const startAngle = -90 + (h - 12.5) * 30;
      const endAngle = -90 + (h - 11.5) * 30;

      const pathD = getPathForSector(cx, cy, r_in, r_out, startAngle, endAngle);
      const isSelected = selectedStructure === id;
      const isHovered = activeHover === id;
      const stateVal = states[id] || "no_descrito";
      const { baseFill, baseStroke, glow } = getColorsForState(stateVal, isHovered, isSelected);

      // Midpoint coordinate for label placing
      const midAngleRad = ((startAngle + endAngle) / 2 * Math.PI) / 180;
      const r_text = r_in + 24;
      const tx = cx + r_text * Math.cos(midAngleRad);
      const ty = cy + r_text * Math.sin(midAngleRad);

      sectorElements.push(
        <g key={id} className="cursor-pointer" onClick={() => setSelectedStructure(id)} onMouseEnter={() => setActiveHover(id)} onMouseLeave={() => setActiveHover(null)}>
          <path id={`${id}-svg-path`} d={pathD} className={`${baseFill} ${baseStroke} transition-all duration-150 ${glow}`} />
          <text x={tx} y={ty + 2} textAnchor="middle" className="fill-slate-400 select-none pointer-events-none font-mono font-black text-[7px]" style={{ fontSize: "7px" }}>
            {h}
          </text>
        </g>
      );
    }

    // Retroareolar
    const retId = `${prefix}retroareolar`;
    const isRetSelected = selectedStructure === retId;
    const isRetHovered = activeHover === retId;
    const retState = states[retId] || "no_descrito";
    const retColors = getColorsForState(retState, isRetHovered, isRetSelected);

    // Cola de Spence
    const spenceId = `${prefix}cola_spence`;
    const isSpenceSelected = selectedStructure === spenceId;
    const isSpenceHovered = activeHover === spenceId;
    const spenceState = states[spenceId] || "no_descrito";
    const spenceColors = getColorsForState(spenceState, isSpenceHovered, isSpenceSelected);

    // Axila
    const axId = `${prefix}axila`;
    const isAxSelected = selectedStructure === axId;
    const isAxHovered = activeHover === axId;
    const axState = states[axId] || "no_descrito";
    const axColors = getColorsForState(axState, isAxHovered, isAxSelected);

    return (
      <svg id={`breast-anatomy-${isRight ? "right" : "left"}-svg`} viewBox="0 0 320 220" className="w-full h-auto drop-shadow-xl bg-slate-950/40 border border-slate-900 rounded-2xl p-2 select-none">
        {/* Background anatomical reference bounds */}
        <text x="160" y="210" textAnchor="middle" className="fill-slate-500 font-sans font-black tracking-widest text-[9px]">
          {isRight ? "MAMA DERECHA (MD)" : "MAMA IZQUIERDA (MI)"}
        </text>

        {/* Outer boundary guidelines */}
        <circle cx={cx} cy={cy} r={r_out} className="fill-none stroke-slate-800/20 stroke-1 stroke-dasharray-[3,3]" />
        
        {/* 12 sectors */}
        {sectorElements}

        {/* Cola de Spence - Superior Lateral lobe */}
        {isRight ? (
          <g className="cursor-pointer" onClick={() => setSelectedStructure(spenceId)} onMouseEnter={() => setActiveHover(spenceId)} onMouseLeave={() => setActiveHover(null)}>
            <ellipse 
              id={`${spenceId}-svg-path`}
              cx={95} cy={60} rx={18} ry={25} 
              transform="rotate(-35, 95, 60)" 
              className={`${spenceColors.baseFill} ${spenceColors.baseStroke} transition-all duration-150 ${spenceColors.glow}`} 
            />
            <text x="91" y="62" className="fill-slate-400 select-none pointer-events-none font-sans font-bold text-[6px]">Spence</text>
          </g>
        ) : (
          <g className="cursor-pointer" onClick={() => setSelectedStructure(spenceId)} onMouseEnter={() => setActiveHover(spenceId)} onMouseLeave={() => setActiveHover(null)}>
            <ellipse 
              id={`${spenceId}-svg-path`}
              cx={225} cy={60} rx={18} ry={25} 
              transform="rotate(35, 225, 60)" 
              className={`${spenceColors.baseFill} ${spenceColors.baseStroke} transition-all duration-150 ${spenceColors.glow}`} 
            />
            <text x="229" y="62" className="fill-slate-400 select-none pointer-events-none font-sans font-bold text-[6px]" textAnchor="end">Spence</text>
          </g>
        )}

        {/* Axila - Furthest Superior Lateral nodes */}
        {isRight ? (
          <g className="cursor-pointer" onClick={() => setSelectedStructure(axId)} onMouseEnter={() => setActiveHover(axId)} onMouseLeave={() => setActiveHover(null)}>
            <ellipse 
              id={`${axId}-svg-path`}
              cx={35} cy={30} rx={15} ry={21} 
              transform="rotate(-40, 35, 30)" 
              className={`${axColors.baseFill} ${axColors.baseStroke} transition-all duration-150 ${axColors.glow}`} 
            />
            <text x="35" y="32" textAnchor="middle" className="fill-slate-400 select-none pointer-events-none font-sans font-black text-[7px]">AXILA</text>
          </g>
        ) : (
          <g className="cursor-pointer" onClick={() => setSelectedStructure(axId)} onMouseEnter={() => setActiveHover(axId)} onMouseLeave={() => setActiveHover(null)}>
            <ellipse 
              id={`${axId}-svg-path`}
              cx={285} cy={30} rx={15} ry={21} 
              transform="rotate(40, 285, 30)" 
              className={`${axColors.baseFill} ${axColors.baseStroke} transition-all duration-150 ${axColors.glow}`} 
            />
            <text x="285" y="32" textAnchor="middle" className="fill-slate-400 select-none pointer-events-none font-sans font-black text-[7px]">AXILA</text>
          </g>
        )}

        {/* Centered Retroareolar region */}
        <g className="cursor-pointer" onClick={() => setSelectedStructure(retId)} onMouseEnter={() => setActiveHover(retId)} onMouseLeave={() => setActiveHover(null)}>
          <circle 
            id={`${retId}-svg-path`}
            cx={cx} cy={cy} r={r_in} 
            className={`${retColors.baseFill} ${retColors.baseStroke} transition-all duration-150 ${retColors.glow} stroke-dashed`} 
          />
          <text x={cx} y={cy + 2.5} textAnchor="middle" className="fill-slate-300 font-sans font-bold text-[6.5px] pointer-events-none select-none">
            RETRO
          </text>
        </g>
      </svg>
    );
  };

  const syncAvailable = generatedReport && generatedReport !== lastSyncedReport;

  const getActiveFindingsCount = () => {
    return Object.values(states).filter(v => v === "hallazgo").length;
  };

  return (
    <div className="flex flex-col gap-6 text-slate-100 font-sans scale-in">
      {/* HEADER CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-900 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 px-2.5 bg-rose-950/50 border border-rose-900 text-rose-400 text-[9px] font-black uppercase rounded-full tracking-widest">
              Protocolo Mama
            </span>
            <span className="text-[10px] text-slate-500 font-black tracking-widest uppercase">
              Mapeo de Hallazgos Focales 2D
            </span>
          </div>
          <h2 className="text-lg font-black tracking-tight text-white mt-1 flex items-center gap-1.5 uppercase">
            🩺 DIAGRAMA Y MAPEO BILATERAL DE MAMAS
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {setIncludeInReport && (
            <label className="flex items-center gap-2 cursor-pointer bg-slate-950/60 hover:bg-slate-950/80 border border-slate-900 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 transition-all">
              <input 
                type="checkbox" 
                checked={includeInReport} 
                onChange={(e) => setIncludeInReport(e.target.checked)} 
                className="rounded border-slate-800 text-indigo-500 focus:ring-opacity-40" 
              />
              <span>Incluir anexo en informe</span>
            </label>
          )}

          <button
            onClick={handleReset}
            className="p-2 bg-slate-950 border border-slate-900 hover:border-slate-800 hover:text-white text-slate-400 rounded-xl transition-all cursor-pointer"
            title="Reiniciar valores"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* DETECTOR / SCAN GENERATOR */}
      <div className="bg-slate-950 border border-slate-900 p-4 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-rose-400 animate-pulse" /> Sincronización Ecográfica de Mamas
          </h4>
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed mt-1 max-w-xl">
            Sincroniza y pobla automáticamente los hallazgos descritos en el informe escrito. No se asume normalidad automática de las áreas no mencionadas.
          </p>
        </div>

        <button
          onClick={() => handleScanReportText(true)}
          disabled={isSyncing || !generatedReport}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap active:scale-97 border ${
            syncAvailable 
              ? "bg-rose-600 text-white border-rose-500 hover:bg-rose-500 hover:border-rose-400 animate-pulse" 
              : "bg-slate-900 text-slate-350 border-slate-800 hover:bg-slate-850 hover:text-white"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isSyncing ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Sincronizando...</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sincronizar MD / MI</span>
            </>
          )}
        </button>
      </div>

      {/* SYNC CONTEXT LOGS */}
      {syncLogs.length > 0 && (
        <div className="bg-slate-950/80 border border-slate-900 rounded-xl p-3 font-mono text-[9px] text-slate-400 leading-normal max-h-[140px] overflow-y-auto">
          {syncLogs.map((log, index) => (
            <div key={index} className="flex gap-1">
              <span className="text-indigo-400">#</span>
              <span>{log}</span>
            </div>
          ))}
        </div>
      )}

      {/* MAIN LAYOUT: SVGs SIDE BY SIDE & EDIT SIDEBAR */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* SVGS VIEWPORT */}
        <div className="xl:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            {renderBreastSvg(true)}
          </div>
          <div className="flex flex-col gap-2">
            {renderBreastSvg(false)}
          </div>
        </div>

        {/* SIDEBAR DETAILED HANDLER */}
        <div className="xl:col-span-4 bg-slate-950/60 border border-slate-900 rounded-2xl p-4 flex flex-col gap-3 min-h-[300px]">
          <div>
            <div className="text-[8px] font-black text-rose-400 uppercase tracking-widest">
              Anotador Estructural
            </div>
            <h3 className="text-sm font-black text-white mt-0.5 truncate uppercase">
              {getStructureLabel(selectedStructure)}
            </h3>
          </div>

          {/* CHOOSE STATE */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">
              Estado Clínico de este Eje:
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { val: "no_descrito", label: "No Descrito", color: "border-slate-800 text-slate-450 hover:bg-slate-900" },
                { val: "normal", label: "Normal", color: "border-emerald-950/50 text-emerald-450 hover:bg-emerald-950/30" },
                { val: "hallazgo", label: "Hallazgo", color: "border-rose-950/50 text-rose-400 hover:bg-rose-950/30" }
              ].map((opt) => {
                const isActive = states[selectedStructure] === opt.val;
                return (
                  <button
                    key={opt.val}
                    onClick={() => {
                      setStates(prev => ({ ...prev, [selectedStructure]: opt.val }));
                      if (opt.val === "no_descrito" || opt.val === "normal") {
                        setCustomDescriptions(prev => ({ ...prev, [selectedStructure]: "" }));
                      } else if (!customDescriptions[selectedStructure]) {
                        setCustomDescriptions(prev => ({ ...prev, [selectedStructure]: getSimplifiedDescription(selectedStructure, opt.val) }));
                      }
                    }}
                    className={`py-1.5 px-2 text-[9px] font-black uppercase tracking-wider border rounded-lg cursor-pointer transition-all ${
                      isActive 
                        ? opt.val === "normal" 
                          ? "bg-emerald-500 border-emerald-400 text-white" 
                          : opt.val === "hallazgo"
                            ? "bg-rose-500 border-rose-400 text-white"
                            : "bg-slate-800 border-slate-650 text-white"
                        : opt.color
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* EDIT FINDING DESCRIPTION */}
          {states[selectedStructure] === "hallazgo" && (
            <div className="mt-1 animate-fadeIn">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                Hallazgo Clínico Específico (Editable):
              </label>
              <textarea
                value={customDescriptions[selectedStructure] || ""}
                onChange={(e) => setCustomDescriptions(prev => ({ ...prev, [selectedStructure]: e.target.value }))}
                rows={3}
                className="w-full bg-slate-900 border border-slate-800 text-slate-250 text-xs rounded-lg p-2 focus:outline-none focus:border-rose-500 font-medium leading-relaxed resize-none"
                placeholder="Insertar sinopsis del hallazgo descrito en el reporte..."
              />
            </div>
          )}

          {states[selectedStructure] === "normal" && (
            <div className="p-2 border border-emerald-950/30 bg-emerald-950/15 rounded-lg text-emerald-450 text-[10px] leading-snug">
              ✓ <strong>Normal</strong>: Esta zona ecográfica se reporta sin anormalidades. Se omitirá del cuadro de hallazgos para evitar saturación del informe.
            </div>
          )}

          {states[selectedStructure] === "no_descrito" && (
            <div className="p-2 border border-slate-900/30 bg-slate-950/40 rounded-lg text-slate-450 text-[10px] leading-snug italic">
              Zonas no descritas quedan excluidas del mapeo activo.
            </div>
          )}

          {/* STATS AREA */}
          <div className="border-t border-slate-900 pt-3 mt-auto flex flex-col gap-2">
            <div className="bg-slate-950/80 border border-slate-900 p-2.5 rounded-xl flex items-center justify-between text-[10px] font-bold">
              <span className="text-slate-400 uppercase tracking-wider">Hallazgos Activos:</span>
              <span className={`px-2 py-0.5 rounded font-black ${getActiveFindingsCount() > 0 ? 'bg-rose-950/50 border border-rose-900 text-rose-400' : 'bg-slate-900 text-slate-400'}`}>
                {getActiveFindingsCount()} ejes marcados
              </span>
            </div>

            <button
              onClick={exportTableData}
              className="w-full bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-650 text-slate-100 border border-rose-500/40 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 active:scale-97 cursor-pointer text-center"
            >
              Generar Tabla de Hallazgos a Reporte
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
