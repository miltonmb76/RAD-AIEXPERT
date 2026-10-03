import React from "react";
import { FileDown, ArrowDown } from "lucide-react";
import CaseAnalysisRenderer from "./CaseAnalysisRenderer";
import {
  parseReportToElements,
  renderBoldTextSafe,
} from "../lib/reportTextHelpers";

export interface ClinicalReportViewProps {
  reportText: string;
  selectedLogo: string;
  selectedParagraphOriginal: string | null;
  isSyntacticHighlightingActive: boolean;
  onTextSelection: () => void;
  onSelectParagraph: (text: string) => void;
  getParagraphSeverity: (text: string) => "critical" | "altered" | "normal";
}

export const ClinicalReportView: React.FC<ClinicalReportViewProps> = ({
  reportText,
  selectedLogo,
  selectedParagraphOriginal,
  isSyntacticHighlightingActive,
  onTextSelection,
  onSelectParagraph,
  getParagraphSeverity,
}) => {
  if (!reportText) return null;

  const elements = parseReportToElements(reportText, "clinical-report");

  let accentColorClass = "text-indigo-400";
  if (selectedLogo === "shield-check") accentColorClass = "text-emerald-400";
  else if (selectedLogo === "heart-pulse") accentColorClass = "text-rose-400";
  else if (selectedLogo === "dna") accentColorClass = "text-cyan-400";

  return (
    <div 
      onMouseUp={onTextSelection}
      className="space-y-4 select-text text-slate-100 font-sans tracking-wide"
    >
      <div className="text-[10px] bg-indigo-950/20 border border-indigo-900/35 rounded-xl p-3 text-indigo-300 font-medium leading-relaxed mb-4 flex items-center gap-2.5">
        <span className="flex h-2 w-2 relative shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
        </span>
        <span>
          <strong>Funciones IA de Párrafo:</strong> Selecciona cualquier texto con tu ratón o haz clic directo sobre un párrafo/lista para marcarlo y abrir el panel de acciones clínicas especiales (Analizar, Mejorar, Hacer exhaustivo, Explicar, Clasificar).
        </span>
      </div>

      {elements.map((elem, idx) => {
        if (elem.type === "case_analysis" && elem.caseData) {
          return (
            <div key={elem.id} className="my-6">
              <CaseAnalysisRenderer data={elem.caseData} isDarkTheme={true} />
            </div>
          );
        }

        if (elem.type === "page_break") {
          return (
            <div key={elem.id} className="my-6 border-y border-dashed border-teal-500/40 bg-teal-950/30 py-2.5 px-4 rounded-xl flex items-center justify-between text-teal-300 font-mono text-[11px] select-none">
              <span className="flex items-center gap-2 font-bold uppercase tracking-wider">
                <FileDown className="h-4 w-4 text-teal-400" />
                ─── Salto de Página PDF (Forzado Manual) ───
              </span>
              <span className="text-[9px] bg-teal-900/60 px-2 py-0.5 rounded border border-teal-500/30 font-bold text-teal-200">
                Inicia Nueva Página PDF
              </span>
            </div>
          );
        }

        if (elem.type === "space") {
          return (
            <div key={elem.id} className="my-3 border border-dotted border-indigo-500/30 bg-indigo-950/20 py-1.5 px-3 rounded-lg flex items-center justify-between text-indigo-300 font-mono text-[10px] select-none">
              <span className="flex items-center gap-1.5 font-semibold">
                <ArrowDown className="h-3.5 w-3.5 text-indigo-400" />
                Espacio en Blanco Vertical (Alineación PDF)
              </span>
              <span className="text-[9px] text-slate-400 font-mono">{elem.text}</span>
            </div>
          );
        }

        if (elem.type === "divider") {
          return <hr key={elem.id} className="border-slate-800/80 my-5" />;
        }

        if (elem.type === "code") {
          return (
            <div key={elem.id} className="my-4 border border-slate-800/85 rounded-xl bg-slate-950/90 shadow-lg overflow-x-auto p-4 select-all font-mono text-[11px] md:text-xs">
              <pre className="text-slate-300 leading-relaxed font-semibold whitespace-pre-wrap font-mono">
                {elem.lines?.join("\n")}
              </pre>
            </div>
          );
        }

        if (elem.type === "heading") {
          const hText = elem.text || "";
          const isMainTitle = idx === 0 && hText && /REPORTE|INFORME|ESTUDIO|DIAGNÓSTICO|VALORACIÓN/i.test(hText);

          if (isMainTitle) {
            return (
              <div key={elem.id} className="text-center text-white text-sm md:text-base font-black select-all border-b border-indigo-950/40 pb-2 mb-4 uppercase tracking-wider">
                {renderBoldTextSafe(hText, `screen-h-${idx}`)}
              </div>
            );
          }

          const isMarked = selectedParagraphOriginal === hText;

          if (elem.level === 1) {
            return (
              <h1 
                key={elem.id} 
                onClick={() => onSelectParagraph(hText)}
                className={`text-white text-xs md:text-sm font-black uppercase tracking-wide mt-3.5 mb-1.5 cursor-pointer rounded py-1 px-2 transition-all duration-150 ${
                  isMarked 
                    ? "bg-indigo-950/40 border-l-2 border-indigo-500 pl-3 pr-2 shadow-sm font-bold" 
                    : "hover:bg-slate-900/35"
                }`}
                title="Haz clic para marcar esta sección"
              >
                {renderBoldTextSafe(hText, `screen-h-${idx}`)}
              </h1>
            );
          } else if (elem.level === 2) {
            return (
              <h2 
                key={elem.id} 
                onClick={() => onSelectParagraph(hText)}
                className={`text-white/95 text-xs md:text-sm font-black uppercase tracking-wide mt-2.5 mb-1 cursor-pointer rounded py-1 px-2 transition-all duration-150 ${
                  isMarked 
                    ? "bg-indigo-950/40 border-l-2 border-indigo-500 pl-3 pr-2 shadow-sm font-bold" 
                    : "hover:bg-slate-900/35"
                }`}
                title="Haz clic para marcar esta sección"
              >
                {renderBoldTextSafe(hText, `screen-h-${idx}`)}
              </h2>
            );
          } else {
            return (
              <h3 
                key={elem.id} 
                onClick={() => onSelectParagraph(hText)}
                className={`text-xs font-black uppercase tracking-wider mt-2 mb-0.5 cursor-pointer rounded py-1 px-2 transition-all duration-150 ${
                  isMarked 
                    ? "bg-indigo-950/40 border-l-2 border-indigo-500 pl-3 pr-2 shadow-sm font-bold" 
                    : `${accentColorClass} hover:bg-slate-900/35`
                }`}
                title="Haz clic para marcar esta sección"
              >
                {renderBoldTextSafe(hText, `screen-h-${idx}`)}
              </h3>
            );
          }
        }

        if (elem.type === "list") {
          return (
            <div key={elem.id} className="space-y-1.5">
              {elem.items?.map((item, itemIdx) => {
                let cleanItem = item.trim();
                let isNumbered = /^\d+\.\s+/.test(cleanItem);
                let bulletSpan: React.ReactNode = <span className={`h-1.5 w-1.5 rounded-full ${accentColorClass} mt-1.5 shrink-0`} />;
                let bulletNumber = "";

                if (isNumbered) {
                  const match = cleanItem.match(/^(\d+\.)\s+/);
                  if (match) {
                    bulletNumber = match[1];
                    bulletSpan = <span className={`text-[11px] font-bold font-mono ${accentColorClass} min-w-[16px] text-right mt-0.5 shrink-0`}>{bulletNumber}</span>;
                    cleanItem = cleanItem.substring(match[0].length);
                  }
                } else if (cleanItem.startsWith("- ") || cleanItem.startsWith("* ")) {
                  cleanItem = cleanItem.substring(2);
                }

                const renderedText = renderBoldTextSafe(cleanItem, `screen-list-${idx}-${itemIdx}`);
                const isMarked = selectedParagraphOriginal === cleanItem;

                let bgBorderClass = "hover:bg-slate-900/35 hover:text-slate-100 pr-1";
                
                if (isSyntacticHighlightingActive && !isMarked) {
                  const severity = getParagraphSeverity(cleanItem);
                  if (severity === "critical") {
                    bgBorderClass = "bg-rose-950/20 border-l-[1.5px] border-rose-500/60 pl-3 text-rose-200 hover:bg-rose-950/30 hover:text-rose-100 font-medium my-1 shadow-sm";
                  } else if (severity === "altered") {
                    bgBorderClass = "bg-amber-950/15 border-l-[1.5px] border-amber-500/50 pl-3 text-amber-200 hover:bg-amber-950/25 hover:text-amber-100 font-medium my-1 shadow-sm";
                  }
                }

                return (
                  <div 
                    key={`${elem.id}-item-${itemIdx}`} 
                    onClick={() => onSelectParagraph(cleanItem)}
                    className={`flex items-start gap-2 pl-2 py-1 ml-1 cursor-pointer transition-all duration-150 rounded ${
                      isMarked 
                        ? "bg-indigo-950/30 border-l-[1.5px] border-indigo-500 text-white pl-3 pr-2 font-medium" 
                        : bgBorderClass
                    }`}
                    title="Haz clic para marcar este elemento de la lista"
                  >
                    {bulletSpan}
                    <span className={`leading-relaxed text-[12.5px] md:text-[13px] ${isMarked ? "text-indigo-250 font-medium" : "text-slate-300"}`}>
                      {renderedText}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        }

        if (elem.type === "table") {
          const headers = elem.headers || [];
          const bodyRows = elem.bodyRows || [];

          if (headers.length === 0) return null;

          const isVascularHTMLTable = false;

          return (
            <div key={elem.id} className="overflow-x-auto my-4 border border-slate-800/80 rounded-xl bg-slate-950/60 shadow-lg max-w-full">
              <table className="min-w-full divide-y divide-slate-850 text-xs text-left">
                <thead className="bg-slate-900/60 font-mono">
                  <tr>
                    {headers.map((h, hIdx) => {
                      let hTextProcessed = h;
                      if (isVascularHTMLTable) {
                        if (hIdx === 0) hTextProcessed = "Segmento Alterado";
                        else if (hIdx === 1) hTextProcessed = "Derecho";
                        else if (hIdx === 2) hTextProcessed = "Izquierdo";
                      }
                      return (
                        <th key={`th-${hIdx}`} className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-indigo-400">
                          {hTextProcessed}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 bg-slate-950/20 font-sans">
                  {bodyRows.map((r, rIdx) => (
                    <tr key={`tr-${rIdx}`} className="hover:bg-slate-900/10 transition-colors">
                      {r.map((c, cIdx) => {
                        const cellText = c;
                        const renderedContent = renderBoldTextSafe(cellText, `cell-clinical-${idx}-${rIdx}-${cIdx}`);

                        return (
                          <td key={`td-${cIdx}`} className="px-3 py-2 text-slate-300 leading-relaxed max-w-xs break-words whitespace-normal font-sans">
                            {renderedContent}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // Default: "text" type
        return (
          <div key={elem.id} className="space-y-1.5">
            {elem.lines?.map((line, lIdx) => {
              const trimmedLine = line.trim();
              if (!trimmedLine) return null;

              const isHeader = (trimmedLine.startsWith("**") && trimmedLine.endsWith("**"));
              const cleanHeaderTxt = trimmedLine.replace(/\*\*/g, "");

              const isMainTitle = idx === 0 && lIdx === 0 && /REPORTE|INFORME|ESTUDIO|DIAGNÓSTICO|VALORACIÓN/i.test(trimmedLine);

              if (isMainTitle) {
                return (
                  <div key={`${elem.id}-l-${lIdx}`} className="text-center text-white text-sm md:text-base font-black border-b border-indigo-950/40 pb-2 mb-4 uppercase tracking-wider">
                    {renderBoldTextSafe(cleanHeaderTxt, `screen-title-${idx}`)}
                  </div>
                );
              }

              if (isHeader) {
                return (
                  <p key={`${elem.id}-l-${lIdx}`} className="text-white text-xs md:text-sm font-black uppercase tracking-wide mt-2.5 mb-1 block">
                    {renderBoldTextSafe(cleanHeaderTxt, `screen-bold-header-${idx}-${lIdx}`)}
                  </p>
                );
              }

              const isMarked = selectedParagraphOriginal === trimmedLine;
              let bgBorderClass = "text-slate-300 hover:bg-slate-900/35 hover:text-slate-100";
              
              if (isSyntacticHighlightingActive && !isMarked) {
                const severity = getParagraphSeverity(trimmedLine);
                if (severity === "critical") {
                  bgBorderClass = "bg-rose-950/20 border-l-[1.5px] border-rose-500/60 pl-2.5 text-rose-200 hover:bg-rose-950/30 hover:text-rose-100 font-medium my-1.5 shadow-sm";
                } else if (severity === "altered") {
                  bgBorderClass = "bg-amber-950/15 border-l-[1.5px] border-amber-500/50 pl-2.5 text-amber-200 hover:bg-amber-950/25 hover:text-amber-100 font-medium my-1.5 shadow-sm";
                }
              }

              return (
                <p 
                  key={`${elem.id}-l-${lIdx}`} 
                  onClick={() => onSelectParagraph(trimmedLine)}
                  className={`leading-relaxed text-[12.5px] md:text-[13px] select-text cursor-pointer transition-all duration-150 rounded my-1 py-1 px-1.5 ${
                    isMarked 
                      ? "bg-indigo-950/30 border-l-[1.5px] border-indigo-500 text-white pl-2.5 font-medium shadow-sm" 
                      : bgBorderClass
                  }`}
                  title="Haz clic para marcar este párrafo"
                >
                  {renderBoldTextSafe(trimmedLine, `screen-text-${idx}-${lIdx}`)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
