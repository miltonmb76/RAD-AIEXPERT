import React from "react";
import { renderBoldTextSafe } from "./reportTextHelpers";

export function highlightRadiologicalText(
  text: string,
  keyPrefix: string,
  opts: {
    isSyntacticHighlightingActive: boolean;
    showPathology: boolean;
    showAnatomy: boolean;
    showNormal: boolean;
    showTechnical: boolean;
    reportTheme: string;
  },
) {
  if (!text) return "";
  if (!opts.isSyntacticHighlightingActive) {
    return renderBoldTextSafe(text, keyPrefix);
  }

  const boldRegex = /\*\*(.*?)\*\*/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let keyCounter = 0;
  let match;

  const getHighlightCategory = (word: string) => {
    const w = word.toLowerCase();
    
    // Pathologies / Anomalies
    const pathologies = [
      "fractura", "fractur", "trazos", "trazo", "desplazamiento", "fisura", "compromiso articular", 
      "luxación", "subluxación", "fx", "reducción", "rediccion", "pinzamiento", "osteofito", "osteofitos", 
      "osteofitosis", "esclerosis", "derrame", "nódulo", "nodulo", "infiltrado", "estenosis", "hernia", 
      "protusión", "desgarro", "tendinopatía", "disminuido", "disminución", "patológico", "anómalo", 
      "ruptura", "calcificación", "lesión", "lesion", "inflamación"
    ];
    if (opts.showPathology && pathologies.some(p => w.includes(p) || p.includes(w) && w.length > 4)) {
      return {
        category: "Patología / Alteración",
        colorClass: "text-rose-450 bg-rose-500/10 hover:bg-rose-500/20 border-b border-rose-500/50",
        indicator: "🔴",
        description: "Hallazgo patológico o alteración estructural detectada en el estudio."
      };
    }

    // Anatomy
    const anatomy = [
      "fémur", "femur", "tibia", "peroné", "perone", "rótula", "rotula", "patelar", "codo", "húmero", "humero", 
      "radio", "cúbito", "cubito", "carótida", "carotida", "menisco", "ligamento", "pulmón", "pulmon", 
      "pulmonar", "hilio", "hiliar", "mediastino", "columna", "vértebra", "vertebra", "cervical", 
      "lumbar", "dorsal", "articulación", "articulacion", "muscular", "esquelético", "femoral", 
      "femorotibial", "tíbioperonea", "tibiofibular", "meniscos", "pulmones", "carotídeo"
    ];
    if (opts.showAnatomy && anatomy.some(a => w.includes(a) || a.includes(w) && w.length > 4)) {
      return {
        category: "Anatomía",
        colorClass: "text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border-b border-cyan-500/50",
        indicator: "🔵",
        description: "Mención de estructura anatómica o región evaluada."
      };
    }

    // Normal findings
    const normals = [
      "conservado", "conservada", "sin hallazgos", "normal", "respetado", "respetada", "adecuado", 
      "adecuada", "libre", "no se aprecia", "no se observa", "negativo", "integro", "íntegro", 
      "estables", "preservada", "preservado", "uniforme", "homogéneo", "homogénea"
    ];
    if (opts.showNormal && normals.some(n => w.includes(n) || n.includes(w) && w.length > 5)) {
      return {
        category: "Normalidad / Conservado",
        colorClass: "text-emerald-450 bg-emerald-500/10 hover:bg-emerald-500/20 border-b border-emerald-500/50",
        indicator: "🟢",
        description: "Signo o estructura anatómica con morfología conservada o normal."
      };
    }

    // Measurements / parameters / scales / technical
    const technical = [
      "mm", "cm", "grados", "kv", "mas", "secuencia", "t1", "t2", "axial", "sagital", 
      "coronal", "escala", "criterio", "clasificación", "clasificacion", "cie-10", "icd-10"
    ];
    if (opts.showTechnical && technical.some(t => w === t || w.includes(t) && w.length > 2)) {
      return {
        category: "Técnica / Medida",
        colorClass: "text-purple-450 bg-purple-500/10 hover:bg-purple-500/20 border-b border-purple-500/50",
        indicator: "🟣",
        description: "Métrica, escala clínica, clasificación o parámetro de adquisición."
      };
    }

    return null;
  };

  const processTextSegment = (plainText: string, isBold: boolean, segmentKey: string) => {
    const wordPattern = /([a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\d-]+)/g;
    const subParts: React.ReactNode[] = [];
    let lastSubIndex = 0;
    let subMatch;
    let subCounter = 0;

    while ((subMatch = wordPattern.exec(plainText)) !== null) {
      const matchIndex = subMatch.index;
      if (matchIndex > lastSubIndex) {
        subParts.push(plainText.substring(lastSubIndex, matchIndex));
      }
      
      const matchedWord = subMatch[1];
      const matchDetails = getHighlightCategory(matchedWord);

      if (matchDetails) {
        subParts.push(
          <span 
            key={`${segmentKey}-word-${subCounter++}`} 
            className={`cursor-help px-0.5 rounded transition-all inline relative group select-all ${matchDetails.colorClass}`}
          >
            {isBold ? (
              <strong className={`font-extrabold ${opts.reportTheme === 'academic-light' || opts.reportTheme === 'clinical-minimal' ? 'text-black' : 'text-white'}`}>
                {matchedWord}
              </strong>
            ) : matchedWord}
            {/* Tooltip dynamic styling */}
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-52 bg-slate-900 border border-slate-700 text-slate-100 p-2 rounded-xl shadow-2xl text-[10px] leading-relaxed z-[999] pointer-events-none select-none font-sans font-medium text-center">
              <span className="flex items-center gap-1 mb-1 font-black justify-center">
                <span>{matchDetails.indicator}</span>
                <span className="uppercase text-[8px] tracking-wider text-white">{matchDetails.category}</span>
              </span>
              {matchDetails.description}
            </span>
          </span>
        );
      } else {
        subParts.push(
          isBold ? (
            <strong key={`${segmentKey}-plain-${subCounter++}`} className={`font-bold ${opts.reportTheme === 'academic-light' || opts.reportTheme === 'clinical-minimal' ? 'text-slate-950 font-black' : 'text-white'}`}>
              {matchedWord}
            </strong>
          ) : matchedWord
        );
      }
      lastSubIndex = wordPattern.lastIndex;
    }
    
    if (lastSubIndex < plainText.length) {
      subParts.push(
        isBold ? (
          <strong key={`${segmentKey}-plain-last`} className={`font-bold ${opts.reportTheme === 'academic-light' || opts.reportTheme === 'clinical-minimal' ? 'text-slate-950 font-black' : 'text-white'}`}>
            {plainText.substring(lastSubIndex)}
          </strong>
        ) : plainText.substring(lastSubIndex)
      );
    }
    return subParts;
  };

  while ((match = boldRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      parts.push(...processTextSegment(text.substring(lastIndex, matchIndex), false, `${keyPrefix}-p-${keyCounter}`));
    }
    parts.push(...processTextSegment(match[1], true, `${keyPrefix}-b-${keyCounter}`));
    lastIndex = boldRegex.lastIndex;
    keyCounter++;
  }
  
  if (lastIndex < text.length) {
    parts.push(...processTextSegment(text.substring(lastIndex), false, `${keyPrefix}-p-last`));
  }

  return parts.length > 0 ? parts : text;
};
