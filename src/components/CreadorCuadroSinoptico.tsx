import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Loader2,
  Check,
  Plus,
  Info,
  Table,
  FileText,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  Sliders,
  Trash2,
  RefreshCw,
  SlidersHorizontal,
  HelpCircle,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Edit2,
  CornerUpLeft
} from "lucide-react";

interface OrganAspect {
  key: string;
  value: string;
  clinicalSource: string;
  explanation: string;
  narrativeSentence: string;
  approvedForTable: boolean;
  approvedForReportText: boolean;
  retroInserted?: boolean;
}

interface CreadorCuadroSinopticoProps {
  selectedModel: string;
  reportText: string;
  onReportUpdated: (newText: string) => void;
}

const POPULAR_ORGANS = [
  "Hígado",
  "Tiroides",
  "Bazo",
  "Riñones",
  "Vesícula Biliar",
  "Páncreas",
  "Próstata",
  "Útero",
  "Ovarios",
  "Apéndice Cecal"
];

const PRESETS = [
  {
    name: "Completo",
    desc: "Tamaño, lesiones, vascularización, diagnósticos diferenciales y clasificaciones.",
    text: "Quiero incluir el tamaño exacto del órgano, ecoestructura o morfología, presencia o ausencia de lesiones sólidas o quísticas, características de vascularización Doppler si procede, clasificación de riesgo aplicable (TI-RADS, Bosniak, LI-RADS, etc.) y diagnósticos diferenciales."
  },
  {
    name: "Clasificación y Riesgo",
    desc: "Enfoque en escalas y criterios de riesgo (TI-RADS, Bosniak, etc.).",
    text: "Enfócate en la clasificación clínica estándar de este órgano o de las lesiones halladas, los criterios de riesgo de malignidad específicos y las pautas o recomendaciones de seguimiento recomendadas por las guías."
  },
  {
    name: "Diagnóstico Diferencial",
    desc: "Para justificar y sugerir alternativas diagnósticas.",
    text: "Describe diagnósticos diferenciales posibles basados en la ecoestructura y hallazgos descritos, justificando por qué algunos se descartan y otros se sugieren como posibilidad diagnóstica."
  },
  {
    name: "Medidas y Estructura",
    desc: "Tamaño exacto, volumen y características morfológicas.",
    text: "Incluye el análisis detallado del tamaño (diámetros, ejes, volumen), contornos, ecogenicidad y homogeneidad de la estructura del parénquima."
  }
];

