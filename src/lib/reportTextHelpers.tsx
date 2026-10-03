import React from "react";
import type { CaseAnalysisData } from "../types";

/** Report parse/render text helpers extracted from App.tsx */
export const cleanRawClinicalText = (text: string) => {
  if (!text) return "";

  let clean = text
    .replace(/\[INICIO DE.*?\]/gi, "")
    .replace(/\[FIN DE.*?\]/gi, "")
    .replace(/\[INICIO DEL REPORTE\]\s*/gi, "")
    .replace(/\[FIN DEL REPORTE\]\s*/gi, "")
    .replace(/\$(.*?)\$/g, (match, p1) => {
      let mathContent = p1;
      mathContent = mathContent
        .replace(/\\ge/g, ">=")
        .replace(/\\le/g, "<=")
        .replace(/\\text\{(.*?)\}/g, "$1")
        .replace(/\\circ/g, "°");
      return mathContent;
    });

  // Decode HTML entities beautifully
  clean = clean
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&deg;/g, "°")
    .replace(/&plusmn;/g, "±")
    .replace(/&times;/g, "×")
    .replace(/&divide;/g, "÷")
    .replace(/&nbsp;/g, " ")
    .replace(/&aacute;/g, "á")
    .replace(/&eacute;/g, "é")
    .replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó")
    .replace(/&uacute;/g, "ú")
    .replace(/&Aacute;/g, "Á")
    .replace(/&Eacute;/g, "É")
    .replace(/&Iacute;/g, "Í")
    .replace(/&Oacute;/g, "Ó")
    .replace(/&Uacute;/g, "Ú")
    .replace(/&html;/g, "")
    .replace(/&ntilde;/g, "ñ")
    .replace(/&Ntilde;/g, "Ñ");

  // Clean LaTeX syntax elements from text representation to look clean and professional
  clean = clean
    .replace(/\\le(q)?\b/gi, "<=")
    .replace(/\\ge(q)?\b/gi, ">=")
    .replace(/\\pm\b/gi, "+/-")
    .replace(/\\approx\b/gi, "~")
    .replace(/\\times\b/gi, "x")
    .replace(/\\cdot\b/gi, "·")
    .replace(/\\circ\b/gi, "°")
    .replace(/\\degree\b/gi, "°")
    .replace(/\\alpha\b/gi, "alfa")
    .replace(/\\beta\b/gi, "beta")
    .replace(/\\gamma\b/gi, "gamma")
    .replace(/\\theta\b/gi, "theta")
    .replace(/\\mu\b/gi, "u")
    .replace(/\\text\s*\{(.*?)\}/gi, "$1")
    .replace(/\\mathrm\s*\{(.*?)\}/gi, "$1")
    .replace(/\\mathbf\s*\{(.*?)\}/gi, "$1")
    .replace(/\\\[/g, "")
    .replace(/\\\]/g, "")
    .replace(/\\\(/g, "")
    .replace(/\\\)/g, "");

  // Also transform raw unicode characters directly to prevent compatibility "square box (□)" gaps in standard document fonts (jsPDF/MS Word)
  clean = clean
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/±/g, "+/-")
    .replace(/≈/g, "~")
    .replace(/α/g, "alfa")
    .replace(/β/g, "beta")
    .replace(/γ/g, "gamma")
    .replace(/θ/g, "theta")
    .replace(/μ/g, "u");

  return clean.trim();
};

