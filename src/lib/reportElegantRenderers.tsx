import React from "react";
import {
  convertHtmlToMarkdown,
  parseReportToElements,
  renderBoldTextSafe,
} from "./reportTextHelpers";

// Helper to visually render secondary clinical modules (case analysis, bibliography, etc.) with a high-contrast elegant style,
// gorgeous Inter (sans-serif) typography, nice bullet points, highlighted bold terms and precise spacing.
export function renderElegantResponse(rawText: string, accentColorClass: string = "text-indigo-400") {
  if (!rawText) return null;

  const text = convertHtmlToMarkdown(rawText);
  const elements = parseReportToElements(text, "elegant-resp");

  return (
    <div className="space-y-3.5 select-text text-slate-200 font-sans tracking-wide antialiased">
      {elements.map((elem, idx) => {
        if (elem.type === "divider") {
          return <hr key={elem.id} className="border-slate-800/80 my-4" />;
        }

        if (elem.type === "heading") {
          const hText = elem.text || "";
          if (elem.level === 1) {
            return (
              <h1 key={elem.id} className="text-white text-sm md:text-base font-black uppercase tracking-widest pb-1 border-b border-indigo-500/10 mt-3 mb-1.5 block">
                {renderBoldTextSafe(hText, `elegant-h-${idx}`)}
              </h1>
            );
          } else if (elem.level === 2) {
            return (
              <h2 key={elem.id} className="text-white/95 text-xs md:text-sm font-black uppercase tracking-wide mt-2.5 mb-1 block">
                {renderBoldTextSafe(hText, `elegant-h-${idx}`)}
              </h2>
            );
          } else {
            return (
              <h3 key={elem.id} className={`text-xs font-black ${accentColorClass} uppercase tracking-wider mt-2 mb-0.5 block`}>
                {renderBoldTextSafe(hText, `elegant-h-${idx}`)}
              </h3>
            );
          }
        }

        if (elem.type === "list") {
          return (
            <div key={elem.id} className="space-y-1.5 font-sans">
              {elem.items?.map((item, itemIdx) => {
                const trimmedItem = item.trim();
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

                const renderedText = renderBoldTextSafe(cleanItem, `elegant-list-${idx}-${itemIdx}`);

                return (
                  <div key={`${elem.id}-item-${itemIdx}`} className="flex items-start gap-2 pl-2 py-0.5 ml-1">
                    {bulletSpan}
                    <span className="text-slate-300 leading-relaxed text-[12.5px] md:text-[13px]">
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
            <div key={elem.id} className="overflow-x-auto my-3 border border-slate-800/80 rounded-xl bg-slate-950/60 shadow-lg max-w-full">
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
                        <th key={`th-${hIdx}`} className={`px-3 py-2.5 text-[10px] font-black uppercase tracking-wider ${accentColorClass}`}>
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
                        const renderedContent = renderBoldTextSafe(cellText, `cell-elegant-${idx}-${rIdx}-${cIdx}`);

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

              if (isHeader) {
                return (
                  <p key={`${elem.id}-l-${lIdx}`} className="text-white text-xs md:text-sm font-black uppercase tracking-wide mt-2.5 mb-1 block">
                    {renderBoldTextSafe(cleanHeaderTxt, `elegant-bold-header-${idx}-${lIdx}`)}
                  </p>
                );
              }

              return (
                <p key={`${elem.id}-l-${lIdx}`} className="text-slate-300 leading-relaxed text-[12.5px] md:text-[13px] select-text">
                  {renderBoldTextSafe(trimmedLine, `elegant-text-${idx}-${lIdx}`)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export function renderElegantPatientResumenDark(rawText: string) {
  if (!rawText) {
    return (
      <p className="text-slate-500 italic text-xs md:text-sm">
        Su resumen operacional clínico se está compilando. Por favor, descargue el PDF oficial para consultar la versión final firmada.
      </p>
    );
  }

  const elements = parseReportToElements(rawText, "patient-resumen-dark");

  return (
    <div className="space-y-4 text-slate-300 font-sans text-xs md:text-[13.5px] leading-relaxed">
      {elements.map((elem, idx) => {
        if (elem.type === "divider") {
          return <hr key={elem.id} className="border-slate-800 my-4" />;
        }

        if (elem.type === "heading") {
          const hText = elem.text || "";
          return (
            <h3 key={elem.id} className="text-white text-xs md:text-sm font-black uppercase tracking-wider mt-4 mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {renderBoldTextSafe(hText, `patient-res-h-dark-${idx}`, true)}
            </h3>
          );
        }

        if (elem.type === "list") {
          return (
            <ul key={elem.id} className="space-y-3.5 pl-1 my-3">
              {elem.items?.map((item, itemIdx) => {
                let cleanItem = item.trim();
                let isNumbered = /^\d+[\.\)]\s+/.test(cleanItem);
                let bulletSpan: React.ReactNode = (
                  <span className="text-emerald-400 font-black text-base select-none shrink-0 mt-[-2px] leading-none">
                    •
                  </span>
                );
                let bulletNumber = "";

                if (isNumbered) {
                  const match = cleanItem.match(/^(\d+[\.\)])\s+/);
                  if (match) {
                    bulletNumber = match[1];
                    bulletSpan = (
                      <span className="text-[13px] font-bold font-mono text-emerald-400 min-w-[18px] text-right mt-0.5 shrink-0">
                        {bulletNumber}
                      </span>
                    );
                    cleanItem = cleanItem.substring(match[0].length);
                  }
                } else {
                  // Clean up all typical leading bullets/spaces/hyphens to prevent stray markers at start of sentence
                  cleanItem = cleanItem.replace(/^[\s\-\*\•\▪\o\+\—\u2022\u25E6\u2023\u2043]+/g, "").trim();
                }

                // Capitalize the first letter properly (including cases where there's bold markdown at start like **hallazgo**)
                if (cleanItem.startsWith("**")) {
                  const match = cleanItem.match(/^\*\*(\s*[a-zñáéíóúü])/i);
                  if (match) {
                    const firstChar = match[1];
                    cleanItem = cleanItem.replace(/^\*\*(\s*[a-zñáéíóúü])/i, `**${firstChar.toUpperCase()}`);
                  }
                } else {
                  cleanItem = cleanItem.charAt(0).toUpperCase() + cleanItem.slice(1);
                }

                const renderedText = renderBoldTextSafe(cleanItem, `patient-res-list-dark-${idx}-${itemIdx}`, true);

                return (
                  <li key={`${elem.id}-item-${itemIdx}`} className="flex items-start gap-3 pl-1">
                    {bulletSpan}
                    <span className="text-slate-300 leading-relaxed text-[13px] md:text-[14px]">
                      {renderedText}
                    </span>
                  </li>
                );
              })}
            </ul>
          );
        }

        if (elem.type === "table") {
          const headers = elem.headers || [];
          const bodyRows = elem.bodyRows || [];

          if (headers.length === 0) return null;

          return (
            <div key={elem.id} className="overflow-x-auto my-4 border border-slate-800 rounded-xl bg-slate-900/60 shadow-sm max-w-full">
              <table className="min-w-full divide-y divide-slate-800 text-xs text-left">
                <thead className="bg-slate-950 font-mono">
                  <tr>
                    {headers.map((h, hIdx) => (
                      <th key={`th-dark-${hIdx}`} className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/30 font-sans">
                  {bodyRows.map((r, rIdx) => (
                    <tr key={`tr-dark-${rIdx}`} className="hover:bg-slate-850 transition-colors">
                      {r.map((c, cIdx) => (
                        <td key={`td-dark-${cIdx}`} className="px-3 py-2 text-slate-300 leading-relaxed max-w-xs break-words whitespace-normal font-sans">
                          {renderBoldTextSafe(c, `cell-patient-res-dark-${idx}-${rIdx}-${cIdx}`, true)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // Default: "text" type
        return (
          <div key={elem.id} className="space-y-2.5 my-2">
            {elem.lines?.map((line, lIdx) => {
              const trimmedLine = line.trim();
              if (!trimmedLine) return null;

              const isHeader = trimmedLine.startsWith("**") && trimmedLine.endsWith("**");
              const cleanHeaderTxt = trimmedLine.replace(/\*\*/g, "");

              if (isHeader) {
                return (
                  <p key={`${elem.id}-l-${lIdx}`} className="text-white text-xs md:text-sm font-black uppercase tracking-wide mt-3 mb-1 block">
                    {renderBoldTextSafe(cleanHeaderTxt, `patient-res-bold-header-dark-${idx}-${lIdx}`, true)}
                  </p>
                );
              }

              return (
                <p key={`${elem.id}-l-${lIdx}`} className="text-slate-300 leading-relaxed text-[13px] md:text-[14px] select-text">
                  {renderBoldTextSafe(trimmedLine, `patient-res-text-dark-${idx}-${lIdx}`, true)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export function renderElegantPatientResumen(rawText: string) {
  if (!rawText) {
    return (
      <p className="text-slate-400 italic text-xs md:text-sm">
        Su resumen operacional clínico se está compilando. Por favor, descargue el PDF oficial para consultar la versión final firmada.
      </p>
    );
  }

  const elements = parseReportToElements(rawText, "patient-resumen");

  return (
    <div className="space-y-4 text-slate-800 font-sans text-xs md:text-[13.5px] leading-relaxed">
      {elements.map((elem, idx) => {
        if (elem.type === "divider") {
          return <hr key={elem.id} className="border-slate-100 my-4" />;
        }

        if (elem.type === "heading") {
          const hText = elem.text || "";
          return (
            <h3 key={elem.id} className="text-slate-900 text-xs md:text-sm font-black uppercase tracking-wider mt-4 mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              {renderBoldTextSafe(hText, `patient-res-h-${idx}`, true)}
            </h3>
          );
        }

        if (elem.type === "list") {
          return (
            <ul key={elem.id} className="space-y-3.5 pl-1 my-3">
              {elem.items?.map((item, itemIdx) => {
                let cleanItem = item.trim();
                let isNumbered = /^\d+\.\s+/.test(cleanItem);
                // Beautiful, clean black bullet point matching the screenshot
                let bulletSpan: React.ReactNode = (
                  <span className="text-slate-900 font-black text-base select-none shrink-0 mt-[-2px] leading-none">
                    •
                  </span>
                );
                let bulletNumber = "";

                if (isNumbered) {
                  const match = cleanItem.match(/^(\d+\.)\s+/);
                  if (match) {
                    bulletNumber = match[1];
                    bulletSpan = (
                      <span className="text-[13px] font-bold font-mono text-slate-900 min-w-[18px] text-right mt-0.5 shrink-0">
                        {bulletNumber}
                      </span>
                    );
                    cleanItem = cleanItem.substring(match[0].length);
                  }
                } else if (cleanItem.startsWith("- ") || cleanItem.startsWith("* ")) {
                  cleanItem = cleanItem.substring(2);
                }

                const renderedText = renderBoldTextSafe(cleanItem, `patient-res-list-${idx}-${itemIdx}`, true);

                return (
                  <li key={`${elem.id}-item-${itemIdx}`} className="flex items-start gap-3 pl-1">
                    {bulletSpan}
                    <span className="text-slate-800 leading-relaxed text-[13px] md:text-[14px]">
                      {renderedText}
                    </span>
                  </li>
                );
              })}
            </ul>
          );
        }

        if (elem.type === "table") {
          const headers = elem.headers || [];
          const bodyRows = elem.bodyRows || [];

          if (headers.length === 0) return null;

          return (
            <div key={elem.id} className="overflow-x-auto my-4 border border-slate-200 rounded-xl bg-slate-50 shadow-sm max-w-full">
              <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
                <thead className="bg-slate-100 font-mono">
                  <tr>
                    {headers.map((h, hIdx) => (
                      <th key={`th-${hIdx}`} className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-700">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white font-sans">
                  {bodyRows.map((r, rIdx) => (
                    <tr key={`tr-${rIdx}`} className="hover:bg-slate-50 transition-colors">
                      {r.map((c, cIdx) => (
                        <td key={`td-${cIdx}`} className="px-3 py-2 text-slate-700 leading-relaxed max-w-xs break-words whitespace-normal font-sans">
                          {renderBoldTextSafe(c, `cell-patient-res-${idx}-${rIdx}-${cIdx}`, true)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // Default: "text" type
        return (
          <div key={elem.id} className="space-y-2.5 my-2">
            {elem.lines?.map((line, lIdx) => {
              const trimmedLine = line.trim();
              if (!trimmedLine) return null;

              const isHeader = trimmedLine.startsWith("**") && trimmedLine.endsWith("**");
              const cleanHeaderTxt = trimmedLine.replace(/\*\*/g, "");

              if (isHeader) {
                return (
                  <p key={`${elem.id}-l-${lIdx}`} className="text-slate-950 text-xs md:text-sm font-black uppercase tracking-wide mt-3 mb-1 block">
                    {renderBoldTextSafe(cleanHeaderTxt, `patient-res-bold-header-${idx}-${lIdx}`, true)}
                  </p>
                );
              }

              return (
                <p key={`${elem.id}-l-${lIdx}`} className="text-slate-800 leading-relaxed text-[13px] md:text-[14px] select-text">
                  {renderBoldTextSafe(trimmedLine, `patient-res-text-${idx}-${lIdx}`, true)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