export const CreadorCuadroSinoptico: React.FC<CreadorCuadroSinopticoProps> = ({
  selectedModel,
  reportText,
  onReportUpdated
}) => {
  const [organ, setOrgan] = useState<string>("");
  const [aspectsText, setAspectsText] = useState<string>("");
  const [aspects, setAspects] = useState<OrganAspect[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showDirectives, setShowDirectives] = useState<boolean>(true);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedValue, setEditedValue] = useState<string>("");
  const [editedSentence, setEditedSentence] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handlePresetSelect = (presetText: string) => {
    setAspectsText(presetText);
  };

  const handleGenerate = async () => {
    if (!organ.trim()) {
      setError("Por favor, ingresa el nombre de la estructura u órgano a analizar.");
      return;
    }
    if (!reportText.trim()) {
      setError("El reporte clínico actual está vacío. Genera o pega un informe primero.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    setAspects([]);

    try {
      const response = await fetch("/api/generate-organ-synoptic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: reportText,
          organ: organ,
          aspects: aspectsText
        })
      });

      const data = await response.json();
      if (data.success) {
        const mappedAspects = data.aspects.map((asp: any) => ({
          ...asp,
          approvedForTable: true,
          approvedForReportText: true
        }));
        setAspects(mappedAspects);
        if (mappedAspects.length === 0) {
          setError(`No se encontraron hallazgos específicos ni aspectos relevantes para '${organ}' en el reporte.`);
        }
      } else {
        setError(data.error || "Error al confeccionar el cuadro sinóptico.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Ocurrió un error en la comunicación con el servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTableApproval = (index: number) => {
    setAspects(prev =>
      prev.map((asp, i) => (i === index ? { ...asp, approvedForTable: !asp.approvedForTable } : asp))
    );
  };

  const toggleReportApproval = (index: number) => {
    setAspects(prev =>
      prev.map((asp, i) => (i === index ? { ...asp, approvedForReportText: !asp.approvedForReportText } : asp))
    );
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditedValue(aspects[index].value);
    setEditedSentence(aspects[index].narrativeSentence);
  };

  const handleSaveEdit = (index: number) => {
    setAspects(prev =>
      prev.map((asp, i) =>
        i === index
          ? {
              ...asp,
              value: editedValue,
              narrativeSentence: editedSentence
            }
          : asp
      )
    );
    setEditingIndex(null);
  };

  const handleDeleteAspect = (index: number) => {
    setAspects(prev => prev.filter((_, i) => i !== index));
  };

  // Build the markdown table string
  const generateMarkdownTable = (): string => {
    const approvedRows = aspects.filter(a => a.approvedForTable);
    if (approvedRows.length === 0) return "";

    let md = `| Aspecto Evaluado | Detalle Clínico / Valor |\n`;
    md += `| :--- | :--- |\n`;
    approvedRows.forEach(row => {
      md += `| **${row.key}** | ${row.value} |\n`;
    });
    return md;
  };

  // Build the narrative text paragraph
  const generateNarrativeParagraph = (): string => {
    const approvedSentences = aspects
      .filter(a => a.approvedForReportText && a.narrativeSentence.trim())
      .map(a => a.narrativeSentence.trim());
    
    if (approvedSentences.length === 0) return "";
    return approvedSentences.join(" ");
  };

  const handleInsertIntoReport = () => {
    const mdTable = generateMarkdownTable();
    const narrativeText = generateNarrativeParagraph();

    if (!mdTable && !narrativeText) {
      setError("No has aprobado ningún aspecto para insertar.");
      return;
    }

    let current = reportText;
    const sectionHeader = `### SINOPSIS CLÍNICA DE ${organ.toUpperCase()}`;

    // Build the block to insert
    let blockToInsert = `\n\n### SINOPSIS CLÍNICA DE ${organ.toUpperCase()}\n`;
    if (mdTable) {
      blockToInsert += `\n${mdTable}\n`;
    }
    if (narrativeText) {
      blockToInsert += `\n**Resumen Interpretativo:** ${narrativeText}\n`;
    }

    // Check if section already exists and replace it, or append at the end
    const escapedHeader = sectionHeader.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regexWithDash = new RegExp(`(\\n*---\\n*${escapedHeader}[\\s\\S]*?)(?=(\\n*---)|\\n*###|$)`, 'i');
    const regexWithoutDash = new RegExp(`(\\n*${escapedHeader}[\\s\\S]*?)(?=\\n*###|$)`, 'i');

    if (regexWithDash.test(current)) {
      current = current.replace(regexWithDash, blockToInsert);
      setSuccessMessage(`Se ha actualizado exitosamente la sinopsis clínica de '${organ}' en el reporte.`);
    } else if (regexWithoutDash.test(current)) {
      current = current.replace(regexWithoutDash, blockToInsert);
      setSuccessMessage(`Se ha actualizado exitosamente la sinopsis clínica de '${organ}' en el reporte.`);
    } else {
      current = current.trim() + blockToInsert;
      setSuccessMessage(`Se ha insertado exitosamente la sinopsis clínica de '${organ}' al final del reporte.`);
    }

    onReportUpdated(current);
    
    // Clear message after 4s
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);
  };

  const handleRetroactiveInsert = (index: number) => {
    const aspect = aspects[index];
    const sentence = aspect.narrativeSentence.trim();
    if (!sentence) return;

    let current = reportText;
    const organEscaped = organ.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const organRegex = new RegExp(`(\\b${organEscaped}\\b)`, 'i');
    
    const lines = current.split("\n");
    let inserted = false;
    
    // Find a section or line containing the organ name to insert next to it
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (organRegex.test(line) && !line.toLowerCase().includes("sinopsis") && !line.toLowerCase().includes("cuadro")) {
        if (line.trim().startsWith("-") || line.trim().startsWith("*") || line.trim().startsWith("###") || line.trim().endsWith(":") || line.trim().startsWith("**")) {
          if (lines[i + 1] && lines[i + 1].trim() !== "" && !lines[i + 1].trim().startsWith("###") && !lines[i + 1].trim().startsWith("-")) {
            lines[i + 1] = lines[i + 1].trim() + " " + sentence;
          } else {
            lines.splice(i + 1, 0, sentence);
          }
        } else {
          lines[i] = line.trim() + " " + sentence;
        }
        inserted = true;
        break;
      }
    }

    // Fallback 1: Under ### HALLAZGOS or HALLAZGOS:
    if (!inserted) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        if (line.includes("hallazgos") && (line.includes("###") || line.includes(":") || lines[i].trim().startsWith("**"))) {
          lines.splice(i + 1, 0, `- **${organ}**: ${sentence}`);
          inserted = true;
          break;
        }
      }
    }

    // Fallback 2: Before CONCLUSIÓN or IMPRESIÓN DIAGNÓSTICA
    if (!inserted) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        if (line.includes("conclusión") || line.includes("impresión diagnóstica") || line.includes("### conclusión")) {
          lines.splice(i, 0, `- **${organ}**: ${sentence}\n`);
          inserted = true;
          break;
        }
      }
    }

    // Fallback 3: Append right before any existing SINOPSIS CLÍNICA section, or at the very end
    if (!inserted) {
      const sinopsisIndex = current.indexOf("### SINOPSIS CLÍNICA");
      if (sinopsisIndex !== -1) {
        current = current.slice(0, sinopsisIndex).trim() + `\n\n- **${organ}**: ${sentence}\n\n` + current.slice(sinopsisIndex);
      } else {
        current = current.trim() + `\n\n- **${organ}**: ${sentence}`;
      }
    } else {
      current = lines.join("\n");
    }

    onReportUpdated(current);
    setSuccessMessage(`Se ha inyectado retrógradamente al informe base: "${sentence}"`);
    
    setAspects(prev =>
      prev.map((asp, idx) => (idx === index ? { ...asp, retroInserted: true } : asp))
    );

    setTimeout(() => {
      setSuccessMessage(null);
    }, 4500);
  };

  const selectAllTable = (val: boolean) => {
    setAspects(prev => prev.map(a => ({ ...a, approvedForTable: val })));
  };

  const selectAllReport = (val: boolean) => {
    setAspects(prev => prev.map(a => ({ ...a, approvedForReportText: val })));
  };

  return (
    <div id="creador-cuadro-sinoptico-container" className="bg-slate-900/60 border-2 border-indigo-500/30 rounded-3xl p-6 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-indigo-950/50 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest font-mono">
              Creador de Cuadro Sinóptico de Órgano (IA)
            </h3>
            <p className="text-[10px] text-slate-400 uppercase font-mono tracking-wider mt-0.5">
              Análisis Estructurado y Redacción de Co-Inferencia Médica
            </p>
          </div>
        </div>
        <span className="text-[9px] font-black uppercase font-mono tracking-widest bg-indigo-950 text-indigo-400 border border-indigo-900/40 px-3 py-1 rounded-full">
          NUEVA FUNCIÓN IA
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-400 leading-relaxed">
        Ingresa el nombre de cualquier estructura u órgano descrito en tu informe (ej. <strong>Hígado</strong>, <strong>Recto Anterior</strong>, <strong>Tiroides</strong>, etc.). La Inteligencia Artificial auditará el informe activo en busca de sus características, permitiéndote además guiar el análisis para agregar clasificaciones médicas, sugerencias, diagnósticos diferenciales u otros parámetros específicos de tu interés.
      </p>

      {/* Inputs Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column: Organ input & suggestions */}
        <div className="space-y-4 md:col-span-1">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 font-mono">
              1. Nombre del Órgano o Estructura:
            </label>
            <input
              type="text"
              value={organ}
              onChange={e => setOrgan(e.target.value)}
              placeholder="Ej. Hígado, Tiroides, Bazo..."
              className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500/50 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 outline-none transition-all font-semibold font-sans"
            />
          </div>

          <div>
            <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2 font-mono">
              Sugerencias Rápidas:
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
              {POPULAR_ORGANS.map(item => (
                <button
                  key={item}
                  onClick={() => setOrgan(item)}
                  className={`px-2.5 py-1 text-[10px] font-medium rounded-lg transition-all cursor-pointer font-mono border ${
                    organ.toLowerCase() === item.toLowerCase()
                      ? "bg-indigo-500/15 border-indigo-500/50 text-indigo-300"
                      : "bg-slate-950/60 border-slate-900 hover:border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: AI Guidelines / Aspects to analyze */}
        <div className="space-y-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
              2. Aspectos adicionales a considerar con IA (Opcional):
            </label>
            <button
              onClick={() => setShowDirectives(p => !p)}
              className="text-[9px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-wider flex items-center gap-1 font-mono"
            >
              {showDirectives ? "Ocultar Presets" : "Mostrar Presets"}
            </button>
          </div>

          <textarea
            value={aspectsText}
            onChange={e => setAspectsText(e.target.value)}
            placeholder="Ej. Clasificación TI-RADS estimada, tamaño volumétrico, descartar adenopatías, posibles diagnósticos diferenciales clínicos..."
            rows={3}
            className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500/50 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 outline-none transition-all resize-none font-sans"
          />

          {showDirectives && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESETS.map(preset => (
                <button
                  key={preset.name}
                  onClick={() => handlePresetSelect(preset.text)}
                  className="bg-slate-950/40 hover:bg-slate-950/80 border border-slate-900 hover:border-indigo-950/60 p-2.5 rounded-xl text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-indigo-400 group-hover:text-indigo-300">
                    <SlidersHorizontal className="h-3 w-3" />
                    <span className="text-[10px] font-black uppercase tracking-wider font-mono">
                      {preset.name}
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-500 group-hover:text-slate-400 mt-1 line-clamp-2 leading-tight">
                    {preset.desc}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Button to run AI analysis */}
      <div className="flex justify-end pt-2 border-t border-slate-800/40">
        <button
          onClick={handleGenerate}
          disabled={isLoading || !organ.trim() || !reportText.trim()}
          className={`px-6 py-3.5 rounded-xl font-mono text-[11px] font-black uppercase tracking-widest cursor-pointer transition-all flex items-center gap-2 border shadow-lg ${
            isLoading
              ? "bg-slate-950 border-slate-900 text-slate-500"
              : !organ.trim() || !reportText.trim()
              ? "bg-slate-950 border-slate-900 text-slate-600 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-500 border-indigo-500 text-white hover:scale-[1.02] shadow-indigo-600/10 active:scale-[0.98]"
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
              <span>Confeccionando Cuadro Sinóptico...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 text-indigo-200" />
              <span>Analizar y Confeccionar Cuadro</span>
            </>
          )}
        </button>
      </div>

      {/* Error and Success Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-rose-950/20 border border-rose-900/40 rounded-xl text-rose-300 text-xs flex items-start gap-3"
          >
            <Info className="h-4 w-4 text-rose-400 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-bold uppercase tracking-wider font-mono block text-[10px] mb-0.5 text-rose-400">
                Atención Médica / Error:
              </span>
              {error}
            </div>
          </motion.div>
        )}

        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-950/20 border border-emerald-900/40 rounded-xl text-emerald-300 text-xs flex items-start gap-3"
          >
            <Check className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-bold uppercase tracking-wider font-mono block text-[10px] mb-0.5 text-emerald-400">
                Operación Exitosa:
              </span>
              {successMessage}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result Section (Provisional Table Editor and Previews) */}
      <AnimatePresence>
        {aspects.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6 pt-6 border-t border-slate-800"
          >
            {/* Aspect Table Header Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-850">
              <div>
                <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                  Cuadro Provisional: {organ}
                </h4>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-mono mt-0.5">
                  Revisa y aprueba cada fila de forma independiente para la tabla y el texto redactado.
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => selectAllTable(true)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[9px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest rounded-lg font-mono cursor-pointer transition-all"
                >
                  Aprobar Toda la Tabla
                </button>
                <button
                  onClick={() => selectAllReport(true)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[9px] font-black text-emerald-400 hover:text-emerald-300 uppercase tracking-widest rounded-lg font-mono cursor-pointer transition-all"
                >
                  Aprobar Todo el Texto
                </button>
              </div>
            </div>

            {/* Provisional Table Grid */}
            <div className="overflow-x-auto border border-slate-900 rounded-2xl bg-slate-950/30">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-900 text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                    <th className="py-3 px-4 w-[15%]">Aspecto</th>
                    <th className="py-3 px-4 w-[25%]">Detalle Clínico / Valor</th>
                    <th className="py-3 px-4 w-[12%]">Origen</th>
                    <th className="py-3 px-4 w-[25%]">Frase Narrativa Propuesta</th>
                    <th className="py-3 px-4 w-[10%] text-center">Incluir Tabla</th>
                    <th className="py-3 px-4 w-[10%] text-center">Incluir Texto</th>
                    <th className="py-3 px-4 w-[8%] text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 text-xs">
                  {aspects.map((aspect, idx) => (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-950/20 transition-colors ${
                        !aspect.approvedForTable && !aspect.approvedForReportText
                          ? "opacity-40"
                          : ""
                      }`}
                    >
                      {/* Key */}
                      <td className="py-4 px-4 font-bold text-slate-200">
                        {aspect.key}
                      </td>

                      {/* Value (Edit or Show) */}
                      <td className="py-4 px-4 text-slate-300">
                        {editingIndex === idx ? (
                          <input
                            type="text"
                            value={editedValue}
                            onChange={e => setEditedValue(e.target.value)}
                            className="w-full bg-slate-950 border border-indigo-500/40 rounded px-2 py-1 text-xs text-white"
                          />
                        ) : (
                          <div>
                            <span className="font-sans font-medium">{aspect.value}</span>
                            {aspect.explanation && (
                              <p className="text-[9px] text-slate-500 italic mt-0.5 font-mono leading-tight">
                                {aspect.explanation}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Source */}
                      <td className="py-4 px-4">
                        {aspect.clinicalSource === "Hallazgo de Reporte" ? (
                          <span className="inline-block px-2 py-0.5 text-[8px] font-bold uppercase rounded font-mono border bg-slate-950 text-indigo-400 border-indigo-900/30">
                            Reportado
                          </span>
                        ) : (
                          <div className="space-y-1.5">
                            <span className="inline-block px-2 py-0.5 text-[8px] font-bold uppercase rounded font-mono border bg-slate-950 text-amber-400 border-amber-900/30">
                              IA Inferencia
                            </span>
                            {aspect.retroInserted ? (
                              <div className="text-[9px] text-emerald-400 font-bold flex items-center gap-0.5 font-mono">
                                <Check className="h-3 w-3" /> Inyectado
                              </div>
                            ) : (
                              <button
                                onClick={() => handleRetroactiveInsert(idx)}
                                className="flex items-center justify-center gap-1 w-full py-1 px-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-[9px] font-bold text-amber-300 rounded hover:scale-105 active:scale-95 transition-all cursor-pointer font-mono"
                                title="Inyectar este dato sugerido de manera retrógrada en el reporte base"
                              >
                                <CornerUpLeft className="h-2.5 w-2.5 text-amber-400" />
                                Inyectar Base
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Sentence */}
                      <td className="py-4 px-4 text-slate-400">
                        {editingIndex === idx ? (
                          <textarea
                            value={editedSentence}
                            onChange={e => setEditedSentence(e.target.value)}
                            rows={2}
                            className="w-full bg-slate-950 border border-indigo-500/40 rounded px-2 py-1 text-xs text-white resize-none"
                          />
                        ) : (
                          <span className="italic leading-relaxed font-sans">{aspect.narrativeSentence || "—"}</span>
                        )}
                      </td>

                      {/* Checkbox Table */}
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => toggleTableApproval(idx)}
                          className="mx-auto p-1.5 bg-slate-950/80 rounded-lg hover:bg-slate-900 text-indigo-400 hover:text-indigo-300 transition-all border border-slate-900 cursor-pointer"
                        >
                          {aspect.approvedForTable ? (
                            <CheckSquare className="h-4 w-4" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-700" />
                          )}
                        </button>
                      </td>

                      {/* Checkbox Report */}
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => toggleReportApproval(idx)}
                          className="mx-auto p-1.5 bg-slate-950/80 rounded-lg hover:bg-slate-900 text-emerald-400 hover:text-emerald-300 transition-all border border-slate-900 cursor-pointer"
                        >
                          {aspect.approvedForReportText ? (
                            <CheckSquare className="h-4 w-4" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-700" />
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {editingIndex === idx ? (
                            <button
                              onClick={() => handleSaveEdit(idx)}
                              className="p-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-md transition-all cursor-pointer"
                              title="Guardar cambios"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStartEdit(idx)}
                              className="p-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-md transition-all cursor-pointer"
                              title="Editar clínicamente"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteAspect(idx)}
                            className="p-1 bg-slate-900 hover:bg-rose-950/30 border border-slate-800 hover:border-rose-900/40 text-slate-400 hover:text-rose-400 rounded-md transition-all cursor-pointer"
                            title="Descartar aspecto"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Split Previews: Markdown Table & Narrative Sentence */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Table Preview */}
              <div className="bg-slate-950/40 border border-slate-900 p-5 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-900 pb-2">
                  <Table className="h-4 w-4 text-indigo-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 font-mono">
                    Vista Previa: Cuadro Sinóptico
                  </span>
                </div>
                {generateMarkdownTable() ? (
                  <div className="text-xs text-slate-400 font-mono space-y-1 bg-slate-950/80 p-3 rounded-xl border border-slate-900 overflow-x-auto max-h-[160px] leading-relaxed">
                    {generateMarkdownTable().split("\n").map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider italic text-center py-6 font-mono">
                    Ningún aspecto seleccionado para la tabla.
                  </p>
                )}
              </div>

              {/* Narrative Text Preview */}
              <div className="bg-slate-950/40 border border-slate-900 p-5 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-900 pb-2">
                  <FileText className="h-4 w-4 text-emerald-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 font-mono">
                    Vista Previa: Texto Narrativo
                  </span>
                </div>
                {generateNarrativeParagraph() ? (
                  <div className="text-xs text-slate-300 bg-slate-950/80 p-4 rounded-xl border border-slate-900 max-h-[160px] overflow-y-auto leading-relaxed">
                    {generateNarrativeParagraph()}
                  </div>
                ) : (
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider italic text-center py-6 font-mono">
                    Ninguna frase aprobada para el informe.
                  </p>
                )}
              </div>
            </div>

            {/* Action Panel to apply elements to report */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-indigo-950/15 border border-indigo-500/30 rounded-2xl">
              <div className="flex items-start gap-2.5">
                <Info className="h-5 w-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-200 leading-normal max-w-xl">
                  Al hacer clic en el botón de la derecha, se creará una sección dedicada <strong>### SINOPSIS CLÍNICA DE {organ.toUpperCase()}</strong> al final del reporte radiológico actual. Si ya existe, se actualizará automáticamente reemplazándola por la nueva configuración aprobada.
                </p>
              </div>

              <button
                onClick={handleInsertIntoReport}
                className="w-full sm:w-auto px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest cursor-pointer transition-all flex items-center justify-center gap-2 font-mono shadow-xl border border-indigo-500 shadow-indigo-600/10 hover:scale-[1.02] active:scale-[0.98]"
              >
                <BookmarkCheck className="h-4 w-4" />
                <span>Insertar al Informe Activo</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