export const mergeCaseAnalysisBlock = (existingText: string, format: string, jsonBlock: string, textSummary: string): string => {
  const markerStart = `[START_CASE_ANALYSIS:${format}]`;
  const markerEnd = `[END_CASE_ANALYSIS:${format}]`;
  const newBlock = `${markerStart}\n${jsonBlock}${textSummary}\n${markerEnd}`;

  let cleanText = existingText || "";

  // If there's an existing block with the exact same format, replace it
  const startIdx = cleanText.indexOf(markerStart);
  const endIdx = cleanText.indexOf(markerEnd);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = cleanText.substring(0, startIdx).trim();
    const after = cleanText.substring(endIdx + markerEnd.length).trim();
    return (before + "\n\n" + newBlock + "\n\n" + after).trim();
  }

  // Otherwise, if there is a legacy [CASE_ANALYSIS_JSON] block that does NOT have the START marker
  // and has the same format, replace it.
  if (!cleanText.includes("[START_CASE_ANALYSIS:")) {
    const legacyIdx = cleanText.indexOf("[CASE_ANALYSIS_JSON]");
    if (legacyIdx !== -1) {
      const legacyMatch = cleanText.match(/\[CASE_ANALYSIS_JSON\]\s*([\s\S]*?)\s*\[\/CASE_ANALYSIS_JSON\]/);
      if (legacyMatch && legacyMatch[1]) {
        try {
          const parsed = JSON.parse(legacyMatch[1]);
          if (parsed.format === format) {
            const cutText = cleanText.substring(0, legacyIdx).trim();
            return (cutText + "\n\n" + newBlock).trim();
          }
        } catch (e) {
          console.error("Error parsing legacy JSON:", e);
        }
      }
    }
  }

  // If we didn't find the same format, just append it
  return (cleanText.trim() + "\n\n" + newBlock).trim();
};

export interface ReportElement {
  type: "text" | "heading" | "list" | "table" | "divider" | "code" | "case_analysis" | "page_break" | "space";
  id: string;
  level?: number;
  text?: string;
  lines?: string[];
  items?: string[];
  headers?: string[];
  bodyRows?: string[][];
  caseData?: CaseAnalysisData;
}

