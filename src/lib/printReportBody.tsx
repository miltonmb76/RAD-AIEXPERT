import React from "react";
import CaseAnalysisRenderer from "../components/CaseAnalysisRenderer";
import {
  parseReportToElements,
  renderBoldTextBlackSafe,
  type ReportElement,
} from "./reportTextHelpers";

export function renderPrintReportBody(
  reportText: string,
  opts: {
    adaptivePDFContrast: boolean;
    isSyntacticHighlightingActive: boolean;
    getParagraphSeverity: (text: string) => "critical" | "altered" | "normal";
  },
) {
  if (!reportText) return null;

  const rawElements = parseReportToElements(reportText, "print-body");

  const renderSingleElement = (elem: ReportElement, idx: number) => {
    if (elem.type === "case_analysis" && elem.caseData) {
      return (
        <div key={elem.id} className="my-6" style={{ pageBreakInside: "avoid", breakInside: "avoid" }}>
          <CaseAnalysisRenderer data={elem.caseData} isDarkTheme={false} />
        </div>
      );
    }

    if (elem.type === "divider") {
      return <hr key={elem.id} className={`my-6 border-t ${opts.adaptivePDFContrast ? "border-black border-base" : "border-slate-300"}`} />;
    }

    if (elem.type === "code") {
      return (
        <div 
          key={elem.id} 
          className={`my-4 border ${opts.adaptivePDFContrast ? "border-black bg-gray-50/60" : "border-slate-300 bg-slate-50/70"} rounded-lg p-3 font-mono text-[10px] md:text-[10.5px]`}
          style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
        >
          <pre className={`whitespace-pre-wrap font-mono font-medium leading-relaxed ${opts.adaptivePDFContrast ? "text-black" : "text-slate-850"}`}>
            {elem.lines?.join("\n")}
          </pre>
        </div>
      );
    }

    if (elem.type === "heading") {
      const hText = elem.text || "";
      const isMainTitle = idx === 0 && hText && /REPORTE|INFORME|ESTUDIO|DIAGNÓSTICO|VALORACIÓN/i.test(hText);
      const isAnnexHeading = hText && (hText.toUpperCase().includes("ANEXO") || hText.toUpperCase().includes("DESGLOSE Y JUSTIFICACIÓN"));
      const pageBreakStyle = isAnnexHeading 
        ? { pageBreakBefore: "always" as const, breakBefore: "page" as const } 
        : { pageBreakAfter: "avoid" as const, breakAfter: "avoid" as const };
      
      if (isMainTitle) {
        return (
          <div key={elem.id} className="text-center my-4 font-bold text-lg select-all border-b pb-2 uppercase tracking-wide break-after-avoid page-break-after-avoid" style={{ pageBreakAfter: "avoid", breakAfter: "avoid" }}>
            {renderBoldTextBlackSafe(hText, `print-h-${idx}`)}
          </div>
        );
      }

      if (isAnnexHeading) {
        return (
          <div key={elem.id} style={pageBreakStyle} className="mt-3 mb-2.5 pb-1.5 border-b border-slate-300">
            <h2 className={`text-sm font-black uppercase tracking-wider ${opts.adaptivePDFContrast ? "text-black" : "text-slate-900"}`}>
              {renderBoldTextBlackSafe(hText, `print-h-${idx}`)}
            </h2>
          </div>
        );
      }

      if (elem.level === 1) {
        return (
          <h1 key={elem.id} style={pageBreakStyle} className={`text-base font-black uppercase tracking-wide mt-5 mb-2.5 block break-after-avoid page-break-after-avoid ${opts.adaptivePDFContrast ? "text-black" : "text-slate-900"}`}>
            {renderBoldTextBlackSafe(hText, `print-h-${idx}`)}
          </h1>
        );
      } else if (elem.level === 2) {
        return (
          <h2 key={elem.id} style={pageBreakStyle} className={`text-[13.5px] font-black uppercase tracking-wide mt-4 mb-2 block break-after-avoid page-break-after-avoid ${opts.adaptivePDFContrast ? "text-black" : "text-slate-800"}`}>
            {renderBoldTextBlackSafe(hText, `print-h-${idx}`)}
          </h2>
        );
      } else if (elem.level === 3) {
        return (
          <h3 key={elem.id} style={pageBreakStyle} className={`text-xs font-black uppercase tracking-wider mt-3.5 mb-1.5 block break-after-avoid page-break-after-avoid ${opts.adaptivePDFContrast ? "text-black" : "text-slate-700"}`}>
            {renderBoldTextBlackSafe(hText, `print-h-${idx}`)}
          </h3>
        );
      } else {
        return (
          <h4 key={elem.id} style={pageBreakStyle} className={`text-[11.5px] font-bold uppercase tracking-wider mt-3 mb-1 block break-after-avoid page-break-after-avoid ${opts.adaptivePDFContrast ? "text-black" : "text-slate-600"}`}>
            {renderBoldTextBlackSafe(hText, `print-h-${idx}`)}
          </h4>
        );
      }
    }

    if (elem.type === "list") {
      return (
        <div key={elem.id} className="space-y-1.5 pl-1.5">
          {elem.items?.map((item, itemIdx) => {
            let cleanItem = item.trim();
            let isNumbered = /^\d+\.\s+/.test(cleanItem);
            let bulletSpan: React.ReactNode = <span className="h-1.5 w-1.5 rounded-full bg-slate-900 mt-2 shrink-0" />;

            if (isNumbered) {
              const match = cleanItem.match(/^(\d+\.)\s+/);
              if (match) {
                bulletSpan = <span className="text-[11.5px] font-mono font-bold text-slate-800 min-w-[16px] text-right mt-0.5 shrink-0">{match[1]}</span>;
                cleanItem = cleanItem.substring(match[0].length);
              }
            } else if (cleanItem.startsWith("- ") || cleanItem.startsWith("* ")) {
              cleanItem = cleanItem.substring(2);
            }

            const renderedText = renderBoldTextBlackSafe(cleanItem, `print-list-${idx}-${itemIdx}`);

            let itemClass = "flex items-start gap-2.5 pl-2 py-0.5 ml-1 select-text";
            if (opts.isSyntacticHighlightingActive) {
              const severity = opts.getParagraphSeverity(cleanItem);
              if (severity === "critical") {
                itemClass = "flex items-start gap-2.5 ml-1 select-text border-l-[1.5px] border-red-500 bg-red-50/50 pl-3 py-1 my-1.5 rounded-r shadow-sm";
              } else if (severity === "altered") {
                itemClass = "flex items-start gap-2.5 ml-1 select-text border-l-[1.5px] border-amber-500 bg-amber-50/40 pl-3 py-1 my-1.5 rounded-r shadow-sm";
              }
            }

            return (
              <div key={`${elem.id}-item-${itemIdx}`} className={itemClass}>
                {bulletSpan}
                <span className="leading-relaxed select-text font-sans">
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

      const isClassificationHTMLTable = headers.some(hdrText => {
        const lower = (hdrText || "").toLowerCase();
        return lower.includes("criterio") || lower.includes("pondera") || lower.includes("score") || lower.includes("justifica") || lower.includes("sustento");
      });

      const isVascularHTMLTable = false;

      return (
        <div 
          key={elem.id} 
          className={`my-5 border-2 ${
            opts.adaptivePDFContrast ? "border-black" : "border-slate-300"
          } rounded-lg bg-white max-w-full overflow-hidden`}
          style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
        >
          <table className="w-full text-xs text-left border-collapse table-fixed">
            <thead className={`${opts.adaptivePDFContrast ? "bg-gray-150 font-black" : "bg-slate-100/90 font-sans"}`}>
              <tr className={`border-b-2 ${opts.adaptivePDFContrast ? "border-black" : "border-slate-300"}`}>
                {headers.map((h, hIdx) => {
                  let widthClass = "";
                  if (headers.length === 3) {
                    if (hIdx === 0) widthClass = "w-[34%]";
                    else if (hIdx === 1) widthClass = "w-[33%]";
                    else if (hIdx === 2) widthClass = "w-[33%]";
                  } else if (headers.length === 4) {
                    if (isClassificationHTMLTable) {
                      if (hIdx === 0) widthClass = "w-[24%]";
                      else if (hIdx === 1) widthClass = "w-[28%]";
                      else if (hIdx === 2) widthClass = "w-[16%] text-center";
                      else if (hIdx === 3) widthClass = "w-[32%]";
                    } else {
                      if (hIdx === 0) widthClass = "w-[10%] text-center";
                      else if (hIdx === 1) widthClass = "w-[25%]";
                      else if (hIdx === 2) widthClass = "w-[32%]";
                      else if (hIdx === 3) widthClass = "w-[33%]";
                    }
                  } else if (headers.length === 5) {
                    if (hIdx === 0) widthClass = "w-[10%] text-center";
                    else if (hIdx === 1) widthClass = "w-[22%]";
                    else if (hIdx === 2) widthClass = "w-[18%]";
                    else if (hIdx === 3) widthClass = "w-[25%]";
                    else if (hIdx === 4) widthClass = "w-[25%]";
                  }
                  
                  let hTextProcessed = h;
                  if (isVascularHTMLTable) {
                    if (hIdx === 0) hTextProcessed = "Segmento Alterado";
                    else if (hIdx === 1) hTextProcessed = "Derecho";
                    else if (hIdx === 2) hTextProcessed = "Izquierdo";
                  }
                  
                  return (
                    <th 
                      key={`th-${hIdx}`} 
                      className={`px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-black border-r ${
                        opts.adaptivePDFContrast ? "border-black/40 border-b-2" : "border-slate-200"
                      } last:border-r-0 ${widthClass}`}
                    >
                      {hTextProcessed}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className={`divide-y ${opts.adaptivePDFContrast ? "divide-black" : "divide-slate-200"} font-sans`}>
              {bodyRows.map((r, rIdx) => (
                <tr 
                  key={`tr-${rIdx}`} 
                  className={`${
                    rIdx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                  } ${opts.adaptivePDFContrast ? "font-bold text-black" : ""}`}
                  style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
                >
                  {r.map((c, cIdx) => {
                    const cellText = c;
                    const renderedContent = renderBoldTextBlackSafe(cellText, `cell-print-${idx}-${rIdx}-${cIdx}`);

                    let alignAndTypography = "text-left";
                    if (isClassificationHTMLTable) {
                      if (cIdx === 0) {
                        alignAndTypography = "text-left font-bold text-slate-900";
                      } else if (cIdx === 2) {
                        alignAndTypography = "text-center font-mono font-bold text-indigo-800 bg-indigo-50/60 rounded px-1.5 py-0.5";
                      }
                    } else if (headers.length === 4 && cIdx === 0) {
                      alignAndTypography = "text-center font-mono font-bold text-amber-700";
                    }

                    return (
                      <td 
                        key={`td-${cIdx}`} 
                        className={`px-3 py-2 text-black leading-relaxed break-words whitespace-normal border-r ${
                          opts.adaptivePDFContrast ? "border-black/30 text-black font-bold" : "border-slate-200"
                        } last:border-r-0 font-sans ${alignAndTypography}`}
                      >
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
      <div key={elem.id} className="space-y-2">
        {elem.lines?.map((line, lIdx) => {
          const trimmedLine = line.trim();
          if (!trimmedLine) return null;

          const isHeader = (trimmedLine.startsWith("**") && trimmedLine.endsWith("**"));
          const cleanHeaderTxt = trimmedLine.replace(/\*\"/g, "");
          
          const isMainTitle = idx === 0 && lIdx === 0 && /REPORTE|INFORME|ESTUDIO|DIAGNÓSTICO|VALORACIÓN/i.test(trimmedLine);

          if (isMainTitle) {
            return (
              <div key={`${elem.id}-l-${lIdx}`} className="text-center my-4 font-bold text-lg border-b pb-2 select-all uppercase tracking-wide break-after-avoid page-break-after-avoid" style={{ pageBreakAfter: "avoid", breakAfter: "avoid" }}>
                {renderBoldTextBlackSafe(cleanHeaderTxt, `print-title-${idx}`)}
              </div>
            );
          }

          if (isHeader) {
            return (
              <p key={`${elem.id}-l-${lIdx}`} className={`text-[12.5px] font-black uppercase mt-4 mb-2 break-after-avoid page-break-after-avoid ${opts.adaptivePDFContrast ? "text-black" : "text-slate-800"}`} style={{ pageBreakAfter: "avoid", breakAfter: "avoid" }}>
                {renderBoldTextBlackSafe(cleanHeaderTxt, `print-bold-header-${idx}-${lIdx}`)}
              </p>
            );
          }

          let printClass = "leading-relaxed select-text";
          if (opts.isSyntacticHighlightingActive) {
            const severity = opts.getParagraphSeverity(trimmedLine);
            if (severity === "critical") {
              printClass = "leading-relaxed select-text border-l-[1.5px] border-red-500 bg-red-50/50 pl-3 py-1 rounded-r my-1.5 shadow-sm";
            } else if (severity === "altered") {
              printClass = "leading-relaxed select-text border-l-[1.5px] border-amber-500 bg-amber-50/40 pl-3 py-1 rounded-r my-1.5 shadow-sm";
            }
          }

          return (
            <p key={`${elem.id}-l-${lIdx}`} className={printClass}>
              {renderBoldTextBlackSafe(trimmedLine, `print-text-${idx}-${lIdx}`)}
            </p>
          );
        })}
      </div>
    );
  };

  const renderedElements = rawElements.map((elem, idx) => renderSingleElement(elem, idx));

  return (
    <div className={`space-y-6 text-black select-text ${opts.adaptivePDFContrast ? "font-sans text-[13.5px]" : "font-serif text-[12.5px]"}`}>
      {renderedElements}

      {/* Printable schematic map attachments in an Annex block */}
      <div 
        className="mt-8 pt-6 border-t-2 border-slate-300 font-sans print:break-before-page" 
        style={{ pageBreakBefore: "always", breakBefore: "page" }}
      >
      </div>
    </div>
  );
};
