import { jsPDF } from "jspdf";
import { UsImagesGridMode } from "../types";

export interface UsImageItem {
  id: string;
  base64: string;
  name?: string;
  caption?: string;
  width?: number;
  height?: number;
  modality?: string;
  projection?: string;
  side?: string;
  subtitle?: string;
}

export interface RenderUsImagesOptions {
  gridMode?: UsImagesGridMode;
  startFigIdx?: number;
  studyTitle?: string;
  factor?: number;
}

/**
 * Generates panel letters: 0 -> A, 1 -> B ... 25 -> Z, 26 -> AA ...
 */
export function getPanelLetter(index: number): string {
  let letter = "";
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

interface ImageLayoutInfo {
  imgItem: UsImageItem;
  imgIdx: number;
  globalFigIdx: number;
  drawW: number;
  drawH: number;
  cardWidth: number;
  cardHeight: number;
  captionLines: string[];
  figLabelLines: string[];
  figTitleFontSize: number;
  captionBodyFontSize: number;
}

/**
 * Renders Ultrasound Images into PDF in a true scientific journal figure format:
 * - Rounded soft-gray card container enclosing each image AND its complete explanation.
 * - Card dimensions adapt dynamically to the image aspect ratio and text height without stretching or excessive empty whitespace.
 * - Perfectly aligned multi-column rows with uniform row heights.
 * - Elegant panel badges (PANEL A, PANEL B...), bold figure titles, and high-contrast typography.
 */
export function renderUsImagesToPdf(
  doc: jsPDF,
  images: UsImageItem[],
  options: RenderUsImagesOptions = {}
): number {
  if (!images || images.length === 0) return options.startFigIdx || 1;

  const factor = options.factor || 1;
  const gridMode: UsImagesGridMode = options.gridMode || "auto";
  let currentGlobalFigIdx = options.startFigIdx || 1;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;

  // 1. Determine columns and max rows per page based on gridMode and image count
  let cols = 2;
  let maxRowsPerPage = 2;

  if (gridMode === "auto") {
    if (images.length === 1) {
      cols = 1;
      maxRowsPerPage = 1;
    } else if (images.length === 2) {
      cols = 2;
      maxRowsPerPage = 1; // 2 images side-by-side on 1 row
    } else if (images.length <= 4) {
      cols = 2;
      maxRowsPerPage = 2;
    } else if (images.length <= 6) {
      cols = 2;
      maxRowsPerPage = 3;
    } else {
      cols = 2;
      maxRowsPerPage = 2; // Default 4 per page for clean multi-page document
    }
  } else if (gridMode === "1x1") {
    cols = 1;
    maxRowsPerPage = 1;
  } else if (gridMode === "1x2") {
    cols = 2;
    maxRowsPerPage = 1;
  } else if (gridMode === "2x1") {
    cols = 1;
    maxRowsPerPage = 2;
  } else if (gridMode === "2x2") {
    cols = 2;
    maxRowsPerPage = 2;
  } else if (gridMode === "3x2") {
    cols = 2;
    maxRowsPerPage = 3;
  } else if (gridMode === "4x2") {
    cols = 2;
    maxRowsPerPage = 4;
  }

  const gapX = cols > 1 ? 6 : 0;
  const gapY = 6;

  const headerStartY = 18;
  const headerLineY = headerStartY + 4;
  const gridStartY = headerStartY + 9;
  const bottomMargin = 18;
  const maxAvailableHeightOnPage = pageHeight - gridStartY - bottomMargin;

  const renderPageHeader = (isContinuation = false) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5 * factor);
    doc.setTextColor(15, 23, 42); // slate-900

    const titleText = isContinuation
      ? "ANEXO: IMÁGENES Y CAPTURAS DE ULTRASONIDO (CONTINUACIÓN)"
      : "ANEXO: IMÁGENES Y CAPTURAS DE ULTRASONIDO";
    doc.text(titleText, marginX, headerStartY);

    // Accent header divider
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.4);
    doc.line(marginX, headerLineY, pageWidth - marginX, headerLineY);
  };

  // 2. Pre-calculate layout info for each image item
  const cardWidth = cols === 1
    ? (maxRowsPerPage === 1 ? Math.min(contentWidth, 150) : contentWidth)
    : (contentWidth - (cols - 1) * gapX) / cols;

  const innerPad = 2.5;
  const maxImgW = cardWidth - innerPad * 2;

  // Max image height limit to avoid page overflow based on rows
  const maxImgHCap = maxRowsPerPage === 1
    ? 105
    : (maxRowsPerPage === 2 ? 68 : (maxRowsPerPage === 3 ? 46 : 34));

  const itemsLayout: ImageLayoutInfo[] = images.map((imgItem, idx) => {
    const itemFigIdx = currentGlobalFigIdx + idx;
    const aspect = (imgItem.width && imgItem.height && imgItem.height > 0)
      ? imgItem.width / imgItem.height
      : (4 / 3);

    // Calculate natural image dimensions
    let drawW = maxImgW;
    let drawH = drawW / aspect;

    if (drawH > maxImgHCap) {
      drawH = maxImgHCap;
      drawW = drawH * aspect;
      if (drawW > maxImgW) {
        drawW = maxImgW;
      }
    }

    // Typography sizing based on density
    const figTitleFontSize = cols === 1 ? 8.2 : (maxRowsPerPage >= 4 ? 5.8 : (maxRowsPerPage === 3 ? 6.5 : 7.2));
    const captionBodyFontSize = cols === 1 ? 7.5 : (maxRowsPerPage >= 4 ? 5.2 : (maxRowsPerPage === 3 ? 5.8 : 6.5));

    const subTitleText = imgItem.subtitle || (imgItem.side ? `Corte Ecográfico (${imgItem.side})` : "Registro Ecográfico");
    const figureLabel = `Figura ${itemFigIdx}. ${subTitleText}`;
    
    const maxCaptionW = cardWidth - innerPad * 2 - 1.5;
    const figLabelLines = doc.splitTextToSize(figureLabel, maxCaptionW);

    const captionText = imgItem.caption && imgItem.caption.trim() !== ""
      ? imgItem.caption.trim()
      : "Registro ecográfico en escala de grises con adecuada diferenciación tisular.";
    const captionLines = doc.splitTextToSize(captionText, maxCaptionW);

    // Calculate caption height
    const figTitleLineH = figTitleFontSize * 0.42;
    const captionLineH = captionBodyFontSize * 0.44;
    const captionBlockH = (figLabelLines.length * figTitleLineH) + 1.5 + (captionLines.length * captionLineH) + 1.5;

    // Card height hugs image + gap + caption + padding
    const cardHeight = innerPad + drawH + 3.0 + captionBlockH + innerPad;

    return {
      imgItem,
      imgIdx: idx,
      globalFigIdx: itemFigIdx,
      drawW,
      drawH,
      cardWidth,
      cardHeight,
      captionLines,
      figLabelLines,
      figTitleFontSize,
      captionBodyFontSize
    };
  });

  // 3. Group layout items into rows
  const rowsList: ImageLayoutInfo[][] = [];
  for (let i = 0; i < itemsLayout.length; i += cols) {
    rowsList.push(itemsLayout.slice(i, i + cols));
  }

  // 4. Render rows with dynamic pagination and unified row heights
  let currentY = gridStartY;
  let isFirstPage = true;
  let rowsOnCurrentPage = 0;

  rowsList.forEach((rowItems) => {
    // Determine uniform row height so all cards in this row align perfectly
    const uniformRowHeight = Math.max(...rowItems.map(item => item.cardHeight));

    // Check if row exceeds remaining page space OR exceeds maxRowsPerPage
    const needsNewPage = (rowsOnCurrentPage >= maxRowsPerPage) || (currentY + uniformRowHeight > pageHeight - bottomMargin);

    if (isFirstPage || needsNewPage) {
      doc.addPage();
      renderPageHeader(!isFirstPage);
      currentY = gridStartY;
      rowsOnCurrentPage = 0;
      isFirstPage = false;
    }

    // Render each item in the row
    rowItems.forEach((layoutInfo, colIdx) => {
      const cardX = cols === 1
        ? marginX + (contentWidth - layoutInfo.cardWidth) / 2
        : marginX + colIdx * (layoutInfo.cardWidth + gapX);
      const cardY = currentY;
      const actualCardH = uniformRowHeight;

      // --- A. SCIENTIFIC CARD RECTANGLE (Recuadro gris suave científico) ---
      doc.setFillColor(248, 250, 252); // slate-50 (light scientific gray)
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.setLineWidth(0.35);
      doc.roundedRect(cardX, cardY, layoutInfo.cardWidth, actualCardH, 2.5, 2.5, "FD");

      // --- B. IMAGE FRAME (Centered in upper portion of card) ---
      const imgFrameX = cardX + (layoutInfo.cardWidth - layoutInfo.drawW) / 2;
      const imgFrameY = cardY + innerPad;

      // Dark backing container for high-contrast ultrasound rendering
      doc.setFillColor(10, 15, 26); // dark slate/black
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

        // --- C. SCIENTIFIC BADGE (PANEL A, PANEL B...) ---
        const panelLetter = getPanelLetter(layoutInfo.imgIdx);
        const badgeW = maxRowsPerPage >= 4 ? 13 : 15.5;
        const badgeH = maxRowsPerPage >= 4 ? 3.4 : 3.8;
        const badgeX = imgFrameX + 1.5;
        const badgeY = imgFrameY + 1.5;

        doc.setFillColor(15, 23, 42); // slate-900
        doc.setDrawColor(2, 132, 199); // sky-600
        doc.setLineWidth(0.3);
        doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 0.6, 0.6, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(maxRowsPerPage >= 4 ? 5.2 : 5.8);
        doc.setTextColor(255, 255, 255);
        doc.text(`PANEL ${panelLetter}`, badgeX + badgeW / 2, badgeY + (badgeH * 0.72), { align: "center" });

      } catch (err) {
        console.error("Error drawing US image in PDF:", err);
        doc.setFillColor(241, 245, 249);
        doc.rect(imgFrameX, imgFrameY, layoutInfo.drawW, layoutInfo.drawH, "F");
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text("Imagen no disponible", imgFrameX + 4, imgFrameY + (layoutInfo.drawH / 2));
      }

      // --- D. CAPTION & SCIENTIFIC EXPLANATION (Inside the card, directly below image) ---
      const captionStartY = imgFrameY + layoutInfo.drawH + 3.2;
      const textLeftX = cardX + innerPad + 1;
      const maxCaptionW = layoutInfo.cardWidth - innerPad * 2 - 2;

      // Figure Title (Figura X. Registro Ecográfico)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(layoutInfo.figTitleFontSize);
      doc.setTextColor(15, 23, 42); // slate-900

      const figTitleLineH = layoutInfo.figTitleFontSize * 0.42;
      let textCursorY = captionStartY + (layoutInfo.figTitleFontSize * 0.32);

      layoutInfo.figLabelLines.forEach((tLine) => {
        doc.text(tLine, textLeftX, textCursorY);
        textCursorY += figTitleLineH;
      });

      // Body text description
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
    });

    // Advance Y coordinate for the next row
    currentY += uniformRowHeight + gapY;
    rowsOnCurrentPage++;
  });

  return currentGlobalFigIdx + images.length;
}
