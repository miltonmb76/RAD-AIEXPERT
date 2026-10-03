/** Pure helpers extracted from handleDownloadNativePDF */

export function drawAnatomicalCards(
  docObj: any,
  findings: Array<{ label: string; state: string; description: string }>,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
) {
  // Aligned Anatomical Cards format for Appendix / Synopses in PDF (Opción 1: Fichas Anatómicas Alineadas)
  const isLargeSingleMode = boxH > 100;
  const paddingX = 2.5;
  const paddingY = isLargeSingleMode ? 10.5 : 8.5; // Starts after header text space
  const startX = boxX + paddingX;
  const startY = boxY + paddingY;
  const availW = boxW - (paddingX * 2);
  const availH = boxH - paddingY - (isLargeSingleMode ? 3.5 : 2.5);

  const count = findings.length;
  const cols = count > 3 ? 2 : 1;
  const colGap = 2.0;
  const rowGap = isLargeSingleMode ? 3.0 : 2.0;
  const colW = cols === 2 ? (availW - colGap) / 2 : availW;

  const totalRows = Math.max(1, Math.ceil(count / cols));
  const cardH = (availH - (rowGap * (totalRows - 1))) / totalRows;

  findings.forEach((finding, index) => {
    const colIndex = index % cols;
    const rowIndex = Math.floor(index / cols);
    const cardX = startX + colIndex * (colW + colGap);
    const cardY = startY + rowIndex * (cardH + rowGap);

    const stateClean = (finding.state || "").toLowerCase().trim();
              let dotColor = [99, 102, 241];      // indigo-500
    let badgeBg = [238, 242, 255];      // indigo-50
    let badgeText = [67, 56, 202];       // indigo-700
    let drawBorder = [226, 232, 240];    // light border

    if (stateClean === "normal" || stateClean === "sin_lesiones" || stateClean === "normales" || stateClean === "dentro de límites normales") {
      dotColor = [16, 185, 129];        // emerald-500
      badgeBg = [240, 253, 244];         // emerald-50
      badgeText = [21, 128, 61];          // emerald-700
      drawBorder = [209, 250, 229];
    } else if (
      stateClean.includes("ruptura") || 
      stateClean.includes("desgarro_completo") ||
      stateClean.includes("orquitis") ||
      stateClean.includes("torsion") ||
      stateClean.includes("colecistitis") || 
      stateClean.includes("severa") || 
      stateClean.includes("severo") || 
      stateClean.includes("masa") || 
      stateClean.includes("solido") || 
      stateClean.includes("sólido") || 
      stateClean.includes("maligno") || 
      stateClean.includes("birads_4") || 
      stateClean.includes("birads_5") || 
      stateClean.includes("birads_6") || 
      stateClean.includes("suspicious") || 
      stateClean.includes("aneurisma") ||
      stateClean.includes("trombosis") ||
      stateClean.includes("critico") ||
      stateClean.includes("crítico")
    ) {
      dotColor = [239, 68, 68];          // rose-500
      badgeBg = [254, 242, 242];         // rose-50
      badgeText = [185, 28, 28];          // rose-700
      drawBorder = [254, 205, 211];       // rose-200
    } else if (
      stateClean.includes("leve") || 
      stateClean.includes("quiste_simple") || 
      stateClean.includes("benigno") || 
      stateClean.includes("sinovitis_l") || 
      stateClean.includes("derrame_l") ||
      stateClean.includes("espesor_conservado") ||
      stateClean.includes("hidrocele_l") ||
      stateClean.includes("ectasia_l") ||
      stateClean.includes("bursitis_l") ||
      stateClean.includes("birads_2") ||
      stateClean.includes("birads_3")
    ) {
      dotColor = [245, 158, 11];         // amber-500
      badgeBg = [254, 252, 232];         // amber-50
      badgeText = [180, 83, 9];           // amber-800
      drawBorder = [254, 243, 199];       // amber-200
    } else {
      if (stateClean === "normal" || stateClean === "sin_lesiones" || stateClean === "normales" || stateClean === "dentro de límites normales") {
        dotColor = [16, 185, 129];        // emerald-500
        badgeBg = [240, 253, 244];         // emerald-50
        badgeText = [21, 128, 61];          // emerald-700
        drawBorder = [209, 250, 229];
      } else if (
        stateClean.includes("ruptura") || 
        stateClean.includes("desgarro_completo") ||
        stateClean.includes("orquitis") ||
        stateClean.includes("torsion") ||
        stateClean.includes("colecistitis") || 
        stateClean.includes("severa") || 
        stateClean.includes("severo") || 
        stateClean.includes("masa") || 
        stateClean.includes("solido") || 
        stateClean.includes("sólido") || 
        stateClean.includes("maligno") || 
        stateClean.includes("birads_4") || 
        stateClean.includes("birads_5") || 
        stateClean.includes("birads_6") || 
        stateClean.includes("suspicious") || 
        stateClean.includes("aneurisma") ||
        stateClean.includes("trombosis") ||
        stateClean.includes("critico") ||
        stateClean.includes("crítico")
      ) {
        dotColor = [239, 68, 68];          // rose-500
        badgeBg = [254, 242, 242];         // rose-50
        badgeText = [185, 28, 28];          // rose-700
        drawBorder = [254, 205, 211];       // rose-200
      } else if (
        stateClean.includes("leve") || 
        stateClean.includes("quiste_simple") || 
        stateClean.includes("benigno") || 
        stateClean.includes("sinovitis_l") || 
        stateClean.includes("derrame_l") ||
        stateClean.includes("espesor_conservado") ||
        stateClean.includes("hidrocele_l") ||
        stateClean.includes("ectasia_l") ||
        stateClean.includes("bursitis_l") ||
        stateClean.includes("birads_2") ||
        stateClean.includes("birads_3")
      ) {
        dotColor = [245, 158, 11];         // amber-500
        badgeBg = [254, 252, 232];         // amber-50
        badgeText = [180, 83, 9];           // amber-800
        drawBorder = [254, 243, 199];       // amber-200
      }
    }

    // Draw card background
    docObj.setFillColor(255, 255, 255);
    docObj.setDrawColor(drawBorder[0], drawBorder[1], drawBorder[2]);
    docObj.setLineWidth(0.18);
    docObj.roundedRect(cardX, cardY, colW, cardH, 1.2, 1.2, "FD");

    // Draw colored stripe indicator on left edge
    docObj.setFillColor(dotColor[0], dotColor[1], dotColor[2]);
    docObj.rect(cardX, cardY, 1.2, cardH, "F");

    // Draw badge for state FIRST
              let rawState = (finding.state || "ALTERADO").replace(/_/g, " ").toUpperCase();
    if (rawState === "NORMAL") rawState = "NORMAL";
    else if (rawState === "DESGARRO MIOFASCIAL") rawState = "D. MIOFASC";
    else if (rawState === "DESGARRO INTRAMUSCULAR") rawState = "D. INTRAC";
    else if (rawState === "VALORACION DINAMICA") rawState = "VAL. DIN.";
    else if (rawState === "ADENOPATIA REACTIVA") rawState = "INFLAMATORIO";

    const badgeFontSize = cardH > 20 ? 5.2 : 4.0;
    const badgeH = cardH > 20 ? 3.4 : 2.3;
    docObj.setFont("helvetica", "bold");
    docObj.setFontSize(badgeFontSize);
    const stateTextWidth = docObj.getTextWidth(rawState);
    const badgeW = Math.min(colW * 0.45, stateTextWidth + 2.5);
    const badgeX = cardX + colW - badgeW - 1.2;

    docObj.setFillColor(badgeBg[0], badgeBg[1], badgeBg[2]);
    docObj.roundedRect(badgeX, cardY + 1.0, badgeW, badgeH, 0.5, 0.5, "F");
    docObj.setTextColor(badgeText[0], badgeText[1], badgeText[2]);
    docObj.text(rawState, badgeX + badgeW / 2, cardY + 1.0 + (badgeH * 0.72), { align: "center" });

    // Draw structure label (Title) with auto-scaling font size to avoid truncation
    let labelFontSize = cardH < 10 ? 5.0 : (cardH > 20 ? 7.2 : 5.6);
    docObj.setFont("helvetica", "bold");
    docObj.setFontSize(labelFontSize);
    docObj.setTextColor(15, 23, 42); // slate-900

    const maxTitleWidth = badgeX - (cardX + 2.4) - 1.0;
    let titleText = finding.label.toUpperCase();

    while (labelFontSize > 3.6 && docObj.getTextWidth(titleText) > maxTitleWidth) {
      labelFontSize -= 0.3;
      docObj.setFontSize(labelFontSize);
    }
    if (docObj.getTextWidth(titleText) > maxTitleWidth) {
      while (titleText.length > 3 && docObj.getTextWidth(titleText + "..") > maxTitleWidth) {
        titleText = titleText.slice(0, -1);
      }
      titleText += "..";
    }
    docObj.text(titleText, cardX + 2.4, cardY + (cardH > 20 ? 3.8 : 2.8));

    // Draw wrapped clinical description without cutting off lines
    docObj.setFont("helvetica", "normal");
    let descFontSize = cardH < 9 ? 4.2 : (cardH < 13 ? 4.6 : (cardH > 20 ? 6.2 : 5.0));
    let spacing = descFontSize * (cardH > 20 ? 0.45 : 0.42);

    docObj.setFontSize(descFontSize);
    docObj.setTextColor(71, 85, 105); // slate-600

    const textToWrap = finding.description || "";
    const wrapWidthLimit = colW - 4.2;
    let linesWrapped = docObj.splitTextToSize(textToWrap, wrapWidthLimit);

    const startTextY = cardY + (cardH > 20 ? 4.0 : 2.8) + spacing;
    const maxTextY = cardY + cardH - 1.0;
    const maxAllowedLines = Math.max(1, Math.floor((maxTextY - startTextY) / spacing) + 1);

    if (linesWrapped.length > maxAllowedLines && descFontSize > 3.8) {
      descFontSize = 3.8;
      spacing = descFontSize * 0.40;
      docObj.setFontSize(descFontSize);
      linesWrapped = docObj.splitTextToSize(textToWrap, wrapWidthLimit);
    }

    const linesToRender = Math.min(linesWrapped.length, Math.max(1, Math.floor((maxTextY - startTextY) / spacing) + 1));
    for (let i = 0; i < linesToRender; i++) {
      let lineStr = linesWrapped[i];
      if (i === linesToRender - 1 && linesWrapped.length > linesToRender && lineStr.length > 3) {
        lineStr = lineStr.slice(0, -3) + "...";
      }
      docObj.text(lineStr, cardX + 2.4, startTextY + (i * spacing));
    }
  });
}

