import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Ruler, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Sparkles, 
  Info, 
  Plus, 
  Check, 
  RotateCcw,
  BookOpen,
  SlidersHorizontal,
  Zap,
  ChevronDown
} from "lucide-react";

interface MeasurementStructure {
  structure: string;
  normalRange: string;
  measuredValue: string;
  status: "normal" | "altered" | "not_found";
  interpretation: string;
  defaultNormalValue: string;
  customValue?: string; // Client state to override default assigned value
  wasNotFound?: boolean; // Client state to track if it was originally missing
}

interface AsistenteMedidasProps {
  selectedModel: string;
  reportText: string;
  onReportUpdated: (newText: string) => void;
  studyType?: string;
}

export const AsistenteMedidas: React.FC<AsistenteMedidasProps> = ({
  selectedModel,
  reportText,
  onReportUpdated,
  studyType
}) => {
  const [structures, setStructures] = useState<MeasurementStructure[]>([]);
  const [detectedStudyType, setDetectedStudyType] = useState<string>("");
  const [selectedForAssignment, setSelectedForAssignment] = useState<Record<string, boolean>>({});
  const [selectedForTable, setSelectedForTable] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAssigning, setIsAssigning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState<boolean>(false);

  // Configuration panel states
  const [defaultUnit, setDefaultUnit] = useState<"mm" | "cm">("mm");
  const [decimalPrecision, setDecimalPrecision] = useState<number>(1);
  const [openDropdownStructure, setOpenDropdownStructure] = useState<string | null>(null);

  // Formats a number: if integer (or ending in .0) returns as integer (e.g. "4"), else returns with commas (e.g. "4,3")
  const formatMeasurementNumber = (num: number, precision: number): string => {
    const fixedStr = num.toFixed(precision);
    const fixedNum = parseFloat(fixedStr);
    
    if (Number.isInteger(fixedNum)) {
      return fixedNum.toString();
    }
    
    return fixedStr.replace(".", ",");
  };

  // Value conversion helper function
  const convertValue = (valStr: string, targetUnit: "mm" | "cm", precision: number): string => {
    const trimmed = valStr.trim();
    if (!trimmed) return "";
    
    // Regular expression to match number and unit: e.g. "135 mm", "75 cm/s", "12.5 cm", etc.
    const match = trimmed.replace(",", ".").match(/^([\d.]+)\s*([a-zA-Z/]+)$/);
    if (!match) {
      // If it doesn't match a standard unit format, check if we can parse just the leading number
      const numMatch = trimmed.replace(",", ".").match(/^([\d.]+)/);
      if (numMatch) {
        const num = parseFloat(numMatch[1]);
        if (!isNaN(num)) {
          // If there is another text after the number, let's keep it. Otherwise, if it was purely a number (like IR: 0.60), keep it without adding targetUnit!
          const rest = trimmed.replace(numMatch[1], "").trim();
          if (rest) {
            return `${formatMeasurementNumber(num, precision)} ${rest.replace(".", ",")}`;
          }
          return formatMeasurementNumber(num, precision);
        }
      }
      return trimmed.replace(".", ",");
    }
    
    const num = parseFloat(match[1]);
    const currentUnit = match[2].trim();
    const currentUnitLower = currentUnit.toLowerCase();
    
    if (isNaN(num)) return trimmed.replace(".", ",");
    
    // ONLY convert if the current unit is mm or cm
    if (currentUnitLower === "mm" || currentUnitLower === "cm") {
      let convertedNum = num;
      if (currentUnitLower === "mm" && targetUnit === "cm") {
        convertedNum = num / 10;
      } else if (currentUnitLower === "cm" && targetUnit === "mm") {
        convertedNum = num * 10;
      }
      return `${formatMeasurementNumber(convertedNum, precision)} ${targetUnit}`;
    }
    
    // For other units (like cm/s, m/s, cc, etc.), do NOT convert to targetUnit (mm/cm). Keep original unit!
    return `${formatMeasurementNumber(num, precision)} ${currentUnit}`;
  };

  // Re-run conversion if configuration changes
  useEffect(() => {
    if (structures.length === 0) return;
    setStructures(prev => prev.map(s => {
      const convertedVal = convertValue(s.defaultNormalValue, defaultUnit, decimalPrecision);
      return {
        ...s,
        customValue: convertedVal
      };
    }));
  }, [defaultUnit, decimalPrecision]);

  // Automatically analyze on mount/load once if a report text is available
  useEffect(() => {
    if (reportText && reportText.trim() && !hasAnalyzed && !isLoading && structures.length === 0) {
      handleAnalyze();
    }
  }, [reportText]);

  // Re-run analysis if the report text becomes empty or if user wants to reset
  const handleAnalyze = async () => {
    if (!reportText.trim()) {
      setError("No hay texto de informe elaborado para analizar. Genera o escribe un reporte clínico primero.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/analyze-measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: reportText,
          studyType: studyType
        })
      });

      if (!response.ok) {
        throw new Error("Error en el servidor al analizar las medidas clínicas.");
      }

      const data = await response.json();
      if (data.success && data.structures) {
        const studyTitle = data.detectedStudyType || "Estudio Radiológico";
        setDetectedStudyType(studyTitle);
        // Initialize custom values for assigning and setup pre-selected state
        const processed: MeasurementStructure[] = data.structures.map((s: any) => {
          const convertedVal = convertValue(s.defaultNormalValue, defaultUnit, decimalPrecision);
          const wasNotFound = s.status === "not_found";

          let measuredValue = s.measuredValue;
          let status = s.status;
          let interpretation = s.interpretation;

          if (wasNotFound) {
            measuredValue = convertedVal;
            status = "normal";
            const nameLower = s.structure.toLowerCase();
            if (nameLower.includes("gim") || nameLower.includes("miointimal")) {
              interpretation = "Grosor miointimal conservado";
            } else if (nameLower.includes("relación") || nameLower.includes("ratio") || nameLower.includes("acc/aci")) {
              interpretation = "Relación normal";
            } else if (nameLower.includes("dirección") || nameLower.includes("flujo")) {
              interpretation = "Flujo anterógrado normal";
            } else if (nameLower.includes("placa")) {
              measuredValue = "Sin placas";
              interpretation = "Sin placas significativas";
            } else {
              interpretation = "Flujo normal";
            }
          }

          return {
            ...s,
            measuredValue,
            status,
            interpretation,
            customValue: convertedVal,
            wasNotFound
          };
        });
        
        const titleLower = studyTitle.toLowerCase();
        const isUnilateralDer = titleLower.includes("derecho") || titleLower.includes("unilateral derecho") || titleLower.includes("(unilateral d") || titleLower.includes("der.");
        const isUnilateralIzq = titleLower.includes("izquierdo") || titleLower.includes("unilateral izquierdo") || titleLower.includes("(unilateral i") || titleLower.includes("izq.");

        const isRight = (n: string) => /\b(derecho|derecha|der\.?)\b/i.test(n) || n.includes("derech") || n.includes("der.");
        const isLeft = (n: string) => /\b(izquierdo|izquierda|izq\.?)\b/i.test(n) || n.includes("izquierd") || n.includes("izq.");

        const finalProcessed = processed.filter(s => {
          if (isUnilateralDer && isLeft(s.structure.toLowerCase())) return false;
          if (isUnilateralIzq && isRight(s.structure.toLowerCase())) return false;
          return true;
        });

        setStructures(finalProcessed);
        
        // Auto-select structures that are NOT found for convenience
        const initialSelections: Record<string, boolean> = {};
        const initialTableSelections: Record<string, boolean> = {};
        finalProcessed.forEach((s) => {
          if (s.wasNotFound) {
            initialSelections[s.structure] = true;
          }
          // By default, check all of them to be included in the table. The user can then uncheck whatever they want!
          initialTableSelections[s.structure] = true;
        });
        setSelectedForAssignment(initialSelections);
        setSelectedForTable(initialTableSelections);
        setHasAnalyzed(true);
      } else {
        throw new Error(data.error || "Formato de respuesta inválido.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Ocurrió un error inesperado al analizar el reporte.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckboxToggle = (structureName: string) => {
    setSelectedForAssignment(prev => ({
      ...prev,
      [structureName]: !prev[structureName]
    }));
  };

  const handleTableCheckboxToggle = (structureName: string) => {
    setSelectedForTable(prev => ({
      ...prev,
      [structureName]: !prev[structureName]
    }));
  };

  const selectAllForAssignment = (val: boolean) => {
    const nextSelections: Record<string, boolean> = {};
    structures.forEach(s => {
      if (s.wasNotFound) {
        nextSelections[s.structure] = val;
      }
    });
    setSelectedForAssignment(nextSelections);
  };

  const selectAllForTable = (val: boolean) => {
    const nextSelections: Record<string, boolean> = {};
    structures.forEach(s => {
      nextSelections[s.structure] = val;
    });
    setSelectedForTable(nextSelections);
  };

  const handleCustomValueChange = (structureName: string, value: string) => {
    setStructures(prev => prev.map(s => {
      if (s.structure === structureName) {
        return { ...s, customValue: value };
      }
      return s;
    }));
  };

  const handleAssign = async (assignAll: boolean = false) => {
    // Collect selected measurements and format them nicely according to the rules
    const toAssign = structures
      .filter(s => s.wasNotFound && (assignAll || selectedForAssignment[s.structure]))
      .map(s => {
        let val = (s.measuredValue || s.customValue || s.defaultNormalValue).trim();
        const match = val.replace(",", ".").match(/^([\d.]+)\s*([a-zA-Z/]+)$/);
        if (match) {
          const num = parseFloat(match[1]);
          const unit = match[2];
          if (!isNaN(num)) {
            val = `${formatMeasurementNumber(num, decimalPrecision)} ${unit}`;
          }
        } else {
          const numMatch = val.replace(",", ".").match(/^([\d.]+)$/);
          if (numMatch) {
            const num = parseFloat(numMatch[1]);
            if (!isNaN(num)) {
              val = formatMeasurementNumber(num, decimalPrecision);
            }
          }
        }
        return {
          structure: s.structure,
          value: val
        };
      });

    if (toAssign.length === 0) {
      setError(
        assignAll 
          ? "No hay estructuras pendientes por medir en este informe." 
          : "Por favor, marca al menos una estructura sin medición registrada para poder asignarle una medida."
      );
      return;
    }

    setIsAssigning(true);
    setError(null);
    try {
      const response = await fetch("/api/assign-measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          currentReport: reportText,
          measurementsToAssign: toAssign
        })
      });

      if (!response.ok) {
        throw new Error("Error de comunicación al intentar inyectar las medidas normales.");
      }

      const data = await response.json();
      if (data.success && data.modifiedReport) {
        onReportUpdated(data.modifiedReport);
        
        // Update local structure status so the UI responds immediately as 'normal'
        setStructures(prev => prev.map(s => {
          const assigned = toAssign.find(t => t.structure === s.structure);
          if (assigned) {
            return {
              ...s,
              status: "normal",
              measuredValue: assigned.value,
              interpretation: s.interpretation || "Normal",
              wasNotFound: false // Mark as no longer missing since it's now in the report text
            };
          }
          return s;
        }));

        // Reset selected checkboxes for these assigned items
        setSelectedForAssignment(prev => {
          const copy = { ...prev };
          toAssign.forEach(t => {
            copy[t.structure] = false;
          });
          return copy;
        });
      } else {
        throw new Error(data.error || "No se pudo inyectar las medidas en el informe.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "No se pudo completar la asignación de medidas.");
    } finally {
      setIsAssigning(false);
    }
  };

  const cleanInterpretation = (interp: string, status: string): string => {
    const trimmed = (interp || "").trim();
    if (!trimmed) {
      return status === "normal" ? "Normal" : status === "altered" ? "Alterado" : "Sin medir";
    }
    const lower = trimmed.toLowerCase();
    if (
      lower === "parámetro normal asignado" || 
      lower === "parametro normal asignado" ||
      lower === "parámetro evaluado" ||
      lower === "normal" ||
      lower === "flujo normal" ||
      lower === "sin medir" ||
      lower === "sin medición registrada"
    ) {
      return status === "normal" ? "Normal" : status === "altered" ? "Alterado" : "Sin medir";
    }
    return trimmed
      .replace(/parámetro normal asignado/gi, status === "normal" ? "Normal" : "Alterado")
      .replace(/parametro normal asignado/gi, status === "normal" ? "Normal" : "Alterado");
  };

  const generateMarkdownTable = (): string => {
    const isVenous = detectedStudyType.toLowerCase().includes("venoso") || 
                     detectedStudyType.toLowerCase().includes("venosa") ||
                     detectedStudyType.toLowerCase().includes("vena");

    // Filter toInclude to ensure NO structures without measurements or with status 'not_found' are in the table
    const toInclude = structures.filter(s => 
      !!selectedForTable[s.structure] && 
      s.status !== "not_found" && 
      s.measuredValue && 
      s.measuredValue.trim() !== ""
    );
    if (toInclude.length === 0) return "";

    const isDopplerOrCarotidas = detectedStudyType.toLowerCase().includes("carot") || 
                                 detectedStudyType.toLowerCase().includes("doppler");

    // Let's count elements per side. To avoid showing empty columns for un-evaluated contralateral limbs,
    // we only consider a side "present" if it has at least one measured/assigned value.
    const isRight = (n: string) => /\b(derecho|derecha|der\.?)\b/i.test(n) || n.includes("derech") || n.includes("der.");
    const isLeft = (n: string) => /\b(izquierdo|izquierda|izq\.?)\b/i.test(n) || n.includes("izquierd") || n.includes("izq.");

    let hasRight = toInclude.some(s => isRight(s.structure.toLowerCase()) && s.status !== "not_found");
    let hasLeft = toInclude.some(s => isLeft(s.structure.toLowerCase()) && s.status !== "not_found");

    // Fallback: if absolutely nothing is measured yet on either side, show columns based on raw presence
    if (!hasRight && !hasLeft) {
      hasRight = toInclude.some(s => isRight(s.structure.toLowerCase()));
      hasLeft = toInclude.some(s => isLeft(s.structure.toLowerCase()));
    }

    // Force unilateral filtering based on study type if unilateral is detected
    const titleLower = detectedStudyType.toLowerCase();
    const isUnilateralDer = titleLower.includes("derecho") || titleLower.includes("unilateral derecho") || titleLower.includes("(unilateral d") || titleLower.includes("der.");
    const isUnilateralIzq = titleLower.includes("izquierdo") || titleLower.includes("unilateral izquierdo") || titleLower.includes("(unilateral i") || titleLower.includes("izq.");

    if (isUnilateralDer) {
      hasLeft = false;
      hasRight = true;
    } else if (isUnilateralIzq) {
      hasRight = false;
      hasLeft = true;
    }

    if (isDopplerOrCarotidas || hasRight || hasLeft) {
      // Group structures by baseName
      const groups: { [baseName: string]: { right?: MeasurementStructure; left?: MeasurementStructure; none?: MeasurementStructure } } = {};
      
      toInclude.forEach(s => {
        const name = s.structure;
        let side: 'right' | 'left' | 'none' = 'none';
        
        if (/\b(derecho|derecha|der\.?)\b/i.test(name) || name.toLowerCase().includes("derech") || name.toLowerCase().includes("der.")) {
          side = 'right';
        } else if (/\b(izquierdo|izquierda|izq\.?)\b/i.test(name) || name.toLowerCase().includes("izquierd") || name.toLowerCase().includes("izq.")) {
          side = 'left';
        }
        
        // Clean the name to get the baseName
        let baseName = name
          .replace(/[\s,]+(derecho|derecha|derechos|derechas|der\.?)\b/ig, "")
          .replace(/\b(derecho|derecha|derechos|derechas|der\.?)[\s,]+/ig, " ")
          .replace(/[\s,]+(izquierdo|izquierda|izquierdos|izquierdas|izq\.?)\b/ig, "")
          .replace(/\b(izquierdo|izquierda|izquierdos|izquierdas|izq\.?)[\s,]+/ig, " ")
          .replace(/\s+/g, " ")
          .trim();
        
        // Clean any leftovers like leading/trailing commas, dashes, or empty parenthesis
        baseName = baseName
          .replace(/^[:;,\s\-]+|[:;,\s\-]+$/g, "")
          .replace(/\(\s*\)/g, "")
          .replace(/\[\s*\]/g, "")
          .replace(/\s+/g, " ")
          .trim();
          
        if (!groups[baseName]) {
          groups[baseName] = {};
        }
        groups[baseName][side] = s;
      });

      const formatCell = (s: MeasurementStructure | undefined) => {
        if (!s) return "—";
        let val = s.measuredValue || "";
        if (!val) return "🟡 Sin medir";
        
        val = val.replace(/\.0\b/g, "").replace(/\./g, ",");
        const emoji = s.status === "normal" ? "🟢" : s.status === "altered" ? "🔴" : "🟡";
        
        const displayInterp = cleanInterpretation(s.interpretation || "", s.status);
        
        return `**${val}** (${emoji} ${displayInterp})`;
      };

      const tableTitle = detectedStudyType.toLowerCase().includes("carot")
        ? "CUADRO DE MEDICIONES CLÍNICAS (DOPPLER CAROTÍDEO)"
        : `CUADRO DE MEDICIONES CLÍNICAS (${detectedStudyType.toUpperCase()})`;

      let table = `### 📊 ${tableTitle}\n\n`;

      const isBilateral = hasRight && hasLeft;
      const isUnilateralRight = hasRight && !hasLeft;
      const isUnilateralLeft = !hasRight && hasLeft;

      if (isBilateral || (!isUnilateralRight && !isUnilateralLeft)) {
        // Bilateral or fallback
        if (isVenous) {
          table += `| Estructura | Derecha | Izquierda |\n`;
          table += `| :--- | :---: | :---: |\n`;
        } else {
          table += `| Estructura | Derecha | Izquierda | Valor de Referencia |\n`;
          table += `| :--- | :---: | :---: | :---: |\n`;
        }

        Object.entries(groups).forEach(([baseName, sides]) => {
          const rightS = sides.right;
          const leftS = sides.left;
          const noneS = sides.none;
          
          let rightVal = "—";
          let leftVal = "—";
          
          if (rightS) {
            rightVal = formatCell(rightS);
          }
          if (leftS) {
            leftVal = formatCell(leftS);
          }
          if (noneS) {
            rightVal = formatCell(noneS);
            leftVal = "—"; // Unilateral
          }

          if (isVenous) {
            table += `| **${baseName}** | ${rightVal} | ${leftVal} |\n`;
          } else {
            // Handle case where reference ranges may differ slightly per side
            let range = "—";
            if (rightS && leftS && rightS.normalRange && leftS.normalRange && rightS.normalRange !== leftS.normalRange) {
              range = `Der: ${rightS.normalRange.replace(/\.0\b/g, "").replace(/\./g, ",")} / Izq: ${leftS.normalRange.replace(/\.0\b/g, "").replace(/\./g, ",")}`;
            } else {
              const refObj = rightS || leftS || noneS;
              range = refObj && refObj.normalRange ? refObj.normalRange.replace(/\.0\b/g, "").replace(/\./g, ",") : "—";
            }
            table += `| **${baseName}** | ${rightVal} | ${leftVal} | ${range} |\n`;
          }
        });
      } else if (isUnilateralRight) {
        // Unilateral Right only
        if (isVenous) {
          table += `| Estructura | Derecha |\n`;
          table += `| :--- | :---: |\n`;
        } else {
          table += `| Estructura | Derecha | Valor de Referencia |\n`;
          table += `| :--- | :---: | :---: |\n`;
        }

        Object.entries(groups).forEach(([baseName, sides]) => {
          const rightS = sides.right || sides.none;
          if (!rightS) return;
          const rightVal = formatCell(rightS);
          if (isVenous) {
            table += `| **${baseName}** | ${rightVal} |\n`;
          } else {
            const range = rightS && rightS.normalRange ? rightS.normalRange.replace(/\.0\b/g, "").replace(/\./g, ",") : "—";
            table += `| **${baseName}** | ${rightVal} | ${range} |\n`;
          }
        });
      } else {
        // Unilateral Left only
        if (isVenous) {
          table += `| Estructura | Izquierda |\n`;
          table += `| :--- | :---: |\n`;
        } else {
          table += `| Estructura | Izquierda | Valor de Referencia |\n`;
          table += `| :--- | :---: | :---: |\n`;
        }

        Object.entries(groups).forEach(([baseName, sides]) => {
          const leftS = sides.left || sides.none;
          if (!leftS) return;
          const leftVal = formatCell(leftS);
          if (isVenous) {
            table += `| **${baseName}** | ${leftVal} |\n`;
          } else {
            const range = leftS && leftS.normalRange ? leftS.normalRange.replace(/\.0\b/g, "").replace(/\./g, ",") : "—";
            table += `| **${baseName}** | ${leftVal} | ${range} |\n`;
          }
        });
      }
      
      table += `\n`;
      return table;
    } else {
      // Standard single-column table for non-bilateral studies
      let table = `### 📊 CUADRO DE MEDICIONES CLÍNICAS\n\n`;
      if (isVenous) {
        table += `| Estructura / Parámetro | Medida Registrada | Estado / Interpretación |\n`;
        table += `| :--- | :---: | :--- |\n`;
      } else {
        table += `| Estructura / Parámetro | Medida Registrada | Rango de Referencia | Estado / Interpretación |\n`;
        table += `| :--- | :---: | :---: | :--- |\n`;
      }
      
      toInclude.forEach(s => {
        let val = s.measuredValue || "";
        if (val) {
          val = val.replace(/\.0\b/g, "").replace(/\./g, ",");
        } else {
          val = "—";
        }
        
        const displayInterp = cleanInterpretation(s.interpretation || "", s.status);
        const statusEmoji = s.status === "normal" ? "🟢" : s.status === "altered" ? "🔴" : "🟡";
        
        if (isVenous) {
          table += `| **${s.structure}** | ${val} | ${statusEmoji} ${displayInterp} |\n`;
        } else {
          const range = s.normalRange ? s.normalRange.replace(/\.0\b/g, "").replace(/\./g, ",") : "";
          table += `| **${s.structure}** | ${val} | ${range} | ${statusEmoji} ${displayInterp} |\n`;
        }
      });
      table += `\n`;
      return table;
    }
  };

  const handleEmbedTable = () => {
    const tableMarkdown = generateMarkdownTable();
    if (!tableMarkdown) {
      setError("No hay mediciones registradas en el reporte actualmente para poder generar un cuadro.");
      return;
    }

    const tableHeaderRegex = /### 📊 CUADRO DE MEDICIONES CLÍNICAS[\s\S]*?(?=(?:###|$))/g;
    let newReport = reportText;
    if (tableHeaderRegex.test(reportText)) {
      newReport = reportText.replace(tableHeaderRegex, tableMarkdown);
    } else {
      newReport = reportText.trim() + "\n\n" + tableMarkdown;
    }

    onReportUpdated(newReport);

    const btn = document.getElementById("embed-table-btn");
    if (btn) {
      const originalText = btn.innerHTML;
      btn.innerHTML = "<span>✅ ¡Cuadro de Medidas Incrustado!</span>";
      setTimeout(() => {
        btn.innerHTML = originalText;
      }, 3000);
    }
  };

  // Helper values
  const hasNotFound = structures.some(s => s.wasNotFound);
  const selectedCount = Object.values(selectedForAssignment).filter(Boolean).length;

  const isDopplerArterialMiembroInferior = 
    detectedStudyType.toLowerCase().includes("doppler arterial") && 
    (detectedStudyType.toLowerCase().includes("inferior") || detectedStudyType.toLowerCase().includes("inferiores") || detectedStudyType.toLowerCase().includes("miembro"));

  const isVascular = 
    detectedStudyType.toLowerCase().includes("doppler") || 
    detectedStudyType.toLowerCase().includes("carot") || 
    detectedStudyType.toLowerCase().includes("vascular") ||
    detectedStudyType.toLowerCase().includes("arterial") ||
    detectedStudyType.toLowerCase().includes("venoso") ||
    structures.some(s => {
      const n = s.structure.toLowerCase();
      return n.includes("arteria") || n.includes("vps") || n.includes("ved") || n.includes("vessel") || n.includes("vena");
    });

  const handleApplyPreset = (structureName: string, optionVal: string, optionStatus: "normal" | "altered" | "not_found", optionInterp: string) => {
    setStructures(prev => prev.map(s => {
      if (s.structure === structureName) {
        const currentVal = s.measuredValue || "";
        const match = currentVal.match(/(\d+(?:[.,]\d+)?)/);
        let finalVal = optionVal;
        if (match && (
          optionVal.toLowerCase().includes("trifás") || 
          optionVal.toLowerCase().includes("monofás") || 
          optionVal.toLowerCase().includes("bifás") || 
          optionVal.toLowerCase().includes("atenuad") || 
          optionVal.toLowerCase().includes("espectral") || 
          optionVal.toLowerCase().includes("filiform")
        )) {
          const num = match[1];
          finalVal = `${num} cm/s, ${optionVal}`;
        }
        return {
          ...s,
          measuredValue: finalVal,
          status: optionStatus,
          interpretation: optionInterp
        };
      }
      return s;
    }));
    setOpenDropdownStructure(null);
  };

  return (
    <div className="bg-[#0b0e17] border-2 border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden" id="asistente-medidas-root">
      {/* Glow decorative effects */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-pink-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600/10 border border-indigo-500/30 rounded-2xl shadow-[0_0_15px_rgba(99,102,241,0.15)]">
            <Ruler className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-white uppercase tracking-widest font-mono">
                Asistente de Medidas Clínicas
              </h2>
              <span className="text-[8px] font-black tracking-widest uppercase bg-indigo-950 text-indigo-400 border border-indigo-900/50 px-2 py-0.5 rounded font-mono">
                Módulo Inteligente
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
              Analiza el reporte actual para identificar estructuras que se pueden medir. Asigna valores normales con un solo clic si faltan.
            </p>
            {detectedStudyType && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono">Estudio Detectado:</span>
                <span className="text-[10px] font-black text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded font-mono uppercase tracking-wider">
                  {detectedStudyType}
                </span>
              </div>
            )}
          </div>
        </div>

        {hasAnalyzed && (
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isLoading || !reportText.trim()}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-xs font-black uppercase tracking-wider text-slate-300 rounded-xl transition-all flex items-center gap-2 disabled:opacity-40 cursor-pointer"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-indigo-400" /> : <RotateCcw className="h-4 w-4 text-indigo-400" />}
            <span>Volver a Analizar</span>
          </button>
        )}
      </div>

      {/* Configuration Panel */}
      <div 
        id="medidas-panel"
        className="mb-6 p-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-300"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider font-mono">
              Configuración de Medidas
            </h4>
            <p className="text-[10px] text-slate-500 uppercase font-mono mt-0.5">
              Define el formato por defecto de las asignaciones automáticas
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
          {/* Units selector */}
          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono">
              Unidad Predeterminada
            </span>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800/80">
              <button
                type="button"
                onClick={() => setDefaultUnit("mm")}
                className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  defaultUnit === "mm"
                    ? "bg-indigo-600/20 border border-indigo-500/40 text-indigo-300"
                    : "bg-transparent text-slate-500 hover:text-slate-350"
                }`}
              >
                Milímetros (mm)
              </button>
              <button
                type="button"
                onClick={() => setDefaultUnit("cm")}
                className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  defaultUnit === "cm"
                    ? "bg-indigo-600/20 border border-indigo-500/40 text-indigo-300"
                    : "bg-transparent text-slate-500 hover:text-slate-350"
                }`}
              >
                Centímetros (cm)
              </button>
            </div>
          </div>

          {/* Precision Selector */}
          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono">
              Precisión Decimal
            </span>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800/80">
              {[0, 1, 2].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDecimalPrecision(p)}
                  className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                    decimalPrecision === p
                      ? "bg-indigo-600/20 border border-indigo-500/40 text-indigo-300"
                      : "bg-transparent text-slate-500 hover:text-slate-350"
                  }`}
                >
                  {p} {p === 1 ? "Decimal" : "Decimales"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-5 p-4 bg-red-950/40 border border-red-500/30 rounded-xl flex items-start gap-3"
          >
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-xs font-bold text-red-200">Error en Asistente de Medidas</h4>
              <p className="text-[11px] text-red-400 mt-1">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main UI body */}
      {!hasAnalyzed ? (
        <div className="flex flex-col items-center justify-center py-14 px-6 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-950/20 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-indigo-400 shadow-inner">
            <Sparkles className="h-7 w-7 text-indigo-400 animate-pulse" />
          </div>
          <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider font-mono">
            Analizar estructuras susceptibles de medición
          </h3>
          <p className="text-[11px] text-slate-500 max-w-md mt-2 leading-relaxed">
            Al activar el asistente, la inteligencia artificial revisará minuciosamente tu informe actual, determinará los órganos o partes relevantes, leerá las medidas existentes y te indicará si son correctas o faltan.
          </p>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isLoading || !reportText.trim()}
            className="mt-6 px-6 py-3 bg-indigo-600 hover:bg-indigo-550 disabled:bg-slate-900 border-2 border-indigo-500/10 hover:border-indigo-400/20 rounded-xl text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-500/10 flex items-center gap-2.5 transition-all cursor-pointer disabled:opacity-40"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Analizando Reporte con IA...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-indigo-200" />
                <span>Analizar Informe Elaborado</span>
              </>
            )}
          </button>
          {!reportText.trim() && (
            <span className="text-[10px] text-amber-500/75 uppercase tracking-wider font-mono mt-2.5">
              ⚠️ Primero debes generar o rellenar un reporte en el "Generador"
            </span>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="p-4 bg-slate-950/80 border border-slate-850 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase font-mono">Total Analizados</p>
                <p className="text-xl font-bold text-slate-200 font-mono mt-1">{structures.length}</p>
              </div>
              <BookOpen className="h-5 w-5 text-slate-500" />
            </div>
            <div className="p-4 bg-slate-950/80 border border-slate-850 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase font-mono">Con Medida (Normal/Altera)</p>
                <p className="text-xl font-bold text-emerald-400 font-mono mt-1">
                  {structures.filter(s => s.status === "normal").length} / <span className="text-amber-400">{structures.filter(s => s.status === "altered").length}</span>
                </p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="p-4 bg-slate-950/80 border border-slate-850 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase font-mono">Pendientes de Reporte</p>
                <p className="text-xl font-bold text-slate-400 font-mono mt-1">
                  {structures.filter(s => s.wasNotFound).length}
                </p>
              </div>
              <Ruler className="h-5 w-5 text-indigo-400" />
            </div>
          </div>

          {/* Quick Selection Helpers */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/40 p-3.5 border border-slate-850 rounded-2xl">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider font-mono">
              ⚡ Controles de Selección Rápida:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => selectAllForAssignment(true)}
                className="px-2.5 py-1.5 bg-indigo-950/30 hover:bg-indigo-900/30 border border-indigo-900/50 text-indigo-400 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Seleccionar Todo para Reporte
              </button>
              <button
                type="button"
                onClick={() => selectAllForAssignment(false)}
                className="px-2.5 py-1.5 bg-slate-900/55 hover:bg-slate-850/80 border border-slate-800 text-slate-400 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Vaciar Selección Reporte
              </button>
              <div className="w-[1px] h-4 bg-slate-800 self-center hidden sm:block"></div>
              <button
                type="button"
                onClick={() => selectAllForTable(true)}
                className="px-2.5 py-1.5 bg-emerald-950/30 hover:bg-emerald-900/30 border border-emerald-900/50 text-emerald-400 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Seleccionar Todo para Cuadro
              </button>
              <button
                type="button"
                onClick={() => selectAllForTable(false)}
                className="px-2.5 py-1.5 bg-slate-900/55 hover:bg-slate-850/80 border border-slate-800 text-slate-400 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Vaciar Selección Cuadro
              </button>
            </div>
          </div>

          {/* Measurements List Table */}
          <div className="border border-slate-850 rounded-2xl overflow-hidden bg-slate-950/30">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 bg-slate-950 text-[10px] font-mono font-black uppercase text-slate-500 tracking-wider">
                    <th className="py-3.5 px-4 w-12 text-center">Sel.</th>
                    <th className="py-3.5 px-4">Estructura</th>
                    <th className="py-3.5 px-4">Rango Normal</th>
                    <th className="py-3.5 px-4">Medida Reportada</th>
                    <th className="py-3.5 px-4">Diagnóstico / Estado</th>
                    <th className="py-3.5 px-4 text-center">En Cuadro</th>
                    <th className="py-3.5 px-4 text-right">Asignar Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 text-xs">
                  {structures.map((item) => {
                    const isSelected = !!selectedForAssignment[item.structure];
                    const isInTable = !!selectedForTable[item.structure];
                    const isMissing = !!item.wasNotFound;

                    return (
                      <tr 
                        key={item.structure}
                        className={`hover:bg-slate-900/30 transition-colors border-l-2 ${
                          isSelected 
                            ? "bg-indigo-950/40 border-l-indigo-500 text-indigo-100" 
                            : "border-l-transparent"
                        }`}
                      >
                        {/* Selector checkbox */}
                        <td className="py-4 px-4 text-center">
                          {isMissing ? (
                            <label className="relative flex items-center justify-center cursor-pointer select-none">
                              <input 
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleCheckboxToggle(item.structure)}
                                className="sr-only"
                              />
                              <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all border ${
                                isSelected 
                                  ? "bg-indigo-600 border-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]" 
                                  : "bg-slate-900 border-slate-700 hover:border-indigo-500"
                              }`}>
                                <Check className={`h-3.5 w-3.5 text-white transition-all font-bold ${isSelected ? "scale-100" : "scale-0"}`} />
                              </div>
                            </label>
                          ) : (
                            <span className="text-[10px] text-slate-600 font-mono font-black">—</span>
                          )}
                        </td>

                        {/* Structure Name */}
                        <td className="py-4 px-4 font-bold text-slate-200">
                          {item.structure}
                        </td>

                        {/* Normal Range */}
                        <td className="py-4 px-4 text-slate-400 font-mono text-[11px]">
                          {item.normalRange ? item.normalRange.replace(/\.0\b/g, "").replace(/\./g, ",") : ""}
                        </td>

                        {/* Current Value in Report */}
                        <td className="py-2.5 px-4 relative">
                          <div className="relative flex items-center max-w-[170px]">
                            <input 
                              type="text"
                              value={item.measuredValue || ""}
                              onClick={() => isDopplerArterialMiembroInferior && setOpenDropdownStructure(item.structure)}
                              onFocus={() => isDopplerArterialMiembroInferior && setOpenDropdownStructure(item.structure)}
                              onChange={(e) => {
                                const val = e.target.value;
                                setStructures(prev => prev.map(s => {
                                  if (s.structure === item.structure) {
                                    return {
                                      ...s,
                                      measuredValue: val,
                                      status: val ? (s.status === "not_found" ? "normal" : s.status) : "not_found"
                                    };
                                  }
                                  return s;
                                }));
                              }}
                              className={`w-full bg-slate-900/60 hover:bg-slate-900 border focus:bg-slate-900 focus:outline-none focus:ring-1 transition-all rounded-lg pl-2.5 py-1.5 text-[11px] font-mono font-bold ${
                                isDopplerArterialMiembroInferior ? "pr-8 cursor-pointer" : "pr-2.5"
                              } ${
                                item.status === "normal"
                                  ? "border-emerald-900/40 focus:border-emerald-500 focus:ring-emerald-500/20 text-emerald-400 placeholder-emerald-800"
                                  : item.status === "altered"
                                    ? "border-amber-900/40 focus:border-amber-500 focus:ring-amber-500/20 text-amber-400 placeholder-amber-800"
                                    : "border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20 text-slate-400 placeholder-slate-600"
                              }`}
                              placeholder="Pendiente..."
                            />
                            
                            {/* Preset Dropdown Button */}
                            {isDopplerArterialMiembroInferior && (
                              <button
                                type="button"
                                onClick={() => setOpenDropdownStructure(openDropdownStructure === item.structure ? null : item.structure)}
                                className="absolute right-1.5 p-1 text-slate-500 hover:text-slate-350 transition-colors cursor-pointer flex items-center justify-center"
                                title="Selección rápida"
                              >
                                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${openDropdownStructure === item.structure ? "rotate-180 text-indigo-400" : ""}`} />
                              </button>
                            )}

                            {/* Dropdown Options List */}
                            {isDopplerArterialMiembroInferior && openDropdownStructure === item.structure && (
                              <>
                                {/* Invisible Backdrop to Close */}
                                <div 
                                  className="fixed inset-0 z-40" 
                                  onClick={() => setOpenDropdownStructure(null)} 
                                />
                                <div className="absolute right-0 top-full mt-1 w-56 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-50 py-1.5 overflow-hidden text-left">
                                  <div className="px-2.5 py-1 border-b border-slate-900 mb-1">
                                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider font-mono">
                                      {isVascular ? "Flujos Vasculares (Doppler):" : "Opciones Rápidas:"}
                                    </span>
                                  </div>
                                  
                                  {isVascular ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleApplyPreset(item.structure, "Trifásico", "normal", "Flujo normal (Onda Trifásica)")}
                                        className="w-full text-left px-2.5 py-1.5 text-[11px] font-bold text-emerald-400 hover:bg-slate-900 transition-colors flex items-center justify-between cursor-pointer"
                                      >
                                        <span>🟢 Trifásico (Normal)</span>
                                        <span className="text-[9px] text-slate-500 font-mono font-normal">Normal</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleApplyPreset(item.structure, "Flujo bifásico", "altered", "Estenosis leve")}
                                        className="w-full text-left px-2.5 py-1.5 text-[11px] font-bold text-amber-300 hover:bg-slate-900 transition-colors flex items-center justify-between cursor-pointer"
                                      >
                                        <span>🟡 Bifásico</span>
                                        <span className="text-[9px] text-slate-500 font-mono font-normal">Leve</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleApplyPreset(item.structure, "Flujo atenuado", "altered", "Estenosis leve")}
                                        className="w-full text-left px-2.5 py-1.5 text-[11px] font-bold text-amber-300 hover:bg-slate-900 transition-colors flex items-center justify-between cursor-pointer"
                                      >
                                        <span>🟡 Flujo Atenuado</span>
                                        <span className="text-[9px] text-slate-500 font-mono font-normal">Leve</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleApplyPreset(item.structure, "Ensanchamiento espectral", "altered", "Estenosis moderada")}
                                        className="w-full text-left px-2.5 py-1.5 text-[11px] font-bold text-amber-400 hover:bg-slate-900 transition-colors flex items-center justify-between cursor-pointer"
                                      >
                                        <span>🟠 Ensanch. Espectral</span>
                                        <span className="text-[9px] text-slate-500 font-mono font-normal">Mod.</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleApplyPreset(item.structure, "Flujo monofásico", "altered", "Estenosis severa")}
                                        className="w-full text-left px-2.5 py-1.5 text-[11px] font-bold text-amber-500 hover:bg-slate-900 transition-colors flex items-center justify-between cursor-pointer"
                                      >
                                        <span>🔴 Monofásico</span>
                                        <span className="text-[9px] text-slate-500 font-mono font-normal">Severa</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleApplyPreset(item.structure, "Flujo filiforme", "altered", "Estenosis muy severa/oclusión")}
                                        className="w-full text-left px-2.5 py-1.5 text-[11px] font-bold text-red-400 hover:bg-slate-900 transition-colors flex items-center justify-between cursor-pointer"
                                      >
                                        <span>🛑 Filiforme</span>
                                        <span className="text-[9px] text-slate-500 font-mono font-normal">Muy Sev.</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleApplyPreset(item.structure, "Flujo no detectable", "altered", "Estenosis muy severa/oclusión")}
                                        className="w-full text-left px-2.5 py-1.5 text-[11px] font-bold text-red-500 hover:bg-slate-900 transition-colors flex items-center justify-between cursor-pointer"
                                      >
                                        <span>🛑 No detectable</span>
                                        <span className="text-[9px] text-slate-500 font-mono font-normal">Oclusión</span>
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleApplyPreset(item.structure, "Normal", "normal", "Características normales")}
                                        className="w-full text-left px-2.5 py-1.5 text-[11px] font-bold text-emerald-400 hover:bg-slate-900 transition-colors flex items-center justify-between cursor-pointer"
                                      >
                                        <span>🟢 Normal</span>
                                        <span className="text-[9px] text-slate-500 font-mono font-normal">Normal</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleApplyPreset(item.structure, "Aumentado de tamaño", "altered", "Aumento de tamaño / Organomegalia")}
                                        className="w-full text-left px-2.5 py-1.5 text-[11px] font-bold text-amber-400 hover:bg-slate-900 transition-colors flex items-center justify-between cursor-pointer"
                                      >
                                        <span>🟠 Aumentado</span>
                                        <span className="text-[9px] text-slate-500 font-mono font-normal">Alterado</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleApplyPreset(item.structure, "Disminuido de tamaño", "altered", "Disminución de tamaño / Atrofia")}
                                        className="w-full text-left px-2.5 py-1.5 text-[11px] font-bold text-amber-400 hover:bg-slate-900 transition-colors flex items-center justify-between cursor-pointer"
                                      >
                                        <span>🟡 Disminuido</span>
                                        <span className="text-[9px] text-slate-500 font-mono font-normal">Alterado</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleApplyPreset(item.structure, "Heterogéneo", "altered", "Parénquima heterogéneo")}
                                        className="w-full text-left px-2.5 py-1.5 text-[11px] font-bold text-amber-300 hover:bg-slate-900 transition-colors flex items-center justify-between cursor-pointer"
                                      >
                                        <span>🟡 Heterogéneo</span>
                                        <span className="text-[9px] text-slate-500 font-mono font-normal">Alterado</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleApplyPreset(item.structure, "Litos visibles", "altered", "Colelitiasis / Nefrolitiasis")}
                                        className="w-full text-left px-2.5 py-1.5 text-[11px] font-bold text-amber-500 hover:bg-slate-900 transition-colors flex items-center justify-between cursor-pointer"
                                      >
                                        <span>🔴 Litos Visibles</span>
                                        <span className="text-[9px] text-slate-500 font-mono font-normal">Alterado</span>
                                      </button>
                                    </>
                                  )}

                                  <div className="h-[1px] bg-slate-900 my-1" />
                                  <button
                                    type="button"
                                    onClick={() => handleApplyPreset(item.structure, item.customValue || item.defaultNormalValue, "normal", isVascular ? "Flujo normal (Onda Trifásica)" : "Características normales")}
                                    className="w-full text-left px-2.5 py-1.5 text-[10px] font-bold text-indigo-400 hover:bg-slate-900 transition-colors flex items-center justify-between cursor-pointer"
                                  >
                                    <span>✨ Usar Valor Sano</span>
                                    <span className="text-[9px] text-slate-500 font-mono truncate max-w-[80px]">{(item.customValue || item.defaultNormalValue)}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleApplyPreset(item.structure, "", "not_found", "Sin medición registrada")}
                                    className="w-full text-left px-2.5 py-1.5 text-[10px] font-bold text-slate-400 hover:bg-slate-900 transition-colors flex items-center justify-between cursor-pointer"
                                  >
                                    <span>🔄 Limpiar campo</span>
                                    <span className="text-[9px] text-slate-500 font-mono">Borrar</span>
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Status badge and explanation */}
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <select
                              value={item.status}
                              onChange={(e) => {
                                const newStatus = e.target.value as "normal" | "altered" | "not_found";
                                setStructures(prev => prev.map(s => {
                                  if (s.structure === item.structure) {
                                    let defaultInterp = s.interpretation;
                                    if (newStatus === "normal" && (!s.interpretation || s.interpretation.toLowerCase().includes("estenosis") || s.interpretation.toLowerCase().includes("sin med"))) {
                                      defaultInterp = "Flujo normal (Onda Trifásica)";
                                    } else if (newStatus === "altered" && (!s.interpretation || s.interpretation.toLowerCase().includes("flujo normal"))) {
                                      defaultInterp = "Estenosis moderada";
                                    } else if (newStatus === "not_found") {
                                      defaultInterp = "Sin medición registrada";
                                    }
                                    return { ...s, status: newStatus, interpretation: defaultInterp };
                                  }
                                  return s;
                                }));
                              }}
                              className={`bg-slate-900/80 border rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-all focus:outline-none focus:ring-1 cursor-pointer ${
                                item.status === "normal" 
                                  ? "text-emerald-400 border-emerald-950/60 bg-emerald-950/20 focus:border-emerald-500 focus:ring-emerald-500/20" 
                                  : item.status === "altered"
                                    ? "text-amber-400 border-amber-950/60 bg-amber-950/20 focus:border-amber-500 focus:ring-amber-500/20"
                                    : "text-slate-400 border-slate-800 bg-slate-900/40 focus:border-indigo-500 focus:ring-indigo-500/20"
                              }`}
                            >
                              <option value="normal" className="bg-slate-950 text-emerald-400 font-bold">Normal</option>
                              <option value="altered" className="bg-slate-950 text-amber-400 font-bold">Alterado</option>
                              <option value="not_found" className="bg-slate-950 text-slate-500 font-bold">Pendiente</option>
                            </select>

                            {item.status !== "not_found" && (
                              <input
                                type="text"
                                value={item.interpretation || ""}
                                placeholder="Interpretación..."
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setStructures(prev => prev.map(s => {
                                    if (s.structure === item.structure) {
                                      return { ...s, interpretation: val };
                                    }
                                    return s;
                                  }));
                                }}
                                className="bg-slate-900/40 hover:bg-slate-900/60 focus:bg-slate-900 border border-slate-800/80 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 rounded-lg px-2.5 py-1 text-[11px] text-slate-200 w-full min-w-[140px] max-w-[220px] transition-all placeholder:text-slate-600 font-medium font-sans"
                              />
                            )}
                          </div>
                        </td>

                        {/* En Cuadro Selector */}
                        <td className="py-4 px-4 text-center">
                          <label className="relative flex items-center justify-center cursor-pointer select-none">
                            <input 
                              type="checkbox"
                              checked={isInTable}
                              onChange={() => handleTableCheckboxToggle(item.structure)}
                              className="sr-only"
                            />
                            <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all border ${
                              isInTable 
                                ? "bg-emerald-600 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" 
                                : "bg-slate-900 border-slate-700 hover:border-emerald-500"
                            }`}>
                              <Check className={`h-3.5 w-3.5 text-white transition-all font-bold ${isInTable ? "scale-100" : "scale-0"}`} />
                            </div>
                          </label>
                        </td>

                        {/* Default assign value overrides */}
                        <td className="py-4 px-4 text-right">
                          {isMissing ? (
                            <div className="inline-flex items-center gap-1.5 bg-slate-900 px-2 py-1 border border-slate-800 rounded-xl">
                              <span className="text-[10px] font-black text-slate-500 uppercase font-mono select-none">Val:</span>
                              <input 
                                type="text"
                                value={item.customValue || ""}
                                onChange={(e) => handleCustomValueChange(item.structure, e.target.value)}
                                className="bg-transparent text-xs font-bold font-mono text-slate-200 text-center w-16 focus:outline-none focus:text-indigo-400 border-none p-0"
                                placeholder={item.defaultNormalValue}
                              />
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-600 font-mono uppercase">Registrado</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Sections */}
          <div className="space-y-4">
            {/* Section 1: Inyectar en Reporte */}
            {hasNotFound && (
              <div className="p-5 bg-slate-950/80 border border-indigo-500/20 rounded-2xl flex flex-col gap-4 shadow-[0_0_20px_rgba(99,102,241,0.03)]">
                <div className="flex items-center gap-2.5 text-left">
                  <Sparkles className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
                  <div>
                    <h5 className="text-xs font-black uppercase tracking-wider text-indigo-400 font-mono">
                      1. Inyectar Medidas en el Texto del Reporte
                    </h5>
                    <p className="text-[11px] text-slate-400 leading-normal font-medium mt-0.5">
                      La Inteligencia Artificial redactará de forma natural los valores seleccionados directamente en los hallazgos descritos del informe.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-end items-center gap-3 mt-1.5">
                  <button
                    type="button"
                    onClick={() => handleAssign(false)}
                    disabled={isAssigning || selectedCount === 0}
                    className="w-full sm:w-auto px-5 py-3 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:border-indigo-500/50 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md disabled:opacity-30 disabled:pointer-events-none active:scale-95 transition-all cursor-pointer font-mono"
                  >
                    {isAssigning ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Procesando...</span>
                      </>
                    ) : (
                      <>
                        <Ruler className="h-4 w-4" />
                        <span>Asignar Seleccionadas ({selectedCount})</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAssign(true)}
                    disabled={isAssigning || structures.filter(s => s.wasNotFound).length === 0}
                    className="w-full sm:w-auto px-5 py-3 bg-indigo-600 hover:bg-indigo-550 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg disabled:opacity-30 disabled:pointer-events-none active:scale-95 transition-all cursor-pointer font-mono"
                  >
                    {isAssigning ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Procesando...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 text-indigo-200" />
                        <span>Asignar TODAS las Pendientes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Section 2: Incrustar Cuadro */}
            <div className="p-5 bg-slate-950/85 border border-emerald-500/20 rounded-2xl flex flex-col gap-4 shadow-[0_0_20px_rgba(16,185,129,0.03)]">
              <div className="flex items-center gap-2.5 text-left">
                <SlidersHorizontal className="h-4.5 w-4.5 text-emerald-400 shrink-0" />
                <div>
                  <h5 className="text-xs font-black uppercase tracking-wider text-emerald-400 font-mono">
                    2. Insertar Cuadro de Mediciones Elegante
                  </h5>
                  <p className="text-[11px] text-slate-400 leading-normal font-medium mt-0.5">
                    Genera una tabla elegante en formato Markdown al final del informe conteniendo únicamente los parámetros seleccionados en la columna "En Cuadro".
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end items-center gap-3 mt-1.5">
                <button
                  type="button"
                  id="embed-table-btn"
                  onClick={handleEmbedTable}
                  disabled={structures.filter(s => !!selectedForTable[s.structure]).length === 0}
                  className="w-full sm:w-auto px-6 py-3 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/50 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-md disabled:opacity-30 disabled:pointer-events-none active:scale-95 transition-all cursor-pointer font-mono"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>Incrustar Cuadro Seleccionado ({structures.filter(s => !!selectedForTable[s.structure]).length})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
