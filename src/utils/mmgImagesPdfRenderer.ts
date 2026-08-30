import { jsPDF } from "jspdf";
import { getPanelLetter } from "./usImagesPdfRenderer";

export interface MmgImageItem {
  id: string;
  base64: string;
  name?: string;
  caption?: string;
  width?: number;
  height?: number;
  modality?: string;
  projection?: string;
  side?: string;
  dicomMetaData?: any;
}

export interface RenderMmgImagesOptions {
  startFigIdx?: number;
  studyTitle?: string;
  factor?: number;
  detectMetaFn?: (filename?: string, dicomMeta?: any) => { modality: string; projection: "CC" | "MLO" | "OTRO"; side: string };
}

interface MmgLayoutInfo {
  imgItem: MmgImageItem;
  imgIdx: number;
  globalFigIdx: number;
  drawW: number;
  drawH: number;
  cardWidth: number;
  cardHeight: number;
  proj: "CC" | "MLO" | "OTRO";
  side: string;
  figTitle: string;
  captionLines: string[];
  figTitleLines: string[];
  figTitleFontSize: number;
  captionBodyFontSize: number;
}

/**
 * Renders Mammography (MMG) Images into PDF in a true scientific journal figure format:
 * - Rounded soft-gray card container (#f8fafc with #cbd5e1 border) enclosing each image AND its complete explanation.
 * - Perfectly adapts height to the image's real aspect ratio + caption text without awkward empty gaps.
 * - Displays magenta scientific badge (PANEL A, PANEL B / PROYECCIÓN CC/MLO).
 * - Full-width or 2-up responsive scientific layout.
 */