export function wrapMarkdown(docObj: any, textStr: string, maxWidth: number) {
  const parts = textStr.split("**");
  const tokens: { text: string; isBold: boolean }[] = [];

  parts.forEach((partText, idx) => {
    if (!partText && idx !== 0) return; // Allow empty first item (implies starting with bold)
    const isBold = idx % 2 === 1;
    const subParts = partText.split(/(\s+)/);
    subParts.forEach((sub) => {
      if (sub === "") return;
      tokens.push({ text: sub, isBold });
    });
  });

  const lines: { text: string; isBold: boolean }[][] = [];
  let currentLine: { text: string; isBold: boolean }[] = [];
  let currentWidth = 0;

  const originalFontType = docObj.getFont().fontStyle;

  tokens.forEach((token) => {
    if (token.isBold) {
      docObj.setFont("times", "bold");
    } else {
      docObj.setFont("times", "normal");
    }
    docObj.setFontSize(10.5);
    const tokenWidth = docObj.getTextWidth(token.text);

    if (currentWidth + tokenWidth <= maxWidth) {
      currentLine.push(token);
      currentWidth += tokenWidth;
    } else {
      if (token.text.trim() === "" && currentLine.length === 0) {
        return; // Skip leading spaces
      }
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }
      currentLine = [token];
      currentWidth = tokenWidth;
    }
  });

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  docObj.setFont("times", originalFontType);
  return lines;
}

