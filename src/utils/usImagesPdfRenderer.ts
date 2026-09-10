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
  figLabelLines: string[];
  figTitleFontSize: number;
  figTitleLineH: number;
  captionTopGap: number;
  textBaselineOffset: number;
  captionBottomPad: number;
}

/**
 * Renders Ultrasound Images into PDF in a true scientific journal figure format.
 * Captions are always fully contained inside each card for every grid mode (1x1, 2x1, 2x2, etc.).
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
      maxRowsPerPage = 1;
    } else if (images.length <= 4) {
      cols = 2;
      maxRowsPerPage = 2;
    } else if (images.length <= 6) {
      cols = 2;
      maxRowsPerPage = 3;
    } else {
      cols = 2;
      maxRowsPerPage = 2;
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
  // Hard ceiling per card so multi-row pages never overflow the page
  const maxCardH =
    (maxAvailableHeightOnPage - (maxRowsPerPage - 1) * gapY) / maxRowsPerPage;

  const renderPageHeader = (isContinuation = false) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5 * factor);
    doc.setTextColor(15, 23, 42);

    const titleText = isContinuation
      ? "ANEXO: IMÁGENES Y CAPTURAS DE ULTRASONIDO (CONTINUACIÓN)"
      : "ANEXO: IMÁGENES Y CAPTURAS DE ULTRASONIDO";
    doc.text(titleText, marginX, headerStartY);

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.line(marginX, headerLineY, pageWidth - marginX, headerLineY);
  };

  // 2. Pre-calculate layout info for each image item
  const cardWidth =
    cols === 1
      ? maxRowsPerPage === 1
        ? Math.min(contentWidth, 150)
        : contentWidth
      : (contentWidth - (cols - 1) * gapX) / cols;

  const innerPad = 2.5;
  const maxImgW = cardWidth - innerPad * 2;
  const captionTopGap = 3.0;
  const captionBottomPad = 2.2;
  const textBaselineOffsetFactor = 0.35;
  // Slightly generous line height so wrapped clinical captions stay inside the card
  const lineHeightFactor = 0.48;

  const maxImgHCap =
    maxRowsPerPage === 1
      ? 105
      : maxRowsPerPage === 2
        ? 68
        : maxRowsPerPage === 3
          ? 46
          : 34;

  const itemsLayout: ImageLayoutInfo[] = images.map((imgItem, idx) => {
    const itemFigIdx = currentGlobalFigIdx + idx;
    const aspect =
      imgItem.width && imgItem.height && imgItem.height > 0
        ? imgItem.width / imgItem.height
        : 4 / 3;

    const figTitleFontSize =
      cols === 1
        ? 8.2
        : maxRowsPerPage >= 4
          ? 5.8
          : maxRowsPerPage === 3
            ? 6.5
            : 7.2;
    const figTitleLineH = figTitleFontSize * lineHeightFactor;
    const textBaselineOffset = figTitleFontSize * textBaselineOffsetFactor;

    const captionText =
      imgItem.caption && imgItem.caption.trim() !== ""
        ? imgItem.caption.trim()
        : "Registro ecográfico en escala de grises con adecuada diferenciación tisular.";

    const figureLabel = `Figura ${itemFigIdx}. ${captionText}`;
    const maxCaptionW = cardWidth - innerPad * 2 - 2;

    // IMPORTANT: set font before measuring wrap width
    doc.setFont("helvetica", "bold");
    doc.setFontSize(figTitleFontSize);
    let figLabelLines = doc.splitTextToSize(figureLabel, maxCaptionW) as string[];

    // Caption area needed for all lines (baseline + n lines)
    const captionNeededH =
      textBaselineOffset + figLabelLines.length * figTitleLineH + 1.0;

    // Reserve space for caption inside max card height; shrink image if needed
    const nonImageH =
      innerPad + captionTopGap + captionNeededH + captionBottomPad + innerPad;
    let availableForImage = Math.min(
      maxImgHCap,
      Math.max(18, maxCardH - nonImageH)
    );

    // If caption is extremely long, cap visible lines and keep card within maxCardH
    const maxCaptionAreaH = Math.max(
      figTitleLineH * 2 + textBaselineOffset,
      maxCardH - (innerPad + 18 + captionTopGap + captionBottomPad + innerPad)
    );
    if (captionNeededH > maxCaptionAreaH) {
      const maxLines = Math.max(
        1,
        Math.floor((maxCaptionAreaH - textBaselineOffset - 1.0) / figTitleLineH)
      );
      if (figLabelLines.length > maxLines) {
        figLabelLines = figLabelLines.slice(0, maxLines);
        const last = figLabelLines[maxLines - 1];
        figLabelLines[maxLines - 1] =
          last.length > 3 ? `${last.replace(/\s+$/, "").slice(0, Math.max(1, last.length - 1))}…` : `${last}…`;
      }
      availableForImage = Math.min(
        maxImgHCap,
        Math.max(
          18,
          maxCardH -
            (innerPad +
              captionTopGap +
              (textBaselineOffset + figLabelLines.length * figTitleLineH + 1.0) +
              captionBottomPad +
              innerPad)
        )
      );
    }

    let drawW = maxImgW;
    let drawH = drawW / aspect;
    if (drawH > availableForImage) {
      drawH = availableForImage;
      drawW = drawH * aspect;
      if (drawW > maxImgW) {
        drawW = maxImgW;
        drawH = drawW / aspect;
        if (drawH > availableForImage) {
          drawH = availableForImage;
          drawW = drawH * aspect;
        }
      }
    }

    const captionBlockH =
      textBaselineOffset + figLabelLines.length * figTitleLineH + 1.0;
    const cardHeight = Math.min(
      maxCardH,
      innerPad + drawH + captionTopGap + captionBlockH + captionBottomPad + innerPad
    );

    return {
      imgItem,
      imgIdx: idx,
      globalFigIdx: itemFigIdx,
      drawW,
      drawH,
      cardWidth,
      cardHeight,
      figLabelLines,
      figTitleFontSize,
      figTitleLineH,
      captionTopGap,
      textBaselineOffset,
      captionBottomPad,
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
    const uniformRowHeight = Math.min(
      maxCardH,
      Math.max(...rowItems.map((item) => item.cardHeight))
    );

    const needsNewPage =
      rowsOnCurrentPage >= maxRowsPerPage ||
      currentY + uniformRowHeight > pageHeight - bottomMargin;

    if (isFirstPage || needsNewPage) {
      doc.addPage();
      renderPageHeader(!isFirstPage);
      currentY = gridStartY;
      rowsOnCurrentPage = 0;
      isFirstPage = false;
    }

    rowItems.forEach((layoutInfo, colIdx) => {
      const cardX =
        cols === 1
          ? marginX + (contentWidth - layoutInfo.cardWidth) / 2
          : marginX + colIdx * (layoutInfo.cardWidth + gapX);
      const cardY = currentY;
      const actualCardH = uniformRowHeight;

      // --- A. SCIENTIFIC CARD ---
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.35);
      doc.roundedRect(cardX, cardY, layoutInfo.cardWidth, actualCardH, 2.5, 2.5, "FD");

      // --- B. IMAGE ---
      const imgFrameX = cardX + (layoutInfo.cardWidth - layoutInfo.drawW) / 2;
      const imgFrameY = cardY + innerPad;

      doc.setFillColor(10, 15, 26);
      doc.roundedRect(imgFrameX, imgFrameY, layoutInfo.drawW, layoutInfo.drawH, 1.2, 1.2, "F");

      let format = "JPEG";
      if (layoutInfo.imgItem.base64.includes("image/png")) format = "PNG";
      else if (layoutInfo.imgItem.base64.includes("image/gif")) format = "GIF";
      else if (layoutInfo.imgItem.base64.includes("image/webp")) format = "WEBP";

      try {
        doc.addImage(
          layoutInfo.imgItem.base64,
          format,
          imgFrameX,
          imgFrameY,
          layoutInfo.drawW,
          layoutInfo.drawH
        );

        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.roundedRect(imgFrameX, imgFrameY, layoutInfo.drawW, layoutInfo.drawH, 1.2, 1.2, "S");

        const panelLetter = getPanelLetter(layoutInfo.imgIdx);
        const badgeW = maxRowsPerPage >= 4 ? 13 : 15.5;
        const badgeH = maxRowsPerPage >= 4 ? 3.4 : 3.8;
        const badgeX = imgFrameX + 1.5;
        const badgeY = imgFrameY + 1.5;

        doc.setFillColor(15, 23, 42);
        doc.setDrawColor(2, 132, 199);
        doc.setLineWidth(0.3);
        doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 0.6, 0.6, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(maxRowsPerPage >= 4 ? 5.2 : 5.8);
        doc.setTextColor(255, 255, 255);
        doc.text(`PANEL ${panelLetter}`, badgeX + badgeW / 2, badgeY + badgeH * 0.72, {
          align: "center",
        });
      } catch (err) {
        console.error("Error drawing US image in PDF:", err);
        doc.setFillColor(241, 245, 249);
        doc.rect(imgFrameX, imgFrameY, layoutInfo.drawW, layoutInfo.drawH, "F");
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text("Imagen no disponible", imgFrameX + 4, imgFrameY + layoutInfo.drawH / 2);
      }

      // --- C. CAPTION (strictly inside card) ---
      const captionStartY = imgFrameY + layoutInfo.drawH + layoutInfo.captionTopGap;
      const textLeftX = cardX + innerPad + 1;
      const textBottomLimit =
        cardY + actualCardH - layoutInfo.captionBottomPad - innerPad * 0.35;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(layoutInfo.figTitleFontSize);
      doc.setTextColor(15, 23, 42);

      let textCursorY = captionStartY + layoutInfo.textBaselineOffset;
      for (const tLine of layoutInfo.figLabelLines) {
        // Never draw past the inner bottom of the card
        if (textCursorY > textBottomLimit) break;
        doc.text(tLine, textLeftX, textCursorY);
        textCursorY += layoutInfo.figTitleLineH;
      }
    });

    currentY += uniformRowHeight + gapY;
    rowsOnCurrentPage++;
  });

  return currentGlobalFigIdx + images.length;
}