export const parseReportToElements = (reportText: string, uniquePrefix: string): ReportElement[] => {
  let textToParse = reportText || "";
  const extractedCaseDatas: CaseAnalysisData[] = [];

  // Find all blocks with [CASE_ANALYSIS_JSON]
  const caseRegex = /\[CASE_ANALYSIS_JSON\]\s*([\s\S]*?)\s*\[\/CASE_ANALYSIS_JSON\]/g;
  let match;
  while ((match = caseRegex.exec(textToParse)) !== null) {
    if (match[1]) {
      try {
        const parsed = JSON.parse(match[1]);
        extractedCaseDatas.push(parsed);
      } catch (e) {
        console.error("Error parsing case data in parseReportToElements loop:", e);
      }
    }
  }

  // Now, strip the blocks and text summaries completely from the main clinical text
  textToParse = textToParse.replace(/\[START_CASE_ANALYSIS:[\s\S]*?\[END_CASE_ANALYSIS:[^\]]+\]/gi, "");
  
  // Legacy stripping
  textToParse = textToParse.replace(/\[CASE_ANALYSIS_JSON\]\s*[\s\S]*?\[\/CASE_ANALYSIS_JSON\]/g, "");
  const summaryIdx = textToParse.indexOf("**ANÁLISIS INTEGRADO DE CASO");
  if (summaryIdx !== -1) {
    textToParse = textToParse.substring(0, summaryIdx).trim();
  }
  textToParse = textToParse.trim();

  const clean = cleanRawClinicalText(textToParse);
  const lines = clean.split("\n");
  const elements: ReportElement[] = [];

  // We push all extracted case analyses to the elements
  extractedCaseDatas.forEach((caseData, idx) => {
    elements.push({
      type: "case_analysis",
      id: `${uniquePrefix}-case-analysis-${idx}`,
      caseData: caseData
    });
  });

  let currentTableLines: string[] = [];
  let currentListItems: string[] = [];
  let currentParagraphLines: string[] = [];
  let currentCodeLines: string[] = [];
  let inCodeBlock = false;

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      elements.push({
        type: "text",
        id: `${uniquePrefix}-para-${elements.length}`,
        lines: [...currentParagraphLines]
      });
      currentParagraphLines = [];
    }
  };

  const flushList = () => {
    if (currentListItems.length > 0) {
      elements.push({
        type: "list",
        id: `${uniquePrefix}-list-${elements.length}`,
        items: [...currentListItems]
      });
      currentListItems = [];
    }
  };

  const flushTable = () => {
    if (currentTableLines.length > 0) {
      const cleanTableRows = currentTableLines
        .map(line => line.trim())
        .filter(line => {
          const hasPipe = line.includes("|");
          const isDivider = line.includes("---") || /^[|:\-\s]+$/.test(line);
          return hasPipe && !isDivider && line.replace(/\|/g, "").trim().length > 0;
        });

      if (cleanTableRows.length > 0) {
        const parseRowCells = (rowText: string) => {
          const rawParts = rowText.split("|");
          let cells = rawParts.map(c => c.trim());
          if (rowText.startsWith("|")) cells.shift();
          if (rowText.endsWith("|")) cells.pop();
          return cells;
        };

        const headers = parseRowCells(cleanTableRows[0]);
        const bodyRows = cleanTableRows.slice(1).map(row => parseRowCells(row));

        elements.push({
          type: "table",
          id: `${uniquePrefix}-table-${elements.length}`,
          headers,
          bodyRows
        });
      } else {
        currentParagraphLines.push(...currentTableLines);
      }
      currentTableLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Standard markdown code block handling (triple backticks)
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        elements.push({
          type: "code",
          id: `${uniquePrefix}-code-${elements.length}`,
          lines: [...currentCodeLines]
        });
        currentCodeLines = [];
        inCodeBlock = false;
      } else {
        flushParagraph();
        flushList();
        flushTable();
        inCodeBlock = true;
        currentCodeLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      currentCodeLines.push(rawLine);
      continue;
    }

    // Safe raw-block fallback: detect raw EMR equal-sign borders if not wrapped in triple backticks
    if (trimmed.startsWith("==========") && trimmed.length > 15) {
      if (currentCodeLines.length > 0) {
        currentCodeLines.push(rawLine);
        elements.push({
          type: "code",
          id: `${uniquePrefix}-code-${elements.length}`,
          lines: [...currentCodeLines]
        });
        currentCodeLines = [];
      } else {
        flushParagraph();
        flushList();
        flushTable();
        currentCodeLines = [rawLine];
      }
      continue;
    }

    if (currentCodeLines.length > 0) {
      currentCodeLines.push(rawLine);
      // Look ahead to check if we can skip the concluding divider if there's any
      const nextLineTrimmed = (i < lines.length - 1) ? lines[i+1].trim() : "";
      if (nextLineTrimmed.startsWith("----------") && nextLineTrimmed.length > 15) {
        currentCodeLines.push(lines[i+1]);
        i++; // skip next line
        elements.push({
          type: "code",
          id: `${uniquePrefix}-code-${elements.length}`,
          lines: [...currentCodeLines]
        });
        currentCodeLines = [];
      } else if (i === lines.length - 1) {
        // Flush code block at end of document if unclosed
        elements.push({
          type: "code",
          id: `${uniquePrefix}-code-${elements.length}`,
          lines: [...currentCodeLines]
        });
        currentCodeLines = [];
      }
      continue;
    }

    if (/^(?:\[(?:salto(?:_de_p[aá]gina)?|page_break|salto_pagina)\]|<pagebreak>)$/i.test(trimmed)) {
      flushParagraph();
      flushList();
      flushTable();
      elements.push({ type: "page_break", id: `${uniquePrefix}-pagebreak-${elements.length}` });
      continue;
    }

    if (/^\[ESPACIO(?:_\d+MM)?\]$/i.test(trimmed)) {
      flushParagraph();
      flushList();
      flushTable();
      elements.push({ type: "space", id: `${uniquePrefix}-space-${elements.length}`, text: trimmed });
      continue;
    }

    if (trimmed === "---") {
      flushParagraph();
      flushList();
      flushTable();
      elements.push({ type: "divider", id: `${uniquePrefix}-div-${elements.length}` });
      continue;
    }

    const hasPipe = trimmed.includes("|");
    const isTableDivider = trimmed.includes("---") && hasPipe;
    const isPotentialTableLine = hasPipe && (isTableDivider || trimmed.split("|").length >= 3 || (i > 0 && lines[i-1].includes("|")) || (i < lines.length - 1 && lines[i+1].includes("|")));

    if (isPotentialTableLine) {
      flushParagraph();
      flushList();
      currentTableLines.push(rawLine);
      continue;
    }

    flushTable();

    let isHeading = false;
    let headingLevel = 0;
    let lineContent = trimmed;

    if (lineContent.startsWith("# ")) {
      isHeading = true;
      headingLevel = 1;
      lineContent = lineContent.replace(/^#\s+/, "");
    } else if (lineContent.startsWith("## ")) {
      isHeading = true;
      headingLevel = 2;
      lineContent = lineContent.replace(/^##\s+/, "");
    } else if (lineContent.startsWith("### ")) {
      isHeading = true;
      headingLevel = 3;
      lineContent = lineContent.replace(/^###\s+/, "");
    } else if (lineContent.startsWith("#### ")) {
      isHeading = true;
      headingLevel = 4;
      lineContent = lineContent.replace(/^####\s+/, "");
    }

    if (isHeading) {
      flushParagraph();
      flushList();
      elements.push({
        type: "heading",
        id: `${uniquePrefix}-head-${elements.length}`,
        level: headingLevel,
        text: lineContent
      });
      continue;
    }

    const isBulleted = trimmed.startsWith("- ") || trimmed.startsWith("* ") || /^\d+\.\s+/.test(trimmed);
    if (isBulleted) {
      flushParagraph();
      currentListItems.push(trimmed);
      continue;
    }

    flushList();

    if (trimmed === "") {
      flushParagraph();
    } else {
      currentParagraphLines.push(rawLine);
    }
  }

  flushParagraph();
  flushList();
  flushTable();

  if (currentCodeLines.length > 0 || inCodeBlock) {
    elements.push({
      type: "code",
      id: `${uniquePrefix}-code-${elements.length}`,
      lines: [...currentCodeLines]
    });
  }

  return elements;
};

export const renderBoldTextBlackSafe = (text: string, keyPrefix: string) => {
  if (!text) return "";
  const parts: React.ReactNode[] = [];
  const boldRegex = /\*\*(.*?)\*\*/g;
  let match;
  let lastIndex = 0;
  let keyCounter = 0;

  while ((match = boldRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }
    parts.push(
      <strong key={`${keyPrefix}-${keyCounter++}`} className="font-extrabold text-black">
        {match[1]}
      </strong>
    );
    lastIndex = boldRegex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length > 0 ? parts : text;
};

export const renderBoldTextSafe = (text: string, keyPrefix: string, isLightBg: boolean = false) => {
  if (!text) return "";
  const parts: React.ReactNode[] = [];
  const boldRegex = /\*\*(.*?)\*\"/g; // Wait, actually standard bold regex is /\*\*(.*?)\*\*/g
  const realBoldRegex = /\*\*(.*?)\*\*/g;
  let match;
  let lastIndex = 0;
  let keyCounter = 0;

  while ((match = realBoldRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }
    parts.push(
      <strong key={`${keyPrefix}-${keyCounter++}`} className={`font-bold ${isLightBg ? "text-slate-950 font-black" : "text-white"}`}>
        {match[1]}
      </strong>
    );
    lastIndex = realBoldRegex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length > 0 ? parts : text;
};

export const convertHtmlToMarkdown = (html: string): string => {
  if (!html) return "";
  let md = html;
  
  // Replace bold tags
  md = md.replace(/<(?:b|strong)>/gi, "**");
  md = md.replace(/<\/(?:b|strong)>/gi, "**");
  
  // Replace italic tags
  md = md.replace(/<(?:i|em)>/gi, "*");
  md = md.replace(/<\/(?:i|em)>/gi, "*");

  // Replace br tags with newline
  md = md.replace(/<br\s*\/?>/gi, "\n");

  // Replace li tags with bullet points
  md = md.replace(/<li>/gi, "\n- ");
  md = md.replace(/<\/li>/gi, "");

  // Remove ul/ol tags
  md = md.replace(/<(?:ul|ol)>/gi, "");
  md = md.replace(/<\/(?:ul|ol)>/gi, "");

  // Replace p tags
  md = md.replace(/<p>/gi, "\n");
  md = md.replace(/<\/p>/gi, "\n");

  return md;
};