export function renderMmgImagesToPdf(
  doc: jsPDF,
  images: MmgImageItem[],
  options: RenderMmgImagesOptions = {}
): number {
  if (!images || images.length === 0) return options.startFigIdx || 1;

  const factor = options.factor || 1;
  let currentGlobalFigIdx = options.startFigIdx || 1;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;

  const headerStartY = 18;
  const headerLineY = headerStartY + 4;
  const gridStartY = headerStartY + 9;
  const bottomMargin = 18;

  const renderPageHeader = (isContinuation = false) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5 * factor);
    doc.setTextColor(15, 23, 42); // slate-900

    const titleText = isContinuation
      ? "ANEXO: IMÁGENES DE MAMOGRAFÍA (MMG) (CONTINUACIÓN)"
      : "ANEXO: IMÁGENES DE MAMOGRAFÍA (MMG)";
    doc.text(titleText, marginX, headerStartY);

    // Header divider
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.4);
    doc.line(marginX, headerLineY, pageWidth - marginX, headerLineY);
  };

  // Sort images CC first, then MLO, then OTRO if detect function provided
  const detectMeta = options.detectMetaFn || ((filename?: string, dicomMeta?: any) => {
    const fn = (filename || "").toUpperCase();
    let p: "CC" | "MLO" | "OTRO" = "OTRO";
    if (fn.includes("CC") || fn.includes("CRANEO") || fn.includes("CRANIAL")) p = "CC";
    else if (fn.includes("MLO") || fn.includes("MEDIO") || fn.includes("OBLICU")) p = "MLO";
    let s = fn.includes("IZQ") || fn.includes("LEFT") || fn.includes("_L") ? "Izquierda" : (fn.includes("DER") || fn.includes("RIGHT") || fn.includes("_R") ? "Derecha" : "Bilateral");
    return { modality: "MMG", projection: p, side: s };
  });

  const sortedImages = [...images].sort((a, b) => {
    const metaA = detectMeta(a.name, a.dicomMetaData);
    const metaB = detectMeta(b.name, b.dicomMetaData);
    const projA = a.projection || metaA.projection;
    const projB = b.projection || metaB.projection;
    const scoreA = projA === "CC" ? 1 : (projA === "MLO" ? 2 : 3);
    const scoreB = projB === "CC" ? 1 : (projB === "MLO" ? 2 : 3);
    return scoreA - scoreB;
  });

  // If exactly 2 images and both were OTRO, default first to CC and second to MLO
  if (sortedImages.length === 2) {
    const meta0 = detectMeta(sortedImages[0].name, sortedImages[0].dicomMetaData);
    const meta1 = detectMeta(sortedImages[1].name, sortedImages[1].dicomMetaData);
    const proj0 = sortedImages[0].projection || meta0.projection;
    const proj1 = sortedImages[1].projection || meta1.projection;
    if (proj0 === "OTRO" && proj1 === "OTRO") {
      sortedImages[0].projection = "CC";
      sortedImages[1].projection = "MLO";
    }
  }

  // Determine card layout: If 1 image, full width card. If 2 or more, 1 per row (large format) or 2 per row
  // Mammographies are typically wide composite images (bilateral CC or bilateral MLO), so full contentWidth cards (1 per row, max 2 rows per page) is the golden standard.
  const cardWidth = contentWidth;
  const innerPad = 3.0;
  const maxImgW = cardWidth - innerPad * 2;

  // Precalculate layout items
  const itemsLayout: MmgLayoutInfo[] = sortedImages.map((imgItem, idx) => {
    const itemFigIdx = currentGlobalFigIdx + idx;
    const meta = detectMeta(imgItem.name, imgItem.dicomMetaData);
    const proj: "CC" | "MLO" | "OTRO" = (imgItem.projection as any) || meta.projection || "OTRO";
    const side = imgItem.side || meta.side || "Bilateral";

    const aspect = (imgItem.width && imgItem.height && imgItem.height > 0)
      ? imgItem.width / imgItem.height
      : (sortedImages.length === 1 ? (16 / 10) : (16 / 9));

    // For 1 image total, let image be up to 135mm high; for 2+ images, limit to 80mm so 2 can fit elegantly if needed
    const maxImgH = sortedImages.length === 1 ? 140 : 85;
    let drawW = maxImgW;
    let drawH = drawW / aspect;

    if (drawH > maxImgH) {
      drawH = maxImgH;
      drawW = drawH * aspect;
      if (drawW > maxImgW) {
        drawW = maxImgW;
      }
    }

    let figTitle = `Figura ${itemFigIdx}. Proyecciones Cráneo-Caudales (CC)`;
    if (proj === "MLO") {
      figTitle = `Figura ${itemFigIdx}. Proyecciones Medio-Lateral Oblicuas (MLO)`;
    } else if (proj === "OTRO") {
      figTitle = `Figura ${itemFigIdx}. Proyección Complementaria MMG (${side})`;
    }

    const defaultCaption = proj === "CC"
      ? "Proyecciones Cráneo-Caudales (CC) bilaterales. Patrón parenquimatoso de distribución simétrica sin nódulos dominantes ni microcalcificaciones pleomórficas agrupadas de sospecha."
      : (proj === "MLO"
        ? "Proyecciones Medio-Lateral Oblicuas (MLO) bilaterales. Adecuada visualización de la prolongación axilar y los planos musculares pectorales sin distorsiones arquitecturales ni adenopatías axilares patológicas."
        : "Mamografía digital, proyecciones complementarias y conos de magnificación.");

    const rawCaption = imgItem.caption && imgItem.caption.trim() ? imgItem.caption.trim() : defaultCaption;

    const figTitleFontSize = 8.5 * factor;
    const captionBodyFontSize = 7.5 * factor;

    const maxCaptionW = cardWidth - innerPad * 2 - 2;
    const figTitleLines = doc.splitTextToSize(figTitle, maxCaptionW);
    const captionLines = doc.splitTextToSize(rawCaption, maxCaptionW);

    const titleH = figTitleLines.length * (figTitleFontSize * 0.42);
    const captionH = captionLines.length * (captionBodyFontSize * 0.44);
    const textBlockH = titleH + 1.5 + captionH + 1.5;

    // Card height hugs image + gap + caption block + paddings
    const cardHeight = innerPad + drawH + 3.2 + textBlockH + innerPad;

    return {
      imgItem,
      imgIdx: idx,
      globalFigIdx: itemFigIdx,
      drawW,
      drawH,
      cardWidth,
      cardHeight,
      proj,
      side,
      figTitle,
      captionLines,
      figTitleLines,
      figTitleFontSize,
      captionBodyFontSize
    };
  });

  // Render cards sequentially with smart pagination
  let currentY = gridStartY;
  let isFirstPage = true;
  const gapY = 7;

  itemsLayout.forEach((layoutInfo, idx) => {
    // Check if card fits on current page
    const needsNewPage = (currentY + layoutInfo.cardHeight > pageHeight - bottomMargin);

    if (isFirstPage || needsNewPage) {
      doc.addPage();
      renderPageHeader(!isFirstPage);
      currentY = gridStartY;
      isFirstPage = false;
    }

    const cardX = marginX;
    const cardY = currentY;
    const actualCardH = layoutInfo.cardHeight;

    // --- A. SCIENTIFIC CARD RECTANGLE (Recuadro gris científico) ---
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.35);
    doc.roundedRect(cardX, cardY, layoutInfo.cardWidth, actualCardH, 2.5, 2.5, "FD");

    // --- B. IMAGE FRAME ---
    const imgFrameX = cardX + (layoutInfo.cardWidth - layoutInfo.drawW) / 2;
    const imgFrameY = cardY + innerPad;

    // Dark backdrop for high contrast
    doc.setFillColor(10, 15, 26);
    doc.roundedRect(imgFrameX, imgFrameY, layoutInfo.drawW, layoutInfo.drawH, 1.2, 1.2, "F");

    let format = "JPEG";
    if (layoutInfo.imgItem.base64.includes("image/png")) format = "PNG";
    else if (layoutInfo.imgItem.base64.includes("image/gif")) format = "GIF";
    else if (layoutInfo.imgItem.base64.includes("image/webp")) format = "WEBP";

    try {
      doc.addImage(layoutInfo.imgItem.base64, format, imgFrameX, imgFrameY, layoutInfo.drawW, layoutInfo.drawH);

      // Frame border
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.setLineWidth(0.2);
      doc.roundedRect(imgFrameX, imgFrameY, layoutInfo.drawW, layoutInfo.drawH, 1.2, 1.2, "S");

      // --- C. SCIENTIFIC BADGE (PANEL A / PANEL B • MMG CC/MLO) ---
      const panelLetter = getPanelLetter(layoutInfo.imgIdx);
      const projLabel = layoutInfo.proj === "CC" ? "CC" : (layoutInfo.proj === "MLO" ? "MLO" : "MMG");
      const badgeText = `PANEL ${panelLetter} • MMG ${projLabel}`;
      
      const badgeW = 28;
      const badgeH = 4.0;
      const badgeX = imgFrameX + 2;
      const badgeY = imgFrameY + 2;

      doc.setFillColor(15, 23, 42); // slate-900
      doc.setDrawColor(217, 70, 239); // fuchsia-500
      doc.setLineWidth(0.35);
      doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 0.8, 0.8, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.2 * factor);
      doc.setTextColor(255, 255, 255);
      doc.text(badgeText, badgeX + badgeW / 2, badgeY + (badgeH * 0.72), { align: "center" });

    } catch (err) {
      console.error("Error drawing MMG image in PDF:", err);
      doc.setFillColor(241, 245, 249);
      doc.rect(imgFrameX, imgFrameY, layoutInfo.drawW, layoutInfo.drawH, "F");
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.0);
      doc.setTextColor(148, 163, 184);
      doc.text("Mamografía no disponible", imgFrameX + 10, imgFrameY + (layoutInfo.drawH / 2));
    }

    // --- D. CAPTION & SCIENTIFIC EXPLANATION (Inside card, directly below image) ---
    const captionStartY = imgFrameY + layoutInfo.drawH + 3.2;
    const textLeftX = cardX + innerPad + 1.5;

    // Figure Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(layoutInfo.figTitleFontSize);
    doc.setTextColor(15, 23, 42); // slate-900

    const figTitleLineH = layoutInfo.figTitleFontSize * 0.42;
    let textCursorY = captionStartY + (layoutInfo.figTitleFontSize * 0.32);

    layoutInfo.figTitleLines.forEach((tLine) => {
      doc.text(tLine, textLeftX, textCursorY);
      textCursorY += figTitleLineH;
    });

    // Paragraph Description
    textCursorY += 0.8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(layoutInfo.captionBodyFontSize);
    doc.setTextColor(71, 85, 105); // slate-600

    const captionLineH = layoutInfo.captionBodyFontSize * 0.44;
    const maxAllowedY = cardY + actualCardH - 1.5;

    layoutInfo.captionLines.forEach((cLine) => {
      if (textCursorY + captionLineH <= maxAllowedY + 1.0) {
        doc.text(cLine, textLeftX, textCursorY);
        textCursorY += captionLineH;
      }
    });

    // Advance Y coordinate for next card
    currentY += actualCardH + gapY;
  });

  return currentGlobalFigIdx + sortedImages.length;
}
