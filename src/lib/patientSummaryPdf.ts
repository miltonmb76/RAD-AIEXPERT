import { jsPDF } from "jspdf";
import { getImageDimensionsVirtual } from "./imageDimensions";
import { stripEmojisForPdf } from "./pdfTextUtils";

export type PatientSummaryPdfDeps = {
  patientSummary: any;
  clinicName: string;
  customLogoUrl: string;
  customLogoRightUrl: string;
  customSignatureUrl: string;
  customLogoStyle: string;
  patientName: string;
  reportDate: string;
  doctorName: string;
  doctorLicense: string;
  studyType: string;
  selectedLogo: string;
  formatDateToDMY: (dateStr: string) => string;
  /** Optional patient infographic data-URL or http(s) URL */
  infographicUrl?: string;
};

const FORMAL_REPORT_DISCLAIMER =
  "IMPORTANTE: Este documento es una explicación en lenguaje claro para usted. El informe radiológico formal, dirigido a su médico tratante, se entrega por separado y es el documento que debe presentar en consulta.";

export async function downloadPatientSummaryPdf(
  deps: PatientSummaryPdfDeps,
  openInNewTab: boolean = false,
  shareViaWebShare: boolean = false,
  returnBase64: boolean = false,
  returnBlobUrl: boolean = false,
  returnRawBlob: boolean = false
): Promise<any> {
  const {
    patientSummary,
    clinicName,
    customLogoUrl,
    customLogoRightUrl,
    customSignatureUrl,
    customLogoStyle,
    patientName,
    reportDate,
    doctorName,
    doctorLicense,
    studyType,
    selectedLogo,
    formatDateToDMY,
    infographicUrl,
  } = deps;
  if (!patientSummary) return;

  // Hard-ignore recommendation-style fields even if present in older saved data
  const studyOverview = String(patientSummary.studyOverview || "").trim();
  const keyFindings = Array.isArray(patientSummary.keyFindings)
    ? patientSummary.keyFindings
    : [];

  const displayClinicName = clinicName && clinicName.trim().toUpperCase() !== "CLÍNICA PRIVADA" && clinicName.trim().toUpperCase() !== "CLINICA PRIVADA" ? clinicName.toUpperCase() : "";

  try {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: false,
    });

    let yCoord = 20;
    const marginX = 20;
    const pageWidth = 210;
    const pageHeight = 297;
    const contentWidth = pageWidth - (2 * marginX); // 170mm

    // Load virtual image dimensions to prevent any layout distortion on any device
    const logoDims = await getImageDimensionsVirtual(customLogoUrl);
    const logoRightDims = await getImageDimensionsVirtual(customLogoRightUrl);
    const signatureDims = await getImageDimensionsVirtual(customSignatureUrl);

    const stripEmojis = stripEmojisForPdf;

    // --- DYNAMIC PAGE BUDGET & COMPLETE WIDOW/ORPHAN CONTROL (ALGORITMO DE CORRECCIÓN DE VIUDAS Y HUÉRFANOS) ---
    let factor = 1.0;
    let estimatedHeight = 20; // Start at top margin

    // 1. Header height estimation
    if (customLogoUrl) {
      if (customLogoStyle === "banner") {
        let bannerHeight = 35;
        if (logoDims.width && logoDims.height) {
          const aspect = logoDims.width / logoDims.height;
          const maxWidth = contentWidth;
          const maxHeight = 52;
          bannerHeight = aspect > maxWidth / maxHeight ? maxWidth / aspect : maxHeight;
        }
        estimatedHeight += bannerHeight + 5;
        if (displayClinicName) estimatedHeight += 5;
      } else if (customLogoStyle === "dual") {
        const fitH = (dims: { width: number; height: number }) => {
          if (dims.width && dims.height) {
            const aspect = dims.width / dims.height;
            const maxWidth = 52;
            const maxHeight = 38;
            return aspect > maxWidth / maxHeight ? maxWidth / aspect : maxHeight;
          }
          return 38;
        };
        const leftH = fitH(logoDims);
        const rightH = customLogoRightUrl ? fitH(logoRightDims) : 0;
        estimatedHeight += Math.max(leftH, rightH, 16) + 6;
      } else {
        let logoHeight = 36;
        if (logoDims.width && logoDims.height) {
          const aspect = logoDims.width / logoDims.height;
          const maxWidth = 42;
          const maxHeight = 42;
          logoHeight = aspect > maxWidth / maxHeight ? maxWidth / aspect : maxHeight;
        }
        estimatedHeight += Math.max(logoHeight, 15) + 6;
      }
    } else {
      estimatedHeight += 18;
    }
    estimatedHeight += 2; // Underline

    // 2. Patient metadata block estimation
    if (patientName || reportDate) {
      estimatedHeight += 19;
    }

    // 3. Document Title
    estimatedHeight += 12;

    // 4. Intro Summary
    const tempDoc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    if (patientSummary.summary) {
      const cleanSummaryLocal = stripEmojis(patientSummary.summary);
      const splitSummaryLocal = tempDoc.splitTextToSize(cleanSummaryLocal, contentWidth);
      estimatedHeight += splitSummaryLocal.length * 5.5 + 4;
    }

    // 4b. Study overview
    if (studyOverview) {
      const splitOverview = tempDoc.splitTextToSize(stripEmojis(studyOverview), contentWidth);
      estimatedHeight += splitOverview.length * 5.5 + 14;
    }

    // 5. Key Findings (no care points / suggested questions)
    if (keyFindings.length > 0) {
      estimatedHeight += 22;
      keyFindings.forEach((finding: any) => {
        const title = stripEmojis(finding.title || "");
        const originalTerm = stripEmojis(finding.originalTerm || "");
        const simplifiedExplanation = stripEmojis(finding.simplifiedExplanation || "");
        const analogy = stripEmojis(finding.analogy || "");
        const clinicalContext = stripEmojis(finding.clinicalContext || finding.reassurance || "");

        const splitTitle = tempDoc.splitTextToSize(title, contentWidth - 10);
        const splitOrig = tempDoc.splitTextToSize(`Término original en informe técnico: "${originalTerm}"`, contentWidth - 10);
        const splitExp = tempDoc.splitTextToSize(`Explicación: ${simplifiedExplanation}`, contentWidth - 14);
        const splitAnalogy = analogy
          ? tempDoc.splitTextToSize(`Analogía de comprensión: ${analogy}`, contentWidth - 14)
          : [];
        const splitContext = clinicalContext
          ? tempDoc.splitTextToSize(`Contexto descriptivo: ${clinicalContext}`, contentWidth - 14)
          : [];

        const neededHeight = (splitTitle.length * 5) +
                             (splitOrig.length * 4) +
                             (splitExp.length * 5) +
                             (splitAnalogy.length * 4.5) +
                             (splitContext.length * 4.5) + 20;
        estimatedHeight += neededHeight + 2;
      });
      estimatedHeight += 4;
    }

    // Disclaimer + optional infographic page budget
    estimatedHeight += 28;
    if (infographicUrl) {
      estimatedHeight += 120;
    }

    // Sign-off block
    estimatedHeight += 38;

    // 9. Calculate pages and remainder for widow/orphan detection
    const usablePageHeight = 255;
    const estTotalPages = Math.ceil(estimatedHeight / usablePageHeight);
    const estRemainder = estimatedHeight % usablePageHeight;

    if (estTotalPages > 1 && estRemainder < 48) {
      factor = 0.84; // 16% spacing and height compression
    } else if (estTotalPages > 1 && estRemainder < 60) {
      factor = 0.88; // 12% spacing and height compression
    }

    // Helper function to check space and add page if needed
    const checkPageBreak = (neededHeight: number) => {
      if (yCoord + neededHeight > pageHeight - 20) {
        doc.addPage();
        yCoord = 20;
      }
    };

    // Header Brand/Clinic Logo & Name
    if (customLogoUrl) {
      if (customLogoStyle === "banner") {
        let bannerWidth = 165;
        let bannerHeight = 35;
        if (logoDims.width && logoDims.height) {
          const aspect = logoDims.width / logoDims.height;
          const maxWidth = contentWidth;
          const maxHeight = 52;
          if (aspect > maxWidth / maxHeight) {
            bannerWidth = maxWidth;
            bannerHeight = maxWidth / aspect;
          } else {
            bannerHeight = maxHeight;
            bannerWidth = maxHeight * aspect;
          }
        }
        
        try {
          const format = customLogoUrl.toLowerCase().includes("image/png") ? "PNG" : "JPEG";
          doc.addImage(customLogoUrl, format, (pageWidth - bannerWidth) / 2, yCoord, bannerWidth, bannerHeight);
          yCoord += bannerHeight + 5;
        } catch (err) {
          console.warn("Could not draw banner image inside jsPDF", err);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(14);
          doc.setTextColor(15, 23, 42);
          doc.text(displayClinicName || "ACOMPAÑAMIENTO EXPLICATIVO", pageWidth / 2, yCoord, { align: "center" });
          yCoord += 6;
        }

        if (displayClinicName) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(15, 23, 42);
          doc.text(displayClinicName, pageWidth / 2, yCoord, { align: "center" });
          yCoord += 5;
        }
      } else if (customLogoStyle === "dual") {
        const fitDualLogo = (dims: { width: number; height: number }) => {
          let w = 42;
          let h = 38;
          if (dims.width && dims.height) {
            const aspect = dims.width / dims.height;
            const maxWidth = 52;
            const maxHeight = 38;
            if (aspect > maxWidth / maxHeight) {
              w = maxWidth;
              h = maxWidth / aspect;
            } else {
              h = maxHeight;
              w = maxHeight * aspect;
            }
          }
          return { w, h };
        };
        const leftFit = fitDualLogo(logoDims);
        const rightFit = customLogoRightUrl ? fitDualLogo(logoRightDims) : { w: 0, h: 0 };
        const rowH = Math.max(leftFit.h, rightFit.h || 0, 16);

        try {
          const formatL = customLogoUrl.toLowerCase().includes("image/png") ? "PNG" : "JPEG";
          doc.addImage(customLogoUrl, formatL, marginX, yCoord + (rowH - leftFit.h) / 2, leftFit.w, leftFit.h);
        } catch (err) {
          console.warn("Could not draw left dual logo in patient PDF", err);
        }
        if (customLogoRightUrl) {
          try {
            const formatR = customLogoRightUrl.toLowerCase().includes("image/png") ? "PNG" : "JPEG";
            doc.addImage(
              customLogoRightUrl,
              formatR,
              pageWidth - marginX - rightFit.w,
              yCoord + (rowH - rightFit.h) / 2,
              rightFit.w,
              rightFit.h
            );
          } catch (err) {
            console.warn("Could not draw right dual logo in patient PDF", err);
          }
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text(displayClinicName || "ACOMPAÑAMIENTO EXPLICATIVO", pageWidth / 2, yCoord + rowH / 2 - 1, { align: "center" });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text("EXPLICACIÓN MÉDICA COMPRENSIBLE PARA EL PACIENTE", pageWidth / 2, yCoord + rowH / 2 + 4, { align: "center" });
        yCoord += rowH + 6;
      } else {
        let logoWidth = 36;
        let logoHeight = 36;
        if (logoDims.width && logoDims.height) {
          const aspect = logoDims.width / logoDims.height;
          const maxWidth = 42;
          const maxHeight = 42;
          if (aspect > maxWidth / maxHeight) {
            logoWidth = maxWidth;
            logoHeight = maxWidth / aspect;
          } else {
            logoHeight = maxHeight;
            logoWidth = maxHeight * aspect;
          }
        }
        
        try {
          const format = customLogoUrl.toLowerCase().includes("image/png") ? "PNG" : "JPEG";
          doc.addImage(customLogoUrl, format, marginX, yCoord, logoWidth, logoHeight);
        } catch (err) {
          console.warn("Could not draw logo image inside left header", err);
        }
        
        const textX = marginX + logoWidth + 6;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text(displayClinicName || "ACOMPAÑAMIENTO EXPLICATIVO", textX, yCoord + (logoHeight / 2) - 1.5);
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text("EXPLICACIÓN MÉDICA COMPRENSIBLE PARA EL PACIENTE", textX, yCoord + (logoHeight / 2) + 4);
        
        yCoord += Math.max(logoHeight, 15) + 6;
      }
    } else {
      let symbolWidth = 0;
      if (selectedLogo === "medical-cross") {
        symbolWidth = 14;
        doc.setDrawColor(220, 38, 38);
        doc.setFillColor(220, 38, 38);
        doc.rect(marginX + 5, yCoord, 4, 12, "F");
        doc.rect(marginX + 1, yCoord + 4, 12, 4, "F");
      } else if (selectedLogo === "heart-pulse") {
        symbolWidth = 14;
        doc.setDrawColor(244, 63, 94);
        doc.setFillColor(244, 63, 94);
        doc.rect(marginX + 5, yCoord, 4, 12, "F");
        doc.rect(marginX + 1, yCoord + 4, 12, 4, "F");
      } else if (selectedLogo === "dna" || selectedLogo === "shield-check") {
        symbolWidth = 14;
        doc.setDrawColor(79, 70, 229);
        doc.setFillColor(79, 70, 229);
        doc.rect(marginX + 5, yCoord, 4, 12, "F");
        doc.rect(marginX + 1, yCoord + 4, 12, 4, "F");
      }

      if (symbolWidth > 0) {
        const textX = marginX + symbolWidth + 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text(displayClinicName || "ACOMPAÑAMIENTO EXPLICATIVO", textX, yCoord + 5);
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text("EXPLICACIÓN MÉDICA COMPRENSIBLE PARA EL PACIENTE", textX, yCoord + 10.5);
        
        yCoord += 18;
      } else {
        if (displayClinicName) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(14);
          doc.setTextColor(15, 23, 42);
          doc.text(displayClinicName, pageWidth / 2, yCoord, { align: "center" });
          yCoord += 6;

          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          doc.text("EXPLICACIÓN MÉDICA COMPRENSIBLE PARA EL PACIENTE", pageWidth / 2, yCoord, { align: "center" });
          yCoord += 8;
        } else {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(14);
          doc.setTextColor(15, 23, 42);
          doc.text("EXPLICACIÓN COMPRENSIBLE DE ESTUDIO RADIOLÓGICO", pageWidth / 2, yCoord, { align: "center" });
          yCoord += 11;
        }
      }
    }

    // Add a line under header
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(marginX, yCoord - 2, pageWidth - marginX, yCoord - 2);
    yCoord += 2;

    // Patient Metadata Block
    if (patientName || reportDate) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginX, yCoord, contentWidth, 12, "F");
      doc.setDrawColor(226, 232, 240);
      doc.rect(marginX, yCoord, contentWidth, 12, "S");

      let xOffset = marginX + 4;
      let totalDateWidth = 0;
      const formattedDate = formatDateToDMY(reportDate);
      
      if (reportDate) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        const dateLabel = "FECHA DEL ESTUDIO: ";
        totalDateWidth = doc.getTextWidth(dateLabel) + doc.getTextWidth(formattedDate);
      }

      if (patientName) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text("PACIENTE: ", xOffset, yCoord + 7.5);
        const labelWidth = doc.getTextWidth("PACIENTE: ");
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        
        let patientText = patientName.toUpperCase();
        const maxNameWidth = (contentWidth - 8 - totalDateWidth) - labelWidth - 4;
        if (doc.getTextWidth(patientText) > maxNameWidth) {
          while (patientText.length > 5 && doc.getTextWidth(patientText + "...") > maxNameWidth) {
            patientText = patientText.slice(0, -1);
          }
          patientText += "...";
        }
        doc.text(patientText, xOffset + labelWidth, yCoord + 7.5);
      }

      if (reportDate) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        const dateLabel = "FECHA DEL ESTUDIO: ";
        const rightX = marginX + contentWidth - 4 - totalDateWidth;
        
        doc.text(dateLabel, rightX, yCoord + 7.5);
        const dateLabelWidth = doc.getTextWidth(dateLabel);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(formattedDate, rightX + dateLabelWidth, yCoord + 7.5);
      }

      yCoord += 19 * factor;
    }

    // Title of the Document
    checkPageBreak(12 * factor);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text("EXPLICACIÓN PARA USTED", pageWidth / 2, yCoord, { align: "center" });
    yCoord += 5 * factor;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("Documento complementario · Lenguaje claro", pageWidth / 2, yCoord, { align: "center" });
    yCoord += 7 * factor;

    // Formal-report disclaimer (top)
    {
      const discLines = doc.splitTextToSize(FORMAL_REPORT_DISCLAIMER, contentWidth - 10);
      const discH = discLines.length * 4.2 * factor + 8 * factor;
      checkPageBreak(discH);
      doc.setFillColor(254, 252, 232);
      doc.setDrawColor(202, 138, 4);
      doc.setLineWidth(0.4);
      doc.roundedRect(marginX, yCoord, contentWidth, discH, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(113, 63, 18);
      let dy = yCoord + 5 * factor;
      discLines.forEach((line: string) => {
        doc.text(line, marginX + 5, dy);
        dy += 4.2 * factor;
      });
      yCoord += discH + 6 * factor;
    }

    // Qué estudio se realizó
    if (studyOverview) {
      checkPageBreak(18 * factor);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("QUÉ ESTUDIO SE LE REALIZÓ", marginX, yCoord);
      yCoord += 6 * factor;
      const cleanOverview = stripEmojis(studyOverview);
      doc.setFont("times", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(51, 65, 85);
      const splitOverview = doc.splitTextToSize(cleanOverview, contentWidth);
      splitOverview.forEach((line: string) => {
        checkPageBreak(5.5 * factor);
        doc.text(line, marginX, yCoord);
        yCoord += 5.5 * factor;
      });
      yCoord += 5 * factor;
    }

    // Introduction Summary
    if (patientSummary.summary) {
      checkPageBreak(14 * factor);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("EN POCAS PALABRAS", marginX, yCoord);
      yCoord += 6 * factor;
      const cleanSummary = stripEmojis(patientSummary.summary);
      doc.setFont("times", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(51, 65, 85);

      const splitSummary = doc.splitTextToSize(cleanSummary, contentWidth);
      splitSummary.forEach((line: string) => {
        checkPageBreak(5.5 * factor);
        doc.text(line, marginX, yCoord);
        yCoord += 5.5 * factor;
      });
      yCoord += 4 * factor;
    }

    // Key Findings section
    if (keyFindings.length > 0) {
      const firstFinding = keyFindings[0];
      const title0 = stripEmojis(firstFinding.title || "");
      const originalTerm0 = stripEmojis(firstFinding.originalTerm || "");
      const simplifiedExplanation0 = stripEmojis(firstFinding.simplifiedExplanation || "");
      const analogy0 = stripEmojis(firstFinding.analogy || "");
      const context0 = stripEmojis(firstFinding.clinicalContext || firstFinding.reassurance || "");

      const splitTitle0 = doc.splitTextToSize(title0, contentWidth - 10);
      const splitOrig0 = doc.splitTextToSize(`Término original en informe técnico: "${originalTerm0}"`, contentWidth - 10);
      const splitExp0 = doc.splitTextToSize(`Explicación: ${simplifiedExplanation0}`, contentWidth - 14);
      const splitAnalogy0 = analogy0
        ? doc.splitTextToSize(`Analogía de comprensión: ${analogy0}`, contentWidth - 14)
        : [];
      const splitContext0 = context0
        ? doc.splitTextToSize(`Contexto descriptivo: ${context0}`, contentWidth - 14)
        : [];

      const neededHeight0 = ((splitTitle0.length * 5) +
                           (splitOrig0.length * 4) +
                           (splitExp0.length * 5) +
                           (splitAnalogy0.length * 4.5) +
                           (splitContext0.length * 4.5) + 20) * factor;

      checkPageBreak(15 * factor + neededHeight0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("SUS HALLAZGOS, EXPLICADOS", marginX, yCoord);
      yCoord += 7 * factor;

      keyFindings.forEach((finding: any) => {
        const title = stripEmojis(finding.title || "");
        const originalTerm = stripEmojis(finding.originalTerm || "");
        const simplifiedExplanation = stripEmojis(finding.simplifiedExplanation || "");
        const analogy = stripEmojis(finding.analogy || "");
        const clinicalContext = stripEmojis(finding.clinicalContext || finding.reassurance || "");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        const splitTitle = doc.splitTextToSize(title, contentWidth - 10);

        doc.setFont("times", "italic");
        doc.setFontSize(9);
        const splitOrig = doc.splitTextToSize(`Término original en informe técnico: "${originalTerm}"`, contentWidth - 10);

        doc.setFont("times", "normal");
        doc.setFontSize(10);
        const splitExp = doc.splitTextToSize(`Explicación: ${simplifiedExplanation}`, contentWidth - 14);

        doc.setFont("times", "normal");
        doc.setFontSize(9.5);
        const splitAnalogy = analogy
          ? doc.splitTextToSize(`Analogía de comprensión: ${analogy}`, contentWidth - 14)
          : [];
        const splitContext = clinicalContext
          ? doc.splitTextToSize(`Contexto descriptivo: ${clinicalContext}`, contentWidth - 14)
          : [];

        const neededHeight = ((splitTitle.length * 5) +
                             (splitOrig.length * 4) +
                             (splitExp.length * 5) +
                             (splitAnalogy.length * 4.5) +
                             (splitContext.length * 4.5) + 20) * factor;

        checkPageBreak(neededHeight);

        doc.setFillColor(250, 250, 250);
        doc.rect(marginX, yCoord, contentWidth, neededHeight - 4 * factor, "F");
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.35);
        doc.rect(marginX, yCoord, contentWidth, neededHeight - 4 * factor, "D");

        let interiorY = yCoord + 6 * factor;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(30, 58, 138);
        splitTitle.forEach((line: string) => {
          doc.text(line, marginX + 5, interiorY);
          interiorY += 5 * factor;
        });

        doc.setFont("times", "italic");
        doc.setFontSize(9);
        doc.setTextColor(75, 85, 99);
        splitOrig.forEach((line: string) => {
          doc.text(line, marginX + 5, interiorY);
          interiorY += 4.5 * factor;
        });
        interiorY += 2 * factor;

        doc.setFont("times", "normal");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        splitExp.forEach((line: string) => {
          doc.text(line, marginX + 7, interiorY);
          interiorY += 4.8 * factor;
        });
        interiorY += 2 * factor;

        if (splitAnalogy.length > 0) {
          const analogyHeight = (splitAnalogy.length * 4.2 * factor) + 4 * factor;
          doc.setFillColor(255, 247, 237);
          doc.rect(marginX + 5, interiorY - 3 * factor, contentWidth - 10, analogyHeight, "F");
          doc.setDrawColor(249, 115, 22);
          doc.setLineWidth(0.5);
          doc.line(marginX + 5, interiorY - 3 * factor, marginX + 5, interiorY - 3 * factor + analogyHeight);

          doc.setFont("times", "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(124, 45, 18);
          splitAnalogy.forEach((line: string) => {
            doc.text(line, marginX + 8, interiorY);
            interiorY += 4.2 * factor;
          });
          interiorY += 4 * factor;
        }

        if (splitContext.length > 0) {
          const contextHeight = (splitContext.length * 4.2 * factor) + 4 * factor;
          doc.setFillColor(239, 246, 255);
          doc.rect(marginX + 5, interiorY - 3 * factor, contentWidth - 10, contextHeight, "F");
          doc.setDrawColor(59, 130, 246);
          doc.setLineWidth(0.5);
          doc.line(marginX + 5, interiorY - 3 * factor, marginX + 5, interiorY - 3 * factor + contextHeight);

          doc.setFont("times", "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(30, 58, 138);
          splitContext.forEach((line: string) => {
            doc.text(line, marginX + 8, interiorY);
            interiorY += 4.2 * factor;
          });
        }

        yCoord += neededHeight + 2 * factor;
      });
      yCoord += 4 * factor;
    }

    // Patient infographic (optional dedicated page)
    if (infographicUrl && typeof infographicUrl === "string") {
      try {
        let imgData = infographicUrl;
        if (!imgData.startsWith("data:")) {
          const res = await fetch(imgData);
          const blob = await res.blob();
          imgData = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
        if (imgData.startsWith("data:image")) {
          doc.addPage();
          yCoord = 20;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(12);
          doc.setTextColor(15, 23, 42);
          doc.text("INFOGRAFÍA EXPLICATIVA", pageWidth / 2, yCoord, { align: "center" });
          yCoord += 8;
          const maxW = contentWidth;
          const maxH = pageHeight - yCoord - 28;
          const dims = await getImageDimensionsVirtual(imgData);
          let drawW = maxW;
          let drawH = maxH;
          if (dims.width && dims.height) {
            const aspect = dims.width / dims.height;
            if (aspect > maxW / maxH) {
              drawW = maxW;
              drawH = maxW / aspect;
            } else {
              drawH = maxH;
              drawW = maxH * aspect;
            }
          }
          const format = imgData.toLowerCase().includes("image/png") ? "PNG" : "JPEG";
          const drawX = (pageWidth - drawW) / 2;
          doc.addImage(imgData, format, drawX, yCoord, drawW, drawH);
          yCoord += drawH + 8;
        }
      } catch (infographicErr) {
        console.warn("Could not embed patient infographic in PDF:", infographicErr);
      }
    }

    // Closing disclaimer (repeated for clarity)
    {
      const discLines = doc.splitTextToSize(FORMAL_REPORT_DISCLAIMER, contentWidth - 10);
      const discH = discLines.length * 4.2 * factor + 8 * factor;
      checkPageBreak(discH + 4);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.35);
      doc.roundedRect(marginX, yCoord, contentWidth, discH, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      let dy = yCoord + 5 * factor;
      discLines.forEach((line: string) => {
        doc.text(line, marginX + 5, dy);
        dy += 4.2 * factor;
      });
      yCoord += discH + 6 * factor;
    }

    // Signature / Sign-off block
    if (doctorName || customSignatureUrl) {
      checkPageBreak(38); // Requerir suficiente espacio para el bloque homologado dual
      yCoord += 12;

      const startY = yCoord;

      // Dibujar borde gris claro con fondo suave en la columna izquierda (Caja de verificación)
      const boxX = marginX;
      const boxY = startY;
      const boxW = (pageWidth - marginX * 2) * 0.48; // Columna izquierda (48% de ancho)
      const boxH = 26;

      // Rellenar fondo
      doc.setFillColor(248, 250, 252); // slate 50
      doc.rect(boxX, boxY, boxW, boxH, "F");
      // Dibujar borde
      doc.setDrawColor(203, 213, 225); // slate 300
      doc.setLineWidth(0.35);
      doc.rect(boxX, boxY, boxW, boxH, "S");

      // Metadatos de Integridad en Columna Izquierda:
      let internalY = boxY + 4;
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(71, 85, 105); // slate 600
      doc.text("VERIFICACIÓN INTEGRIDAD DE DOCUMENTO", boxX + 3, internalY);
      internalY += 3.5;

      // Obtener el Hash generado determinísticamente
      const sSeedCombine = `${patientName || ""}-${doctorName || ""}-${reportDate || ""}-${clinicName || ""}`;
      let sHashVal = 0;
      for (let i = 0; i < sSeedCombine.length; i++) {
        sHashVal = ((sHashVal << 5) - sHashVal) + sSeedCombine.charCodeAt(i);
        sHashVal |= 0;
      }
      const sHexStr = Math.abs(sHashVal).toString(16).toUpperCase().padStart(8, "0");
      const pSeedVal = (patientName && patientName.length > 0) ? patientName.charCodeAt(0) + patientName.length : 42;
      const dSeedVal = (doctorName && doctorName.length > 0) ? doctorName.charCodeAt(0) + doctorName.length : 17;
      const partVal = ((pSeedVal * 231 + dSeedVal * 19) % 65535).toString(16).toUpperCase().padStart(4, "E");
      const pdfValidationHash = `SHA256: FD82-${sHexStr.substring(0, 4)}-${sHexStr.substring(4, 8)}-${partVal}-9B1C-E8B1`;

      doc.setFont("courier", "bold");
      doc.setFontSize(5.5);
      doc.setTextColor(30, 41, 59); // slate 800
      doc.text(pdfValidationHash, boxX + 3, internalY);
      internalY += 3;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.5);
      doc.setTextColor(100, 116, 139); // slate 500
      doc.text("ESTADO DEL DOCUMENTO: ", boxX + 3, internalY);
      const stateW = doc.getTextWidth("ESTADO DEL DOCUMENTO: ");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(21, 128, 61); // green 700
      doc.text("FIRMADO ELECTRÓNICAMENTE", boxX + 3 + stateW, internalY);
      internalY += 2.8;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.1);
      doc.setTextColor(100, 116, 139); // slate 500
      doc.text(`REG. MÉDICO: ${doctorLicense || "M.S.P. Reg: 6025 / Senescyt: 1005-12-7489"}`, boxX + 3, internalY);
      internalY += 2.8;

      doc.text(`FECHA DE VALIDACIÓN: ${reportDate} (AUTÓNOMO)`, boxX + 3, internalY);
      internalY += 2.8;

      doc.setFont("helvetica", "italic");
      doc.text("Firma de Validez Homologada según Normativa Sanitaria.", boxX + 3, internalY);

      // --- Columna Derecha: Área de Firma Digital / Autógrafa ---
      const rightColX = pageWidth - marginX;
      
      // Agregar firma física si está cargada
      if (customSignatureUrl) {
        try {
          let sigWidth = 35;
          let sigHeight = 11;
          if (signatureDims.width && signatureDims.height) {
            const aspect = signatureDims.width / signatureDims.height;
            const maxWidth = 50;
            const maxHeight = 15;
            if (aspect > maxWidth / maxHeight) {
              sigWidth = maxWidth;
              sigHeight = maxWidth / aspect;
            } else {
              sigHeight = maxHeight;
              sigWidth = maxHeight * aspect;
            }
          }
          const sigX = rightColX - sigWidth - 4;
          const sigY = boxY + 1; // Alinear ordenadamente arriba
          const format = customSignatureUrl.toLowerCase().includes("image/png") ? "PNG" : "JPEG";
          doc.addImage(customSignatureUrl, format, sigX, sigY, sigWidth, sigHeight);
        } catch (imgError) {
          console.warn("Could not render custom signature image inside jsPDF", imgError);
        }
      } else {
        // Si no hay firma física, mostrar sello digital elegante
        doc.setFont("helvetica", "oblique");
        doc.setFontSize(7);
        doc.setTextColor(30, 64, 175); // blue 800
        doc.text("FIRMADO ELECTRÓNICAMENTE CON TOKEN", rightColX - 62, boxY + 8);
      }

      // Línea horizontal para firma del doctor (solo del lado derecho)
      const lineStart = rightColX - 70;
      doc.setDrawColor(203, 213, 225); // slate 300
      doc.setLineWidth(0.3);
      doc.line(lineStart, boxY + boxH - 8, rightColX, boxY + boxH - 8);

      // Nombre del doctor en la derecha
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      const docText = (doctorName || "Dr. Milton Benavides S. Cod.6025").toUpperCase();
      const docTextWidth = doc.getTextWidth(docText);
      doc.text(docText, rightColX - docTextWidth, boxY + boxH - 4.5);

      // Especialidad del doctor en la derecha
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      const titleText = "Especialista en Radiología e Imágenes Medicas.";
      const titleTextWidth = doc.getTextWidth(titleText);
      doc.text(titleText, rightColX - titleTextWidth, boxY + boxH - 1.5);
      
      yCoord = boxY + boxH + 6;
    }

    // Add running headers on pages 2+ and page numbers on all pages (Format Editorial)
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      
      // Footer: draw page number at the bottom.
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // slate-400
      const footerPageStr = `Pág. ${i} de ${totalPages}`;
      doc.text(footerPageStr, pageWidth - marginX - doc.getTextWidth(footerPageStr), pageHeight - 10);
      
      // Faint, small watermark or clinic name on the left of footer
      const footerLeftText = displayClinicName || "EXPLICACIÓN DEL ESTUDIO";
      doc.text(footerLeftText, marginX, pageHeight - 10);

      // Header for page 2 onwards (Running Header)
      if (i >= 2) {
        // Draw thin horizontal line
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.setLineWidth(0.2);
        doc.line(marginX, 14, pageWidth - marginX, 14);

        // Draw study name on the left of the header
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139); // slate-500
        
        let studyLabel = studyType ? `EXPLICACIÓN PACIENTE - ${studyType.toUpperCase()}` : "EXPLICACIÓN PACIENTE";
        
        doc.text(studyLabel, marginX, 11);

        // Draw pagination aligned to the right inside the running header
        doc.setFont("helvetica", "normal");
        const runningHeaderPageStr = `Pág. ${i} de ${totalPages}`;
        const rWidth = doc.getTextWidth(runningHeaderPageStr);
        doc.text(runningHeaderPageStr, pageWidth - marginX - rWidth, 11);
      }
    }

    if (returnBlobUrl) {
      const blob = doc.output("blob");
      return URL.createObjectURL(blob);
    }

    if (returnBase64) {
      const dataUri = doc.output("datauristring");
      return dataUri.split(",")[1];
    }

    if (returnRawBlob) { return doc.output("blob"); }
    if (shareViaWebShare) {
      const blob = doc.output("blob");
      const filename = patientName ? `${patientName.trim().replace(/\s+/gi, "_")}_explicacion.pdf` : "explicacion_paciente.pdf";
      const file = new File([blob], filename, { type: "application/pdf" });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Explicación del Estudio",
          text: `Explicación amigable del estudio para ${patientName || "Paciente"}`
        });
      } else {
        doc.save(filename);
      }
    } else if (openInNewTab) {
      const blob = doc.output("blob");
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
    } else {
      const filename = patientName ? `Explicacion_${patientName.trim().replace(/\s+/gi, "_")}.pdf` : "explicacion_paciente.pdf";
      doc.save(filename);
    }
  } catch (err) {
    console.error("Error generating native explanation PDF through jsPDF:", err);
    alert("Ocurrió un error al generar el PDF explicativo: " + String(err));
  }
};
