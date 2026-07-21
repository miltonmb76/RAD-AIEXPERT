import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Bone,
  Loader2,
  Check,
  Plus,
  Info,
  Table,
  FileText,
  BookmarkCheck,
  Sliders,
  Trash2,
  RefreshCw,
  Edit2,
  CornerUpLeft,
  CheckSquare,
  Square,
  FileSpreadsheet,
  AlertTriangle,
  Copy
} from "lucide-react";

interface FractureAspect {
  key: string;
  value: string;
  clinicalSource: string;
  explanation: string;
  narrativeSentence: string;
  approvedForTable: boolean;
  retroInserted?: boolean;
}

interface CreadorSinopsisFracturasProps {
  selectedModel: string;
  reportText: string;
  onReportUpdated: (newText: string) => void;
}

export const CreadorSinopsisFracturas: React.FC<CreadorSinopsisFracturasProps> = ({
  selectedModel,
  reportText,
  onReportUpdated
}) => {
  const [bone, setBone] = useState<string>("");
  const [aspects, setAspects] = useState<FractureAspect[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"table" | "blocks">("table");
  const [copied, setCopied] = useState<boolean>(false);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedValue, setEditedValue] = useState<string>("");
  const [editedSentence, setEditedSentence] = useState<string>("");

  const handleGenerate = async () => {
    if (!reportText.trim()) {
      setError("El reporte clínico actual está vacío. Genera o pega un informe primero.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    setAspects([]);

    try {
      const response = await fetch("/api/generate-fracture-synoptic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: reportText
        })
      });

      const data = await response.json();
      if (data.success) {
        if (!data.fractureFound) {
          setError("No se detectó ninguna descripción clara de fractura en el reporte actual. Sin embargo, puedes forzar el análisis o agregar aspectos manualmente.");
          setBone(data.bone || "No detectado");
          // Initialize empty default aspects so they can add manually
          setAspects([
            { key: "Hueso y Región", value: "Por determinar", clinicalSource: "Inferencia Clínica IA", explanation: "Hueso afectado por la sospecha de lesión.", narrativeSentence: "Se sospecha de lesión ósea en la región evaluada.", approvedForTable: true },
            { key: "Tipo de Trazo", value: "Sin definir", clinicalSource: "Inferencia Clínica IA", explanation: "Orientación y cantidad de fragmentos.", narrativeSentence: "El trazo de fractura se describirá tras estudios de imagen complementarios.", approvedForTable: true },
            { key: "Alineación y Desplazamiento", value: "Conservada", clinicalSource: "Inferencia Clínica IA", explanation: "Desplazamiento relativo de los extremos óseos.", narrativeSentence: "Alineación ósea conservada.", approvedForTable: true },
            { key: "Angulación", value: "Ninguna", clinicalSource: "Inferencia Clínica IA", explanation: "Presencia de deformidad angular.", narrativeSentence: "Sin evidencia de angulación.", approvedForTable: true },
            { key: "Compromiso Articular", value: "Extraarticular", clinicalSource: "Inferencia Clínica IA", explanation: "Afectación de la superficie articular.", narrativeSentence: "Sin compromiso de la superficie articular.", approvedForTable: true },
            { key: "Compromiso de Partes Blandas", value: "Cerrada, sin enfisema", clinicalSource: "Inferencia Clínica IA", explanation: "Afectación de tejidos adyacentes o exposición.", narrativeSentence: "Partes blandas circundantes de aspecto habitual, sin evidencia de gas.", approvedForTable: true }
          ]);
        } else {
          setBone(data.bone || "Fractura detectada");
          const mappedAspects = data.aspects.map((asp: any) => ({
            ...asp,
            approvedForTable: true
          }));
          setAspects(mappedAspects);
          setSuccessMessage(`Se ha generado exitosamente el cuadro de sinopsis de fractura para '${data.bone || "la región descrita"}'.`);
        }
      } else {
        setError(data.error || "Error al confeccionar el análisis de fractura.");
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

  const handleAddAspect = () => {
    const newAspect: FractureAspect = {
      key: "Nuevo Aspecto",
      value: "Detalle clínico",
      clinicalSource: "Inferencia Clínica IA",
      explanation: "Parámetro personalizado agregado por el usuario.",
      narrativeSentence: "Frase descriptiva para insertar en el reporte.",
      approvedForTable: true
    };
    setAspects(prev => [...prev, newAspect]);
    handleStartEdit(aspects.length);
  };

  const generateMarkdownTable = (): string => {
    const approvedRows = aspects.filter(a => a.approvedForTable);
    if (approvedRows.length === 0) return "";

    let md = `| Parámetro de Fractura | Detalle Clínico / Valor |\n`;
    md += `| :--- | :--- |\n`;
    approvedRows.forEach(row => {
      md += `| **${row.key}** | ${row.value} |\n`;
    });
    return md;
  };

  const generateStructuredBlocks = (): string => {
    const approvedRows = aspects.filter(a => a.approvedForTable);
    if (approvedRows.length === 0) return "";

    let text = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += ` SINOPSIS DE FRACTURA: ${bone.toUpperCase()}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    approvedRows.forEach(row => {
      text += `▶ [${row.key.toUpperCase()}]\n  ${row.value.replace(/\n/g, "\n  ")}\n\n`;
    });

    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    return text;
  };

  const handleCopyBlocks = async () => {
    const textToCopy = generateStructuredBlocks();
    if (!textToCopy) {
      setError("No hay bloques clínicos seleccionados para copiar.");
      return;
    }
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setSuccessMessage("¡Bloques clínicos copiados al portapapeles con éxito!");
      setTimeout(() => {
        setCopied(false);
      }, 2000);
      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err) {
      console.error("Error al copiar al portapapeles: ", err);
      setError("No se pudo copiar al portapapeles automáticamente. Selecciona el texto de la vista previa y cópialo manualmente.");
    }
  };

  const handleInsertIntoReport = () => {
    const approvedCount = aspects.filter(a => a.approvedForTable).length;
    if (approvedCount === 0) {
      setError("No has seleccionado ningún aspecto para insertar.");
      return;
    }

    let blockToInsert = "";
    const sectionHeader = `### SINOPSIS DE FRACTURA: ${bone.toUpperCase()}`;

    if (exportFormat === "table") {
      const mdTable = generateMarkdownTable();
      blockToInsert = `\n\n### SINOPSIS DE FRACTURA: ${bone.toUpperCase()}\n\n${mdTable}\n`;
    } else {
      const blocksText = generateStructuredBlocks();
      blockToInsert = `\n\n### SINOPSIS DE FRACTURA: ${bone.toUpperCase()}\n\n${blocksText}\n`;
    }

    let current = reportText;
    const escapedHeader = `### SINOPSIS DE FRACTURA:`;
    const regex = new RegExp(`(\\n*${escapedHeader}[\\s\\S]*?)(?=\\n*###|$)`, 'i');

    if (regex.test(current)) {
      current = current.replace(regex, blockToInsert);
      setSuccessMessage(`Se ha actualizado la sinopsis de fractura en el reporte.`);
    } else {
      // Find where to append. Ideally before CONCLUSION or IMPRESION DIAGNOSTICA
      const conclusionIndex = current.toLowerCase().indexOf("### conclusión");
      const impresionIndex = current.toLowerCase().indexOf("### impresión diagnóstica");
      const targetIndex = conclusionIndex !== -1 ? conclusionIndex : (impresionIndex !== -1 ? impresionIndex : -1);

      if (targetIndex !== -1) {
        current = current.slice(0, targetIndex).trim() + `\n\n` + blockToInsert.trim() + `\n\n` + current.slice(targetIndex);
      } else {
        current = current.trim() + blockToInsert;
      }
      setSuccessMessage(`Se ha insertado la sinopsis de fractura en el reporte.`);
    }

    onReportUpdated(current);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);
  };

  const handleRetroactiveInsert = (index: number) => {
    const aspect = aspects[index];
    const sentence = aspect.narrativeSentence.trim();
    if (!sentence) return;

    let current = reportText;
    const lines = current.split("\n");
    let inserted = false;

    // Search for fracture descriptions or bones in the lines
    const boneKeywords = bone.split(" ").filter(w => w.length > 3);
    const boneRegexStr = boneKeywords.length > 0 ? `(${boneKeywords.join("|")})` : "fractura|ósea|hueso";
    const rx = new RegExp(boneRegexStr, "i");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (rx.test(line) && !line.toLowerCase().includes("sinopsis") && !line.toLowerCase().includes("cuadro")) {
        // Insert into or right after this line
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

    // Fallback 1: Under ### HALLAZGOS
    if (!inserted) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        if (line.includes("hallazgos") && (line.includes("###") || line.includes(":") || lines[i].trim().startsWith("**"))) {
          lines.splice(i + 1, 0, sentence);
          inserted = true;
          break;
        }
      }
    }

    // Fallback 2: At the end of the findings, right before CONCLUSION
    if (!inserted) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        if (line.includes("conclusión") || line.includes("impresión") || line.includes("### conclusión")) {
          lines.splice(i, 0, sentence + "\n");
          inserted = true;
          break;
        }
      }
    }

    if (!inserted) {
      current = current.trim() + `\n\n${sentence}`;
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

  const selectAll = (val: boolean) => {
    setAspects(prev => prev.map(a => ({ ...a, approvedForTable: val })));
  };

  return (
    <div id="creador-sinopsis-fracturas-container" className="bg-[#0b121f] border-2 border-emerald-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden space-y-6">
      
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
            <Bone className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest font-mono flex items-center gap-2">
              Sinopsis de Fractura <span className="text-[9px] bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 px-2 py-0.5 rounded uppercase">Traumatología</span>
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">
              Analiza las fracturas descritas para confeccionar cuadros de semiología ósea y realizar inyecciones retrógradas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerate}
            disabled={isLoading || !reportText.trim()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:bg-slate-800 disabled:text-slate-500 disabled:scale-100 text-slate-100 text-xs font-black uppercase tracking-wider rounded-xl transition-all font-mono flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/40"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-slate-200" />
                Analizando Fractura...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                {aspects.length > 0 ? "Re-analizar Reporte" : "Analizar Reporte de Fracturas 🦴"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notifications */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-[11px] font-mono flex items-center gap-2 font-bold"
          >
            <Check className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl text-[11px] font-mono flex flex-col gap-1.5"
          >
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              <span>Diagnóstico de Análisis:</span>
            </div>
            <p className="text-[10px] text-slate-300 leading-relaxed">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Area */}
      {aspects.length > 0 && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Bone identified info */}
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Región Ósea Identificada</span>
              <div className="flex items-center gap-2">
                <Bone className="h-4 w-4 text-emerald-400" />
                <input
                  type="text"
                  value={bone}
                  onChange={(e) => setBone(e.target.value)}
                  className="bg-transparent border-b border-slate-800 hover:border-slate-700 focus:border-emerald-500 focus:outline-none text-slate-200 text-xs font-bold font-mono py-0.5 px-1 w-64"
                  placeholder="Ej: Radio distal, Tercio medio de fémur"
                />
              </div>
            </div>

            {/* Formato de exportación */}
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono block md:text-right">Formato de Exportación</span>
              <div className="bg-slate-950 p-1 rounded-lg border border-slate-800 flex items-center gap-1">
                <button
                  onClick={() => setExportFormat("table")}
                  className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase font-mono tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                    exportFormat === "table"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Table className="h-3 w-3" />
                  Cuadro (PDF)
                </button>
                <button
                  onClick={() => setExportFormat("blocks")}
                  className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase font-mono tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                    exportFormat === "blocks"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <FileText className="h-3 w-3" />
                  Bloques Clínicos
                </button>
              </div>
            </div>
          </div>

          {/* Table of aspects */}
          <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-900/20">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800/60 text-left">
                <thead>
                  <tr className="bg-slate-950/80 text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">
                    <th className="py-3 px-4 w-12 text-center">
                      <button
                        onClick={() => selectAll(!aspects.every(a => a.approvedForTable))}
                        className="p-1 hover:text-slate-200 transition-all cursor-pointer"
                        title="Seleccionar/Deseleccionar todos"
                      >
                        {aspects.every(a => a.approvedForTable) ? (
                          <CheckSquare className="h-4 w-4 text-emerald-400 mx-auto" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-500 mx-auto" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4">Aspecto Clínico</th>
                    <th className="py-3 px-4 w-1/3">Detalle / Valor</th>
                    <th className="py-3 px-4">Origen</th>
                    <th className="py-3 px-4">Frase de Redacción</th>
                    <th className="py-3 px-4 w-24 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-xs">
                  {aspects.map((aspect, idx) => {
                    const isEditing = editingIndex === idx;

                    return (
                      <tr
                        key={idx}
                        className={`transition-colors duration-150 ${
                          isEditing
                            ? "bg-slate-850"
                            : aspect.approvedForTable
                            ? "bg-slate-900/5 hover:bg-slate-900/20"
                            : "bg-slate-950/20 hover:bg-slate-900/10 opacity-60"
                        }`}
                      >
                        {/* Include checkbox */}
                        <td className="py-4 px-4 text-center">
                          <button
                            onClick={() => toggleTableApproval(idx)}
                            className="p-1 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                          >
                            {aspect.approvedForTable ? (
                              <CheckSquare className="h-4 w-4 text-emerald-400 mx-auto" />
                            ) : (
                              <Square className="h-4 w-4 text-slate-600 mx-auto" />
                            )}
                          </button>
                        </td>

                        {/* Aspect key name */}
                        <td className="py-4 px-4">
                          <div className="font-bold text-slate-200 font-mono tracking-tight flex flex-col gap-0.5">
                            <span>{aspect.key}</span>
                            <span className="text-[9px] font-normal text-slate-500 normal-case leading-tight max-w-[200px]">
                              {aspect.explanation}
                            </span>
                          </div>
                        </td>

                        {/* Detalle / Valor */}
                        <td className="py-4 px-4">
                          {isEditing ? (
                            <textarea
                              value={editedValue}
                              onChange={(e) => setEditedValue(e.target.value)}
                              rows={2}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500 text-slate-200 font-medium"
                            />
                          ) : (
                            <div className="text-slate-300 font-medium whitespace-pre-line leading-relaxed">
                              {aspect.value}
                            </div>
                          )}
                        </td>

                        {/* Source + Retrograde Injection button */}
                        <td className="py-4 px-4">
                          {aspect.clinicalSource === "Hallazgo de Reporte" ? (
                            <span className="inline-block px-2 py-0.5 text-[8px] font-black uppercase rounded font-mono border bg-slate-950 text-indigo-450 border-indigo-900/30">
                              En Reporte
                            </span>
                          ) : (
                            <div className="space-y-1.5">
                              <span className="inline-block px-2 py-0.5 text-[8px] font-black uppercase rounded font-mono border bg-slate-950 text-emerald-450 border-emerald-900/30">
                                Sugerido IA
                              </span>
                              {aspect.retroInserted ? (
                                <div className="text-[9px] text-emerald-400 font-bold flex items-center gap-0.5 font-mono">
                                  <Check className="h-3 w-3" /> Inyectado
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleRetroactiveInsert(idx)}
                                  className="flex items-center justify-center gap-1 w-full py-1 px-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-[9px] font-black text-emerald-300 rounded hover:scale-105 active:scale-95 transition-all cursor-pointer font-mono"
                                  title="Inyectar este dato sugerido de manera retrógrada en el reporte base"
                                >
                                  <CornerUpLeft className="h-2.5 w-2.5 text-emerald-400" />
                                  Inyectar Base
                                </button>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Narrative Sentence */}
                        <td className="py-4 px-4">
                          {isEditing ? (
                            <textarea
                              value={editedSentence}
                              onChange={(e) => setEditedSentence(e.target.value)}
                              rows={3}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500 text-slate-200 font-medium"
                            />
                          ) : (
                            <div className="text-slate-400 italic text-[11px] leading-relaxed">
                              {aspect.narrativeSentence || "— No requiere frase narrativa —"}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {isEditing ? (
                              <button
                                onClick={() => handleSaveEdit(idx)}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-100 text-[10px] font-bold uppercase tracking-wider rounded font-mono cursor-pointer"
                              >
                                Guardar
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStartEdit(idx)}
                                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-all cursor-pointer"
                                title="Editar aspecto"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteAspect(idx)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 rounded transition-all cursor-pointer"
                              title="Eliminar aspecto"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Quick manual aspect insert button */}
            <div className="p-3.5 bg-slate-950/60 border-t border-slate-850 flex items-center justify-between gap-4">
              <span className="text-[10px] text-slate-500 font-medium">
                ¿Falta algún parámetro clínico? Agrégalo manualmente en el cuadro.
              </span>
              <button
                onClick={handleAddAspect}
                className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-emerald-500/30 text-emerald-400 hover:text-emerald-300 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all font-mono flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                Agregar Parámetro
              </button>
            </div>
          </div>

          {/* Render Preview of Output to insert */}
          <div className="p-5 bg-slate-950/90 border border-slate-850 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
              <div className="flex items-center gap-2">
                <Table className="h-4 w-4 text-emerald-400" />
                <h4 className="text-[11px] font-black text-slate-200 uppercase tracking-widest font-mono">
                  Vista Previa del Bloque a Insertar ({exportFormat === "table" ? "Cuadro" : "Bloques"})
                </h4>
              </div>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Formato Seleccionado: {exportFormat.toUpperCase()}</span>
            </div>

            <div className="bg-slate-900/40 p-4 rounded-lg border border-slate-850 max-h-48 overflow-y-auto">
              <pre className="text-[10px] font-mono text-emerald-300 whitespace-pre-wrap leading-relaxed">
                {exportFormat === "table" ? (
                  <>
                    <span className="text-slate-400 font-bold">### SINOPSIS DE FRACTURA: {bone.toUpperCase()}</span>
                    {"\n\n"}
                    {generateMarkdownTable()}
                  </>
                ) : (
                  generateStructuredBlocks()
                )}
              </pre>
            </div>

            {/* Action button based on export format */}
            <div className="flex justify-end">
              {exportFormat === "table" ? (
                <button
                  onClick={handleInsertIntoReport}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-100 text-xs font-black uppercase tracking-widest rounded-xl transition-all font-mono flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/40"
                >
                  <BookmarkCheck className="h-4 w-4" />
                  Insertar Sinopsis al Reporte Base
                </button>
              ) : (
                <button
                  onClick={handleCopyBlocks}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all font-mono flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/40 ${
                    copied
                      ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                      : "bg-emerald-600 hover:bg-emerald-500 text-slate-100"
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 animate-bounce" />
                      ¡Bloques Copiados!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar Bloques Clínicos
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Zero State if empty */}
      {aspects.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center text-center p-8 bg-slate-900/10 border border-dashed border-slate-800 rounded-xl space-y-4 py-12">
          <Bone className="h-12 w-12 text-slate-600 animate-pulse" />
          <div className="space-y-1.5 max-w-md">
            <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">Sin Análisis de Fracturas Activo</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Haz clic en el botón de arriba para escanear el reporte en tiempo real. El asistente confeccionará un cuadro semiológico completo, identificará alineación, tipo de trazo, compromiso articular y propondrá clasificaciones traumatológicas avanzadas.
            </p>
          </div>
        </div>
      )}

    </div>
  );
};
