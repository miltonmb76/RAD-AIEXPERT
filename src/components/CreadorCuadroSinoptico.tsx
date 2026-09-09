import React, { useState, useEffect, useRef } from "react";
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
  CornerUpLeft,
  X,
  Crosshair
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
  const [isInjecting, setIsInjecting] = useState<boolean>(false);
  const [autoRetrogradeInject, setAutoRetrogradeInject] = useState<boolean>(true);
  const [includeSynopticSection, setIncludeSynopticSection] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showDirectives, setShowDirectives] = useState<boolean>(true);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedValue, setEditedValue] = useState<string>("");
  const [editedSentence, setEditedSentence] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  /** Sticky quick bar so organ can be chosen while other modules/images load. */
  const [quickBarVisible, setQuickBarVisible] = useState<boolean>(true);
  const [quickBarCollapsed, setQuickBarCollapsed] = useState<boolean>(false);
  const quickOrganRef = useRef<HTMLInputElement>(null);
  const panelOrganRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus immediately when the module opens (batch auto-open or manual).
    const t = window.setTimeout(() => {
      if (quickBarVisible && !quickBarCollapsed) {
        quickOrganRef.current?.focus();
        quickOrganRef.current?.select();
      } else {
        panelOrganRef.current?.focus();
      }
    }, 80);
    return () => window.clearTimeout(t);
  }, []);

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
        } else {
          // Results ready: collapse quick bar so it doesn't cover the table.
          setQuickBarCollapsed(true);
          requestAnimationFrame(() => {
            document
              .getElementById("creador-cuadro-sinoptico-container")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
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

  // Build the complete synoptic section block (Markdown Table + Resumen Interpretativo paragraph)
  const generateFullSynopticBlock = (): string => {
    const mdTable = generateMarkdownTable();
    const narrativeText = generateNarrativeParagraph();

    if (!mdTable && !narrativeText) return "";

    let block = "";
    if (mdTable) {
      block += mdTable + "\n";
    }
    if (narrativeText) {
      block += `\n**Resumen Interpretativo:** ${narrativeText}\n`;
    }
    return block.trim();
  };

  const performLocalInsert = (sentencesToInject: string[], fullSynopticContent: string) => {
    let current = reportText;

    if (sentencesToInject.length > 0) {
      const organEscaped = organ.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const organRegex = new RegExp(`(\\b${organEscaped}\\b)`, 'i');
      const lines = current.split("\n");
      let inserted = false;

      const sentenceBlock = sentencesToInject.join(" ");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (organRegex.test(line) && !line.toLowerCase().includes("sinopsis") && !line.toLowerCase().includes("cuadro")) {
          if (line.trim().endsWith(":") || line.trim().startsWith("###") || line.trim().startsWith("**")) {
            if (lines[i + 1] && lines[i + 1].trim() !== "" && !lines[i + 1].trim().startsWith("###")) {
              lines[i + 1] = lines[i + 1].trim() + " " + sentenceBlock;
            } else {
              lines.splice(i + 1, 0, sentenceBlock);
            }
          } else {
            lines[i] = line.trim() + " " + sentenceBlock;
          }
          inserted = true;
          break;
        }
      }

      if (!inserted) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].toLowerCase();
          if (line.includes("hallazgos") && (line.includes("###") || line.includes(":") || lines[i].trim().startsWith("**"))) {
            lines.splice(i + 1, 0, `- **${organ}**: ${sentenceBlock}`);
            inserted = true;
            break;
          }
        }
      }

      if (!inserted) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].toLowerCase();
          if (line.includes("conclusión") || line.includes("impresión diagnóstica")) {
            lines.splice(i, 0, `- **${organ}**: ${sentenceBlock}\n`);
            inserted = true;
            break;
          }
        }
      }

      if (!inserted) {
        current = current.trim() + `\n\n- **${organ}**: ${sentenceBlock}`;
      } else {
        current = lines.join("\n");
      }
    }

    if (includeSynopticSection && fullSynopticContent) {
      const sectionHeader = `### SINOPSIS CLÍNICA DE ${organ.toUpperCase()}`;
      let blockToInsert = `\n\n### SINOPSIS CLÍNICA DE ${organ.toUpperCase()}\n\n${fullSynopticContent}\n`;
      
      const escapedHeader = sectionHeader.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regexWithDash = new RegExp(`(\\n*---\\n*${escapedHeader}[\\s\\S]*?)(?=(\\n*---)|\\n*###|$)`, 'i');
      const regexWithoutDash = new RegExp(`(\\n*${escapedHeader}[\\s\\S]*?)(?=\\n*###|$)`, 'i');

      if (regexWithDash.test(current)) {
        current = current.replace(regexWithDash, blockToInsert);
      } else if (regexWithoutDash.test(current)) {
        current = current.replace(regexWithoutDash, blockToInsert);
      } else {
        const impMatch = current.match(/(###?\s*(?:IMPRESI[OÓ]N\s+DIAGN[OÓ]STICA|CONCLUSI[OÓ]N|CONCLUSIONES)[\s\S]*?)(?=\n###|\n---|$)/i);
        if (impMatch) {
          const impEndIndex = impMatch.index! + impMatch[0].length;
          current = current.slice(0, impEndIndex) + blockToInsert + current.slice(impEndIndex);
        } else {
          current = current.trim() + blockToInsert;
        }
      }
    }

    onReportUpdated(current);
    setSuccessMessage(`Se ha insertado la sinopsis con el cuadro y su resumen interpretativo para '${organ}'.`);
    setAspects(prev => prev.map(a => ({ ...a, retroInserted: true })));
  };

  const handleInsertIntoReport = async () => {
    const fullSynopticBlock = generateFullSynopticBlock();
    const approvedSentences = aspects
      .filter(a => a.approvedForReportText && a.narrativeSentence.trim())
      .map(a => a.narrativeSentence.trim());

    if (!fullSynopticBlock && approvedSentences.length === 0) {
      setError("No has aprobado ningún aspecto para insertar.");
      return;
    }

    setIsInjecting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/inject-organ-synoptic-retrograde", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: reportText,
          organ: organ,
          sentencesToInject: autoRetrogradeInject ? approvedSentences : [],
          synopticTableMarkdown: includeSynopticSection ? fullSynopticBlock : "",
          includeSynopticTable: includeSynopticSection
        })
      });

      const data = await response.json();
      if (data.success && data.updatedReport) {
        onReportUpdated(data.updatedReport);
        setSuccessMessage(
          data.summaryOfInjections ||
            `Se han inyectado retrógradamente los hallazgos e insertado el cuadro con el resumen interpretativo para '${organ}'.`
        );
        setAspects(prev =>
          prev.map(a => (a.approvedForReportText ? { ...a, retroInserted: true } : a))
        );
      } else {
        performLocalInsert(autoRetrogradeInject ? approvedSentences : [], fullSynopticBlock);
      }
    } catch (err) {
      console.warn("Error en inyección retrógrada por API, usando fallback local:", err);
      performLocalInsert(autoRetrogradeInject ? approvedSentences : [], fullSynopticBlock);
    } finally {
      setIsInjecting(false);
      setTimeout(() => {
        setSuccessMessage(null);
      }, 6000);
    }
  };

  const handleRetroactiveInsert = async (index: number) => {
    const aspect = aspects[index];
    const sentence = aspect.narrativeSentence.trim();
    if (!sentence) return;

    setIsInjecting(true);
    setError(null);

    try {
      const response = await fetch("/api/inject-organ-synoptic-retrograde", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: reportText,
          organ: organ,
          sentencesToInject: [sentence],
          includeSynopticTable: false
        })
      });

      const data = await response.json();
      if (data.success && data.updatedReport) {
        onReportUpdated(data.updatedReport);
        setSuccessMessage(`Inyección retrógrada e imperceptible realizada: "${sentence}"`);
        setAspects(prev => prev.map((asp, idx) => (idx === index ? { ...asp, retroInserted: true } : asp)));
      } else {
        performLocalInsert([sentence], "");
      }
    } catch (err) {
      performLocalInsert([sentence], "");
    } finally {
      setIsInjecting(false);
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    }
  };

  const selectAllTable = (val: boolean) => {
    setAspects(prev => prev.map(a => ({ ...a, approvedForTable: val })));
  };

  const selectAllReport = (val: boolean) => {
    setAspects(prev => prev.map(a => ({ ...a, approvedForReportText: val })));
  };

  const canGenerate = !isLoading && !!organ.trim() && !!reportText.trim();

  const scrollToFullPanel = () => {
    document
      .getElementById("creador-cuadro-sinoptico-container")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div id="creador-cuadro-sinoptico-container" className="bg-slate-900/60 border-2 border-indigo-500/30 rounded-3xl p-6 shadow-2xl space-y-6">
      {/* Sticky quick bar: reachable while Atlas/images/other modules load */}
      <AnimatePresence>
        {quickBarVisible && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-3 left-3 right-3 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[min(720px,calc(100vw-1.5rem))] z-[70] pointer-events-auto"
          >
            <div className="rounded-2xl border border-indigo-400/40 bg-slate-950/95 backdrop-blur-md shadow-2xl shadow-indigo-950/50 overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-indigo-900/40 bg-indigo-950/40">
                <div className="flex items-center gap-2 min-w-0">
                  <Crosshair className="h-3.5 w-3.5 text-indigo-300 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-200 font-mono truncate">
                    Sinopsis por órgano — acceso rápido
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={scrollToFullPanel}
                    className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 hover:text-indigo-300 px-2 py-1 rounded-lg hover:bg-slate-900 cursor-pointer"
                    title="Ir al panel completo"
                  >
                    Panel
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickBarCollapsed((v) => !v)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900 cursor-pointer"
                    title={quickBarCollapsed ? "Expandir" : "Minimizar"}
                  >
                    {quickBarCollapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickBarVisible(false)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-slate-900 cursor-pointer"
                    title="Cerrar barra rápida"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {!quickBarCollapsed && (
                <div className="p-3 space-y-2.5">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      ref={quickOrganRef}
                      type="text"
                      value={organ}
                      onChange={(e) => setOrgan(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && canGenerate) {
                          e.preventDefault();
                          handleGenerate();
                        }
                      }}
                      placeholder="Órgano o sistema (ej. Hígado, Tiroides…)"
                      className="flex-1 bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none font-semibold"
                    />
                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={!canGenerate}
                      className={`shrink-0 px-4 py-2.5 rounded-xl font-mono text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                        canGenerate
                          ? "bg-indigo-600 hover:bg-indigo-500 border-indigo-400 text-white"
                          : "bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed"
                      }`}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Generando…
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          Generar
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-[72px] overflow-y-auto">
                    {POPULAR_ORGANS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setOrgan(item);
                          requestAnimationFrame(() => quickOrganRef.current?.focus());
                        }}
                        className={`px-2 py-1 text-[10px] font-mono rounded-lg border transition-all cursor-pointer ${
                          organ.toLowerCase() === item.toLowerCase()
                            ? "bg-indigo-500/20 border-indigo-400/60 text-indigo-200"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>

                  {error && (
                    <p className="text-[10px] text-rose-300 font-mono leading-snug">{error}</p>
                  )}
                  {!reportText.trim() && (
                    <p className="text-[10px] text-amber-300/90 font-mono">
                      Esperando el informe… la barra queda lista; genera cuando el texto esté disponible.
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!quickBarVisible && (
        <button
          type="button"
          onClick={() => {
            setQuickBarVisible(true);
            setQuickBarCollapsed(false);
            window.setTimeout(() => quickOrganRef.current?.focus(), 100);
          }}
          className="fixed bottom-4 right-4 z-[70] px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-wider font-mono shadow-lg border border-indigo-400/40 flex items-center gap-2 cursor-pointer"
        >
          <Crosshair className="h-3.5 w-3.5" />
          Sinopsis
        </button>
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-teal-900/40 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-500/10 rounded-xl border border-teal-500/25 text-teal-300">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest font-mono">
              Sinopsis por órgano
            </h3>
            <p className="text-[10px] text-slate-400 uppercase font-mono tracking-wider mt-0.5">
              Ficha clínica estructurada del informe
            </p>
          </div>
        </div>
        {organ.trim() ? (
          <span className="text-[10px] font-bold uppercase font-mono tracking-wider bg-teal-950/60 text-teal-200 border border-teal-700/40 px-3 py-1 rounded-full truncate max-w-[12rem]">
            {organ.trim()}
          </span>
        ) : (
          <span className="text-[9px] font-black uppercase font-mono tracking-widest bg-slate-950 text-slate-500 border border-slate-800 px-3 py-1 rounded-full">
            Sin órgano aún
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-slate-400 leading-relaxed">
        Elige el órgano o estructura y genera una ficha <strong className="text-slate-300">Aspecto → Hallazgo</strong> lista para revisar e inyectar al informe.
        {" "}
        <span className="text-teal-300/90">
          Mientras cargan imágenes u otros módulos, usa la barra fija inferior.
        </span>
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
              ref={panelOrganRef}
              type="text"
              value={organ}
              onChange={e => setOrgan(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canGenerate) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
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
          disabled={!canGenerate}
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

      {/* Result Section — ficha clínica (Aspecto | Hallazgo, sin columna Origen) */}
      <AnimatePresence>
        {aspects.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-5 pt-6 border-t border-slate-800"
          >
            <div className="relative overflow-hidden rounded-2xl border border-teal-500/25 bg-gradient-to-br from-slate-950 via-slate-950 to-teal-950/30">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/50 to-transparent" />
              <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-teal-400/90">
                    Sinopsis estructurada
                  </p>
                  <h4 className="mt-1 text-2xl md:text-3xl font-semibold text-slate-50 tracking-tight truncate">
                    {organ.trim() || "Órgano"}
                  </h4>
                  <p className="mt-2 text-[11px] text-slate-400 font-mono">
                    {aspects.length} aspecto{aspects.length === 1 ? "" : "s"}
                    {" · "}
                    {aspects.filter((a) => a.approvedForTable).length} en tabla
                    {" · "}
                    {aspects.filter((a) => a.approvedForReportText).length} en texto
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap shrink-0">
                  <button
                    type="button"
                    onClick={() => selectAllTable(true)}
                    className="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-900 border border-slate-700 text-[9px] font-black text-teal-300 hover:text-teal-200 uppercase tracking-widest rounded-lg font-mono cursor-pointer transition-all"
                  >
                    Toda la tabla
                  </button>
                  <button
                    type="button"
                    onClick={() => selectAllReport(true)}
                    className="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-900 border border-slate-700 text-[9px] font-black text-emerald-400 hover:text-emerald-300 uppercase tracking-widest rounded-lg font-mono cursor-pointer transition-all"
                  >
                    Todo el texto
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950/40">
              <div className="grid grid-cols-[minmax(7rem,28%)_1fr] gap-0 px-4 py-2.5 bg-slate-950 border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                <div>Aspecto</div>
                <div className="flex items-center justify-between gap-2">
                  <span>Hallazgo</span>
                  <span className="text-[9px] text-slate-600 normal-case tracking-normal font-medium hidden sm:inline">
                    Tabla · Texto · Acciones
                  </span>
                </div>
              </div>

              <div className="divide-y divide-slate-800/80">
                {aspects.map((aspect, idx) => {
                  const dimmed = !aspect.approvedForTable && !aspect.approvedForReportText;
                  const isAiInfer = aspect.clinicalSource !== "Hallazgo de Reporte";
                  return (
                    <div
                      key={idx}
                      className={`grid grid-cols-1 sm:grid-cols-[minmax(7rem,28%)_1fr] gap-2 sm:gap-0 px-4 py-3.5 transition-colors ${
                        dimmed ? "opacity-45" : "hover:bg-slate-900/30"
                      }`}
                    >
                      <div className="pr-3">
                        <p className="text-sm font-semibold text-slate-100 leading-snug">
                          {aspect.key}
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-start gap-3 min-w-0">
                        <div className="flex-1 min-w-0 space-y-1.5">
                          {editingIndex === idx ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={editedValue}
                                onChange={(e) => setEditedValue(e.target.value)}
                                className="w-full bg-slate-950 border border-teal-500/40 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                                placeholder="Hallazgo / valor"
                              />
                              <textarea
                                value={editedSentence}
                                onChange={(e) => setEditedSentence(e.target.value)}
                                rows={2}
                                className="w-full bg-slate-950 border border-teal-500/40 rounded-lg px-2.5 py-1.5 text-xs text-white resize-none outline-none"
                                placeholder="Frase narrativa"
                              />
                            </div>
                          ) : (
                            <>
                              <p className="text-sm text-slate-200 font-medium leading-relaxed">
                                {aspect.value}
                              </p>
                              {aspect.explanation && (
                                <p className="text-[11px] text-slate-500 leading-snug">
                                  {aspect.explanation}
                                </p>
                              )}
                              {aspect.narrativeSentence && (
                                <p className="text-[11px] text-slate-400 italic leading-relaxed border-l-2 border-teal-800/50 pl-2.5">
                                  {aspect.narrativeSentence}
                                </p>
                              )}
                              {isAiInfer && !aspect.retroInserted && (
                                <button
                                  type="button"
                                  onClick={() => handleRetroactiveInsert(idx)}
                                  className="inline-flex items-center gap-1 mt-1 px-2 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-[9px] font-bold text-amber-300 font-mono cursor-pointer"
                                  title="Inyectar este dato sugerido en el reporte base"
                                >
                                  <CornerUpLeft className="h-2.5 w-2.5" />
                                  Inyectar al texto base
                                </button>
                              )}
                              {aspect.retroInserted && (
                                <span className="inline-flex items-center gap-1 text-[9px] text-emerald-400 font-mono font-bold">
                                  <Check className="h-3 w-3" /> Inyectado al texto base
                                </span>
                              )}
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 self-start">
                          <button
                            type="button"
                            onClick={() => toggleTableApproval(idx)}
                            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-teal-300 hover:border-teal-500/40 cursor-pointer"
                            title="Incluir en tabla"
                          >
                            {aspect.approvedForTable ? (
                              <CheckSquare className="h-4 w-4" />
                            ) : (
                              <Square className="h-4 w-4 text-slate-600" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleReportApproval(idx)}
                            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 hover:border-emerald-500/40 cursor-pointer"
                            title="Incluir en texto"
                          >
                            {aspect.approvedForReportText ? (
                              <CheckSquare className="h-4 w-4" />
                            ) : (
                              <Square className="h-4 w-4 text-slate-600" />
                            )}
                          </button>
                          {editingIndex === idx ? (
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(idx)}
                              className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 cursor-pointer"
                              title="Guardar"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStartEdit(idx)}
                              className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
                              title="Editar"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteAspect(idx)}
                            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-500 hover:text-rose-400 cursor-pointer"
                            title="Descartar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 font-mono">
                  Texto narrativo aprobado
                </span>
              </div>
              {generateNarrativeParagraph() ? (
                <p className="text-sm text-slate-300 leading-relaxed">
                  {generateNarrativeParagraph()}
                </p>
              ) : (
                <p className="text-[11px] text-slate-600 italic">
                  Ninguna frase aprobada para el informe.
                </p>
              )}
            </div>

            <div className="bg-slate-950/60 p-4 rounded-2xl border border-teal-900/30 space-y-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-teal-400 font-mono block">
                Inserción al informe
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-300">
                <label className="flex items-start gap-2.5 cursor-pointer select-none bg-slate-900/80 p-3 rounded-xl border border-slate-800 hover:border-teal-500/40 transition-all">
                  <input
                    type="checkbox"
                    checked={autoRetrogradeInject}
                    onChange={e => setAutoRetrogradeInject(e.target.checked)}
                    className="rounded text-teal-500 focus:ring-teal-500 h-4 w-4 bg-slate-950 border-slate-700 cursor-pointer mt-0.5"
                  />
                  <div>
                    <span className="font-bold text-slate-200 block text-[11px]">
                      Inyección retrógrada en el texto base
                    </span>
                    <span className="text-[9.5px] text-slate-400 font-sans block leading-relaxed mt-0.5">
                      Integra los puntos aprobados en la sección de {organ || "órgano"} del cuerpo del informe.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer select-none bg-slate-900/80 p-3 rounded-xl border border-slate-800 hover:border-teal-500/40 transition-all">
                  <input
                    type="checkbox"
                    checked={includeSynopticSection}
                    onChange={e => setIncludeSynopticSection(e.target.checked)}
                    className="rounded text-teal-500 focus:ring-teal-500 h-4 w-4 bg-slate-950 border-slate-700 cursor-pointer mt-0.5"
                  />
                  <div>
                    <span className="font-bold text-slate-200 block text-[11px]">
                      Adjuntar cuadro sinóptico
                    </span>
                    <span className="text-[9.5px] text-slate-400 font-sans block leading-relaxed mt-0.5">
                      Agrega <strong>### SINOPSIS CLÍNICA DE {organ ? organ.toUpperCase() : "ÓRGANO"}</strong> al final del informe.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-teal-950/20 border border-teal-500/25 rounded-2xl">
              <div className="flex items-start gap-2.5">
                <Info className="h-5 w-5 text-teal-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-teal-100/90 leading-normal max-w-xl">
                  Los hallazgos aprobados se incorporarán al informe activo según las opciones de arriba.
                </p>
              </div>

              <button
                onClick={handleInsertIntoReport}
                disabled={isInjecting}
                className="w-full sm:w-auto px-6 py-3.5 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-900/60 disabled:cursor-not-allowed text-white rounded-xl text-[11px] font-black uppercase tracking-widest cursor-pointer transition-all flex items-center justify-center gap-2 font-mono shadow-xl border border-teal-400/30 hover:scale-[1.02] active:scale-[0.98]"
              >
                {isInjecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-teal-100" />
                    <span>Inyectando al Reporte...</span>
                  </>
                ) : (
                  <>
                    <BookmarkCheck className="h-4 w-4" />
                    <span>Inyectar al informe</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