export function cleanTextForJSPDF(text: string): string {
  if (!text) return "";
  return text
    .replace(/[“”„«»‟]/g, '"')
    .replace(/[‘’`´′″]/g, "'")
    .replace(/[—–‒―]/g, "-")
    .replace(/[\u2022\u25E6\u2023\u2043\u25AA\u25FE\u25C6\u25C7\u25B6\u25B7\u25C0\u25C1]/g, "-")
    .replace(/[\u00A0\u200B\u2009\u202F\u2000-\u200A]/g, " ")
    .replace(/…/g, "...");
}

export function isImpressionBlockText(bText: string): boolean {
  const u = bText.toUpperCase();
  return u.includes("IMPRESIÓN DIAGNÓSTICA") || u.includes("IMPRESION DIAGNOSTICA") ||
         u.includes("CONCLUSIÓN:") || u.includes("CONCLUSIONES:") ||
         /^\s*(?:#{1,6}\s*|\*\*)*\s*(?:IMPRESI[OÓ]N|CONCLUSI[OÓ]N|CONCLUSIONES|DIAGN[OÓ]STICO)\b/i.test(bText);
}

export function recoverImpressionForPDF(sourceArr: string[], mainReportBlocks: string[]) {
  for (let i = 0; i < sourceArr.length; ) {
    if (isImpressionBlockText(sourceArr[i])) {
      const recovered = sourceArr.splice(i, sourceArr.length - i);
      mainReportBlocks.push(...recovered);
      break;
    } else {
      i++;
    }
  }
}

export function suiteHasRenderableContent(data: any): boolean {
  return !!(
    data &&
    ((Array.isArray(data.panels) && data.panels.length > 0) ||
      (Array.isArray(data.hemodynamicTable) && data.hemodynamicTable.length > 0) ||
      (Array.isArray(data.noduleTable) && data.noduleTable.length > 0) ||
      (Array.isArray(data.lesionTable) && data.lesionTable.length > 0) ||
      (Array.isArray(data.findingTable) && data.findingTable.length > 0))
  );
}

