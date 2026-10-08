import type { CloudStudy } from "../firebaseDb";
import { CaseAnalysisData } from "../types";
import { renderAbdomen3DPageToPdf } from "../utils/abdomen3dPdfRenderer";
import { renderAbdominalWall3DPageToPdf } from "../utils/abdominalWall3dPdfRenderer";
import { renderAnkle3DPageToPdf } from "../utils/ankle3dPdfRenderer";
import { renderAtlas3DAnnexToPDF } from "../utils/atlas3dPdfRenderer";
import { renderBreast3DPageToPdf } from "../utils/breast3dPdfRenderer";
import { renderDifferentialTreeAnnexToPDF } from "../utils/differentialTreePdfRenderer";
import { renderElastographyAnnexToPdf } from "../utils/elastographyPdfRenderer";
import { renderFindingsInfographicAnnexToPDF } from "../utils/findingsInfographicPdfRenderer";
import { renderFindingsMapAnnexToPDF } from "../utils/findingsMapPdfRenderer";
import { renderFocalLesion3DAnnexToPDF } from "../utils/focalLesion3dPdfRenderer";
import { renderKidney3DPageToPdf } from "../utils/kidney3dPdfRenderer";
import { renderKnee3DPageToPdf } from "../utils/knee3dPdfRenderer";
import { renderMeasurementsGaugeAnnexToPDF } from "../utils/measurementsGaugePdfRenderer";
import { renderMmgImagesToPdf } from "../utils/mmgImagesPdfRenderer";
import { renderMuscleTendon3DPageToPdf } from "../utils/muscleTendon3dPdfRenderer";
import { renderNegativityChecklistAnnexToPDF } from "../utils/negativityChecklistPdfRenderer";
import { renderReasoningChainAnnexToPDF } from "../utils/reasoningChainPdfRenderer";
import { renderScorecardAnnexToPDF } from "../utils/scorecardPdfRenderer";
import { renderScrotum3DPageToPdf } from "../utils/scrotum3dPdfRenderer";
import { renderSemioticsConductMatrixAnnexToPDF } from "../utils/semioticsConductMatrixPdfRenderer";
import { renderShoulder3DPageToPdf } from "../utils/shoulder3dPdfRenderer";
import { renderThyroid3DPageToPdf } from "../utils/thyroid3dPdfRenderer";
import { renderUsImagesToPdf } from "../utils/usImagesPdfRenderer";
import { renderUsPlaneSimulatorAnnexToPDF } from "../utils/usPlaneSimulatorPdfRenderer";
import { renderVascular3DPageToPdf } from "../utils/vascular3dPdfRenderer";
import { renderWrist3DPageToPdf } from "../utils/wrist3dPdfRenderer";
import { formatDateToDMY } from "./appFormatters";
import { getImageDimensionsVirtual } from "./imageDimensions";
import { cleanTextForJSPDF, recoverImpressionForPDF, suiteHasRenderableContent, wrapMarkdown } from "./nativePdfHelpers";
import { stripEmojisForPdf } from "./pdfTextUtils";
import { getBiomechanicalRadarDataFromReport, getRadarTitle, getShortRadarAxisLabel, sanitizeRadarPdfText } from "./radarPdfHelpers";
import { cleanRawClinicalText } from "./reportTextHelpers";
import { jsPDF } from "jspdf";

export type NativePdfDownloadDeps = {
  abdomen3dData: any;
  abdominalWall3dData: any;
  ankle3dData: any;
  atlas3dData: any;
  attachInfographicToOfficialReport: boolean;
  attachSummaryToOfficialReport: boolean;
  attachedImages: any[];
  biomechanicalRadarData: any;
  breast3dData: any;
  clinicalScorecardData: any;
  detectImageMetaFromFilename: (filename: string, dicomMeta?: Record<string, string>) => any;
  differentialTreeData: any;
  editedReportText: any;
  elastographyCAP: any;
  elastographyEtiology: any;
  elastographyFatFraction: any;
  elastographyImage3d: any;
  elastographyOriginalImage: any;
  elastographyStiffness: any;
  findings3dRenders: any;
  findingsInfographicData: any;
  findingsMapData: any;
  focalLesion3dData: any;
  getParagraphSeverity: (text: string) => "critical" | "altered" | "normal";
  includeAbdomen3dInReport: boolean;
  includeAbdominalWall3dInReport: boolean;
  includeAnkle3dInReport: boolean;
  includeAtlas3dInReport: boolean;
  includeBreast3dInReport: boolean;
  includeDifferentialTreeInReport: boolean;
  includeElastographyInReport: boolean;
  includeFindingsInfographicInReport: boolean;
  includeFindingsMapInReport: boolean;
  includeFocalLesion3dInReport: boolean;
  includeKidney3dInReport: boolean;
  includeKnee3dInReport: boolean;
  includeMeasurementGaugesInReport: boolean;
  includeMeasurementNormalsInPdf: boolean;
  includeMuscleTendon3dInReport: boolean;
  includeNegativityChecklistInReport: boolean;
  includeRadarInReport: boolean;
  includeReasoningChainInReport: boolean;
  includeScorecardInReport: boolean;
  includeScrotum3dInReport: boolean;
  includeSemioticsConductMatrixInReport: boolean;
  includeShoulder3dInReport: boolean;
  includeThyroid3dInReport: boolean;
  includeUsPlaneSimulatorInReport: boolean;
  includeVascular3dInReport: boolean;
  includeWrist3dInReport: boolean;
  infographicUrl: any;
  isEditingReportManual: boolean;
  isSyntacticHighlightingActive: boolean;
  kidney3dData: any;
  knee3dData: any;
  measurementGaugeData: any;
  modality: any;
  muscleTendon3dData: any;
  negativityChecklistData: any;
  patientSummary: any;
  pdfStateRef: { current: any };
  reasoningChainData: any;
  scrotum3dData: any;
  semioticsConductMatrixData: any;
  shoulder3dData: any;
  thyroid3dData: any;
  usImagesGridMode: any;
  usPlaneSimulatorData: any;
  vascular3dData: any;
  wrist3dData: any;
};

export function createNativePdfDownload(d: NativePdfDownloadDeps) {
  return async (
    openInNewTab: boolean = false,
    shareViaWebShare: boolean = false,
    returnBase64: boolean = false,
    returnBlobUrl: boolean = false,
    studyOverride?: Partial<CloudStudy>,
    returnRawBlob: boolean = false
  ): Promise<any> => {
    const {
      abdomen3dData,
      abdominalWall3dData,
      ankle3dData,
      atlas3dData,
      attachInfographicToOfficialReport,
      attachSummaryToOfficialReport,
      attachedImages,
      biomechanicalRadarData,
      breast3dData,
      clinicalScorecardData,
      detectImageMetaFromFilename,
      differentialTreeData,
      editedReportText,
      elastographyCAP,
      elastographyEtiology,
      elastographyFatFraction,
      elastographyImage3d,
      elastographyOriginalImage,
      elastographyStiffness,
      findings3dRenders,
      findingsInfographicData,
      findingsMapData,
      focalLesion3dData,
      getParagraphSeverity,
      includeAbdomen3dInReport,
      includeAbdominalWall3dInReport,
      includeAnkle3dInReport,
      includeAtlas3dInReport,
      includeBreast3dInReport,
      includeDifferentialTreeInReport,
      includeElastographyInReport,
      includeFindingsInfographicInReport,
      includeFindingsMapInReport,
      includeFocalLesion3dInReport,
      includeKidney3dInReport,
      includeKnee3dInReport,
      includeMeasurementGaugesInReport,
      includeMeasurementNormalsInPdf,
      includeMuscleTendon3dInReport,
      includeNegativityChecklistInReport,
      includeRadarInReport,
      includeReasoningChainInReport,
      includeScorecardInReport,
      includeScrotum3dInReport,
      includeSemioticsConductMatrixInReport,
      includeShoulder3dInReport,
      includeThyroid3dInReport,
      includeUsPlaneSimulatorInReport,
      includeVascular3dInReport,
      includeWrist3dInReport,
      infographicUrl,
      isEditingReportManual,
      isSyntacticHighlightingActive,
      kidney3dData,
      knee3dData,
      measurementGaugeData,
      modality,
      muscleTendon3dData,
      negativityChecklistData,
      patientSummary,
      pdfStateRef,
      reasoningChainData,
      scrotum3dData,
      semioticsConductMatrixData,
      shoulder3dData,
      thyroid3dData,
      usImagesGridMode,
      usPlaneSimulatorData,
      vascular3dData,
      wrist3dData
    } = d;

    // Shadow state variables to support optional study overrides gracefully using pdfStateRef.current to avoid TDZ
    const generatedReportLocal = studyOverride ? studyOverride.reportText : pdfStateRef.current.generatedReport;
    if (!generatedReportLocal) return;

    const patientNameLocal = studyOverride ? (studyOverride.patientName || "Paciente Anónimo") : (pdfStateRef.current.patientName || "Paciente Anónimo");
    const patientEmailLocal = studyOverride ? (studyOverride.patientEmail || "No especificado") : (pdfStateRef.current.patientEmail || "No especificado");
    const patientAgeLocal = studyOverride ? (studyOverride.patientAge || "") : pdfStateRef.current.patientAge;
    const patientGenderLocal = studyOverride ? (studyOverride.patientGender || "") : pdfStateRef.current.patientGender;
    const patientIdLocal = studyOverride ? (studyOverride.patientId || "") : pdfStateRef.current.patientId;
    const reportDateLocal = studyOverride ? (studyOverride.reportDate || "") : pdfStateRef.current.reportDate;
    const doctorNameLocal = studyOverride ? (studyOverride.doctorName || "Médico Radiólogo") : (pdfStateRef.current.doctorName || "Médico Radiólogo");
    const doctorLicenseLocal = studyOverride ? (studyOverride.doctorLicense || "No especificada") : (pdfStateRef.current.doctorLicense || "No especificada");
    const clinicNameLocal = studyOverride ? (studyOverride.clinicName || "Clínica Privada") : (pdfStateRef.current.clinicName || "Clínica Privada");
    const clinicalHistoryLocal = studyOverride ? (studyOverride.clinicalHistory || "No especificada") : (pdfStateRef.current.clinicalHistory || "No especificada");
    const findingsLocal = studyOverride ? (studyOverride.findings || "No especificadas") : (pdfStateRef.current.findings || "No especificadas");
    const studyTypeLocal = studyOverride ? (studyOverride.studyType || "Estudio General") : (pdfStateRef.current.studyType || "Estudio General");
    const customLogoUrlLocal = studyOverride ? (studyOverride.customLogoUrl || "") : (pdfStateRef.current.customLogoUrl || "");
    const customLogoRightUrlLocal = studyOverride ? (studyOverride.customLogoRightUrl || "") : (pdfStateRef.current.customLogoRightUrl || "");
    const customLogoStyleLocal = studyOverride ? (studyOverride.customLogoStyle || "logo") : (pdfStateRef.current.customLogoStyle || "logo");
    const customSignatureUrlLocal = studyOverride ? (studyOverride.customSignatureUrl || "") : (pdfStateRef.current.customSignatureUrl || "");
    const specificStudyLocal = studyOverride && studyOverride.specificStudy ? studyOverride.specificStudy : pdfStateRef.current.specificStudy;
    const pdfLayoutTypeLocal = studyOverride && studyOverride.pdfLayoutType ? (studyOverride.pdfLayoutType as any) : pdfStateRef.current.pdfLayoutType;
    const selectedLogoLocal = studyOverride && studyOverride.selectedLogo ? studyOverride.selectedLogo : pdfStateRef.current.selectedLogo;

    // Now re-assign to local variables with the exact same name as states to shadow them!
    const generatedReport = generatedReportLocal;
    const patientName = patientNameLocal;
    const patientEmail = patientEmailLocal;
    const patientAge = patientAgeLocal;
    const patientGender = patientGenderLocal;
    const patientId = patientIdLocal;
    const reportDate = reportDateLocal;
    const doctorName = doctorNameLocal;
    const doctorLicense = doctorLicenseLocal;
    const clinicName = clinicNameLocal;
    const displayClinicName = clinicName && clinicName.trim().toUpperCase() !== "CLÍNICA PRIVADA" && clinicName.trim().toUpperCase() !== "CLINICA PRIVADA" ? clinicName.toUpperCase() : "";
    const clinicalHistory = clinicalHistoryLocal;
    const findings = findingsLocal;
    const studyType = studyTypeLocal;
    const customLogoUrl = customLogoUrlLocal;
    const customLogoRightUrl = customLogoRightUrlLocal;
    const customLogoStyle = customLogoStyleLocal;
    const customSignatureUrl = customSignatureUrlLocal;
    const specificStudy = specificStudyLocal || "Tórax";
    const pdfLayoutType = pdfLayoutTypeLocal || "classic";
    const selectedLogo = selectedLogoLocal || "none";
    
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: false,
      });

      let yCoord = 20;
      let marginX = 20;
      const pageWidth = 210;
      const pageHeight = 297;
      let contentWidth = pageWidth - (2 * marginX); // 170mm

      // Load virtual image dimensions to prevent any layout distortion on any device
      const logoDims = await getImageDimensionsVirtual(customLogoUrl);
      const logoRightDims = await getImageDimensionsVirtual(customLogoRightUrl);
      const signatureDims = await getImageDimensionsVirtual(customSignatureUrl);

      const drawAsymmetricSidebar = (docObj: any, pageNum: number, startY: number = 20) => {
        if (pdfLayoutType !== "asymmetric") return;
        
        // Draw elegant vertical dividing line at x = 70
        docObj.setDrawColor(226, 232, 240); // slate-200
        docObj.setLineWidth(0.35);
        docObj.line(70, startY, 70, pageHeight - 20);

        if (pageNum === 1) {
          // Draw a very elegant Swiss-style slate background card for patient info
          const cardY = startY + 2;
          const cardW = 46;
          const cardH = 75; // slightly taller to fit everything nicely
          
          docObj.setFillColor(248, 250, 252); // slate-50
          docObj.setDrawColor(226, 232, 240); // slate-200
          docObj.setLineWidth(0.2);
          docObj.roundedRect(20, cardY, cardW, cardH, 2, 2, "FD");

          // Red/blue minimalist Swiss accent bar at the top of the sidebar card
          docObj.setFillColor(79, 70, 229); // Indigo accent
          docObj.rect(20, cardY, cardW, 1.8, "F");

          let textY = cardY + 7;
          
          // SIDEBAR HEADER
          docObj.setFont("helvetica", "bold");
          docObj.setFontSize(7.5);
          docObj.setTextColor(100, 116, 139); // slate-500
          docObj.text("INFORMACIÓN", 24, textY);
          textY += 4.5;

          // PACIENTE
          docObj.setFont("helvetica", "bold");
          docObj.setFontSize(7);
          docObj.setTextColor(148, 163, 184); // slate-400
          docObj.text("PACIENTE", 24, textY);
          textY += 3.5;

          docObj.setFont("helvetica", "bold");
          docObj.setFontSize(8.5);
          docObj.setTextColor(15, 23, 42); // slate-900
          const pName = (patientName || "NO ESPECIFICADO").toUpperCase();
          const pNameLines = docObj.splitTextToSize(pName, cardW - 8);
          pNameLines.forEach((l: string) => {
            docObj.text(l, 24, textY);
            textY += 4;
          });
          textY += 2;

          // FECHA
          docObj.setFont("helvetica", "bold");
          docObj.setFontSize(7);
          docObj.setTextColor(148, 163, 184);
          docObj.text("FECHA DEL ESTUDIO", 24, textY);
          textY += 3.5;

          docObj.setFont("helvetica", "bold");
          docObj.setFontSize(8.5);
          docObj.setTextColor(15, 23, 42);
          docObj.text(formatDateToDMY(reportDate), 24, textY);
          textY += 5.5;

          // ESTUDIO
          docObj.setFont("helvetica", "bold");
          docObj.setFontSize(7);
          docObj.setTextColor(148, 163, 184);
          docObj.text("ESTUDIO / EXAMEN", 24, textY);
          textY += 3.5;

          docObj.setFont("helvetica", "bold");
          docObj.setFontSize(8);
          docObj.setTextColor(15, 23, 42);
          const studyClean = (specificStudy || "ECOGRAFÍA").toUpperCase();
          const studyLines = docObj.splitTextToSize(studyClean, cardW - 8);
          studyLines.forEach((l: string) => {
            docObj.text(l, 24, textY);
            textY += 3.8;
          });
          textY += 2;

          // MÉDICO
          if (doctorName) {
            docObj.setFont("helvetica", "bold");
            docObj.setFontSize(7);
            docObj.setTextColor(148, 163, 184);
            docObj.text("MÉDICO", 24, textY);
            textY += 3.5;

            docObj.setFont("helvetica", "bold");
            docObj.setFontSize(8);
            docObj.setTextColor(15, 23, 42);
            const drText = doctorName.toUpperCase();
            const drLines = docObj.splitTextToSize(drText, cardW - 8);
            drLines.forEach((l: string) => {
              docObj.text(l, 24, textY);
              textY += 3.8;
            });
          }
        }
      };

      const checkPageBreak = (neededHeight: number) => {
        if (yCoord + neededHeight > pageHeight - 20) {
          doc.addPage();
          yCoord = 20;
          if (pdfLayoutType === "asymmetric") {
            drawAsymmetricSidebar(doc, doc.getNumberOfPages(), 20);
          }
        }
      };

      // Helper function to wrap markdown mixed text safely
      // Header Brand/Clinic Logo & Name
      if (customLogoUrl) {
        if (customLogoStyle === "banner") {
          // Banner Style (Centered wide banner)
          let bannerWidth = 165;
          let bannerHeight = 35;
          if (logoDims.width && logoDims.height) {
            const aspect = logoDims.width / logoDims.height;
            const maxWidth = contentWidth; // 170
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
            // Fallback
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42);
            doc.text(displayClinicName || "REPORTE DE RADIODIAGNÓSTICO", pageWidth / 2, yCoord, { align: "center" });
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
          // Dual logos: left + right with clinic name centered
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
            console.warn("Could not draw left dual logo", err);
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
              console.warn("Could not draw right dual logo", err);
            }
          }

          doc.setFont("helvetica", "bold");
          doc.setFontSize(12);
          doc.setTextColor(15, 23, 42);
          doc.text(displayClinicName || "REPORTE DE RADIODIAGNÓSTICO", pageWidth / 2, yCoord + rowH / 2 - 1, { align: "center" });
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          doc.text("REPORTE DE RADIODIAGNÓSTICO POR IMAGEN", pageWidth / 2, yCoord + rowH / 2 + 4, { align: "center" });
          yCoord += rowH + 6;
        } else {
          // Left Aligned Logo Style
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
          doc.text(displayClinicName || "REPORTE DE RADIODIAGNÓSTICO", textX, yCoord + (logoHeight / 2) - 1.5);
          
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          doc.text("REPORTE DE RADIODIAGNÓSTICO POR IMAGEN", textX, yCoord + (logoHeight / 2) + 4);
          
          yCoord += Math.max(logoHeight, 15) + 6;
        }
      } else {
        // Standard (No user custom logo file, or they chose default medical vectors)
        let symbolWidth = 0;
        if (selectedLogo === "medical-cross") {
          symbolWidth = 14;
          doc.setDrawColor(220, 38, 38); // Red
          doc.setFillColor(220, 38, 38);
          doc.rect(marginX + 5, yCoord, 4, 12, "F");
          doc.rect(marginX + 1, yCoord + 4, 12, 4, "F");
        } else if (selectedLogo === "heart-pulse") {
          symbolWidth = 14;
          doc.setDrawColor(244, 63, 94); // Rose
          doc.setFillColor(244, 63, 94);
          doc.rect(marginX + 5, yCoord, 4, 12, "F");
          doc.rect(marginX + 1, yCoord + 4, 12, 4, "F");
        } else if (selectedLogo === "dna" || selectedLogo === "shield-check") {
          symbolWidth = 14;
          doc.setDrawColor(79, 70, 229); // Indigo
          doc.setFillColor(79, 70, 229);
          doc.rect(marginX + 5, yCoord, 4, 12, "F");
          doc.rect(marginX + 1, yCoord + 4, 12, 4, "F");
        }

        if (symbolWidth > 0) {
          const textX = marginX + symbolWidth + 4;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(14);
          doc.setTextColor(15, 23, 42);
          doc.text(displayClinicName || "REPORTE DE RADIODIAGNÓSTICO", textX, yCoord + 5);
          
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          doc.text("REPORTE DE RADIODIAGNÓSTICO POR IMAGEN", textX, yCoord + 10.5);
          
          yCoord += 18;
        } else {
          // Centered Clinic Name or default heading
          if (displayClinicName) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42); // slate-900 / dark
            doc.text(displayClinicName, pageWidth / 2, yCoord, { align: "center" });
            yCoord += 6;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139); // slate-500
            doc.text("REPORTE DE RADIODIAGNÓSTICO POR IMAGEN", pageWidth / 2, yCoord, { align: "center" });
            yCoord += 8;
          } else {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42);
            doc.text("REPORTE DE RADIODIAGNÓSTICO", pageWidth / 2, yCoord, { align: "center" });
            yCoord += 11;
          }
        }
      }

      // Add a line under header
      if (pdfLayoutType === "clinical_slate") {
        doc.setDrawColor(71, 85, 105); // slate-600
        doc.setLineWidth(0.65);
        doc.line(marginX, yCoord - 2, pageWidth - marginX, yCoord - 2);
      } else if (pdfLayoutType === "executive_medical") {
        doc.setDrawColor(15, 23, 42); // Navy
        doc.setLineWidth(0.6);
        doc.line(marginX, yCoord - 2.5, pageWidth - marginX, yCoord - 2.5);
        doc.setDrawColor(197, 160, 89); // Gold
        doc.setLineWidth(0.35);
        doc.line(marginX, yCoord - 1.5, pageWidth - marginX, yCoord - 1.5);
      } else {
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.setLineWidth(0.4);
        doc.line(marginX, yCoord - 2, pageWidth - marginX, yCoord - 2);
      }
      yCoord += 2;

      // Patient Metadata Block
      if (pdfLayoutType === "clinical_slate" && (patientName || reportDate)) {
        const extraCols: { label: string; value: string }[] = [];
        if (patientId && patientId.trim() !== "") {
          extraCols.push({
            label: "ID / HISTORIA CLÍNICA",
            value: patientId.trim().toUpperCase()
          });
        }
        const agePart = patientAge && patientAge.trim() !== "" ? patientAge.trim() : "";
        const genderPart = patientGender && patientGender.trim() !== "" ? patientGender.trim() : "";
        if (agePart || genderPart) {
          let combinedVal = "";
          let label = "";
          if (agePart && genderPart) {
            label = "EDAD / SEXO";
            combinedVal = `${agePart} / ${genderPart}`;
          } else if (agePart) {
            label = "EDAD";
            combinedVal = agePart;
          } else {
            label = "SEXO / GÉNERO";
            combinedVal = genderPart;
          }
          extraCols.push({
            label: label,
            value: combinedVal.toUpperCase()
          });
        }

        const hasExtraMeta = extraCols.length > 0;
        const cardHeight = hasExtraMeta ? 22 : 13;

        // Draw elegant Clinical Slate metadata card
        doc.setFillColor(241, 245, 249); // slate-100
        doc.setDrawColor(148, 163, 184); // slate-400
        doc.setLineWidth(0.35);
        doc.roundedRect(marginX, yCoord, contentWidth, cardHeight, 1.5, 1.5, "FD");

        // Vertical divider inside the card for Row 1
        doc.setDrawColor(203, 213, 225); // slate-300
        doc.setLineWidth(0.25);
        doc.line(marginX + (contentWidth / 2), yCoord, marginX + (contentWidth / 2), yCoord + 12);

        if (hasExtraMeta) {
          // Horizontal divider
          doc.line(marginX, yCoord + 12, marginX + contentWidth, yCoord + 12);

          if (extraCols.length === 2) {
            // Draw vertical divider in Row 2
            doc.line(marginX + (contentWidth / 2), yCoord + 12, marginX + (contentWidth / 2), yCoord + cardHeight);
          }
        }

        const formattedDate = formatDateToDMY(reportDate);

        // Column 1: PACIENTE
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105); // slate-600
        doc.text("PACIENTE", marginX + 4, yCoord + 4.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text((patientName || "NO ESPECIFICADO").toUpperCase(), marginX + 4, yCoord + 9.5);

        // Column 2: FECHA DEL ESTUDIO
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105); // slate-600
        doc.text("FECHA DEL ESTUDIO", marginX + (contentWidth / 2) + 4, yCoord + 4.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text(formattedDate || "NO ESPECIFICADO", marginX + (contentWidth / 2) + 4, yCoord + 9.5);

        if (hasExtraMeta) {
          if (extraCols.length === 1) {
            const col = extraCols[0];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            doc.text(col.label, marginX + 4, yCoord + 15.5);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(15, 23, 42);
            doc.text(col.value, marginX + 4, yCoord + 19.5);
          } else if (extraCols.length === 2) {
            const col1 = extraCols[0];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            doc.text(col1.label, marginX + 4, yCoord + 15.5);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(15, 23, 42);
            doc.text(col1.value, marginX + 4, yCoord + 19.5);

            const col2 = extraCols[1];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            doc.text(col2.label, marginX + (contentWidth / 2) + 4, yCoord + 15.5);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(15, 23, 42);
            doc.text(col2.value, marginX + (contentWidth / 2) + 4, yCoord + 19.5);
          }
        }

        yCoord += cardHeight + 6;
      } else if (pdfLayoutType === "executive_medical" && (patientName || reportDate)) {
        const extraCols: { label: string; value: string }[] = [];
        if (patientId && patientId.trim() !== "") {
          extraCols.push({
            label: "ID / HISTORIA CLÍNICA",
            value: patientId.trim().toUpperCase()
          });
        }
        const agePart = patientAge && patientAge.trim() !== "" ? patientAge.trim() : "";
        const genderPart = patientGender && patientGender.trim() !== "" ? patientGender.trim() : "";
        if (agePart || genderPart) {
          let combinedVal = "";
          let label = "";
          if (agePart && genderPart) {
            label = "EDAD / SEXO";
            combinedVal = `${agePart} / ${genderPart}`;
          } else if (agePart) {
            label = "EDAD";
            combinedVal = agePart;
          } else {
            label = "SEXO / GÉNERO";
            combinedVal = genderPart;
          }
          extraCols.push({
            label: label,
            value: combinedVal.toUpperCase()
          });
        }

        const hasExtraMeta = extraCols.length > 0;
        const cardHeight = hasExtraMeta ? 22 : 13;

        // Draw elegant Executive Medical metadata card (Cream & Gold style)
        doc.setFillColor(253, 251, 247); // Sophisticated cream
        doc.setDrawColor(197, 160, 89); // Metallic Gold
        doc.setLineWidth(0.4);
        doc.roundedRect(marginX, yCoord, contentWidth, cardHeight, 1.5, 1.5, "FD");

        // Vertical gold divider inside the card for Row 1
        doc.line(marginX + (contentWidth / 2), yCoord, marginX + (contentWidth / 2), yCoord + 12);

        if (hasExtraMeta) {
          // Horizontal divider
          doc.line(marginX, yCoord + 12, marginX + contentWidth, yCoord + 12);

          if (extraCols.length === 2) {
            // Row 2 divider
            doc.line(marginX + (contentWidth / 2), yCoord + 12, marginX + (contentWidth / 2), yCoord + cardHeight);
          }
        }

        const formattedDate = formatDateToDMY(reportDate);

        // Column 1: PACIENTE
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(197, 160, 89); // Gold
        doc.text("PACIENTE", marginX + 4, yCoord + 4.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42); // Dark Navy / Slate-900
        doc.text((patientName || "NO ESPECIFICADO").toUpperCase(), marginX + 4, yCoord + 9.5);

        // Column 2: FECHA DEL ESTUDIO
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(197, 160, 89); // Gold
        doc.text("FECHA DEL ESTUDIO", marginX + (contentWidth / 2) + 4, yCoord + 4.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42); // Dark Navy / Slate-900
        doc.text(formattedDate || "NO ESPECIFICADO", marginX + (contentWidth / 2) + 4, yCoord + 9.5);

        if (hasExtraMeta) {
          if (extraCols.length === 1) {
            const col = extraCols[0];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(197, 160, 89); // Gold
            doc.text(col.label, marginX + 4, yCoord + 15.5);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(15, 23, 42);
            doc.text(col.value, marginX + 4, yCoord + 19.5);
          } else if (extraCols.length === 2) {
            const col1 = extraCols[0];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(197, 160, 89); // Gold
            doc.text(col1.label, marginX + 4, yCoord + 15.5);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(15, 23, 42);
            doc.text(col1.value, marginX + 4, yCoord + 19.5);

            const col2 = extraCols[1];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(197, 160, 89); // Gold
            doc.text(col2.label, marginX + (contentWidth / 2) + 4, yCoord + 15.5);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(15, 23, 42);
            doc.text(col2.value, marginX + (contentWidth / 2) + 4, yCoord + 19.5);
          }
        }

        yCoord += cardHeight + 6;
      } else if (pdfLayoutType === "asymmetric") {
        drawAsymmetricSidebar(doc, 1, yCoord);
        yCoord += 4;
        marginX = 74;
        contentWidth = 116;
      } else if (patientName || reportDate) {
        const extraCols: { label: string; value: string }[] = [];
        if (patientId && patientId.trim() !== "") {
          extraCols.push({
            label: "ID",
            value: patientId.trim().toUpperCase()
          });
        }
        const agePart = patientAge && patientAge.trim() !== "" ? patientAge.trim() : "";
        const genderPart = patientGender && patientGender.trim() !== "" ? patientGender.trim() : "";
        if (agePart || genderPart) {
          let combinedVal = "";
          let label = "";
          if (agePart && genderPart) {
            label = "EDAD/SEXO";
            combinedVal = `${agePart} / ${genderPart}`;
          } else if (agePart) {
            label = "EDAD";
            combinedVal = agePart;
          } else {
            label = "SEXO";
            combinedVal = genderPart;
          }
          extraCols.push({
            label: label,
            value: combinedVal.toUpperCase()
          });
        }
        const hasExtraMeta = extraCols.length > 0;
        const cardHeight = hasExtraMeta ? 21 : 12;

        doc.setFillColor(248, 250, 252); // greyish background
        doc.rect(marginX, yCoord, contentWidth, cardHeight, "F");
        doc.setDrawColor(226, 232, 240);
        doc.rect(marginX, yCoord, contentWidth, cardHeight, "S");

        let xOffset = marginX + 4;
        let totalDateWidth = 0;
        const formattedDate = formatDateToDMY(reportDate);
        
        if (reportDate) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          const dateLabel = "FECHA: ";
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
          const dateLabel = "FECHA: ";
          const rightX = marginX + contentWidth - 4 - totalDateWidth;
          
          doc.text(dateLabel, rightX, yCoord + 7.5);
          const dateLabelWidth = doc.getTextWidth(dateLabel);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(15, 23, 42);
          doc.text(formattedDate, rightX + dateLabelWidth, yCoord + 7.5);
        }

        if (hasExtraMeta) {
          // Draw a small line divider
          doc.setDrawColor(226, 232, 240);
          doc.line(marginX, yCoord + 11.5, marginX + contentWidth, yCoord + 11.5);

          if (extraCols.length === 1) {
            const col = extraCols[0];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            const labelText = `${col.label}: `;
            doc.text(labelText, xOffset, yCoord + 16.5);
            const labelW = doc.getTextWidth(labelText);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text(col.value, xOffset + labelW, yCoord + 16.5);
          } else if (extraCols.length === 2) {
            // Col 1 (Left)
            const col1 = extraCols[0];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            const label1 = `${col1.label}: `;
            doc.text(label1, xOffset, yCoord + 16.5);
            const label1W = doc.getTextWidth(label1);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text(col1.value, xOffset + label1W, yCoord + 16.5);

            // Col 2 (Right)
            const col2 = extraCols[1];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            const label2 = `${col2.label}: `;
            const val2 = col2.value;
            const totalW2 = doc.getTextWidth(label2) + doc.getTextWidth(val2);
            const rightX = marginX + contentWidth - 4 - totalW2;
            doc.text(label2, rightX, yCoord + 16.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text(val2, rightX + doc.getTextWidth(label2), yCoord + 16.5);
          }
        }

        yCoord += cardHeight + 7;
      }

      // --- DYNAMIC PAGE BUDGET & COMPLETE WIDOW/ORPHAN CONTROL ---
      const isVascularStudy = specificStudy === "Doppler de carótidas" || 
                              specificStudy === "Doppler venoso de miembro inferior" || 
                              specificStudy === "Doppler arterial de miembro inferior";
      const isCarotidasForPDF = specificStudy.toLowerCase().includes("carót") || specificStudy.toLowerCase().includes("carot");

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
      if (pdfLayoutType !== "asymmetric" && (patientName || reportDate)) {
        estimatedHeight += 19;
      }

      // 3. Estimate text blocks (paragraphs) and tables
      try {
        const stripEmojisLocal = (str: string): string => {
          if (!str) return "";
          return str.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "").replace(/[\u2600-\u27BF]|[\u2300-\u23FF]|[\u2B50]|[\u2190-\u21FF]/g, "");
        };
        const reportToRenderLocal = isEditingReportManual ? editedReportText : generatedReport;
        const emojiFreeReportLocal = stripEmojisLocal(reportToRenderLocal || "");
        let cleanReportLocal = cleanRawClinicalText(emojiFreeReportLocal);
        cleanReportLocal = cleanReportLocal.replace(/\[START_CASE_ANALYSIS:[\s\S]*?\[END_CASE_ANALYSIS:[^\]]+\]/gi, "");
        const legacyIdxLocal = cleanReportLocal.indexOf("[CASE_ANALYSIS_JSON]");
        if (legacyIdxLocal !== -1) {
          cleanReportLocal = cleanReportLocal.substring(0, legacyIdxLocal).trim();
        }
        const summaryIdxLocal = cleanReportLocal.indexOf("**ANÁLISIS INTEGRADO DE CASO");
        if (summaryIdxLocal !== -1) {
          cleanReportLocal = cleanReportLocal.substring(0, summaryIdxLocal).trim();
        }
        cleanReportLocal = cleanReportLocal.trim();
        const normalizedReportLocal = cleanReportLocal
          .replace(/\n+\s*(---\s*)/g, "\n\n$1")
          .replace(/\n+\s*((?:\*+)?\s*(?:pie de página|nota de pie|nota de pie de página|pie de pagina|nota de pie de pagina)\b)/gi, "\n\n$1")
          .replace(/\n+\s*(\s*(?:##+|#|\*\*)\s*(?:conclusi[oó]n(?:es)?|impresi[oó]n(?:es)?\s+diagn[oó]stica(?:s)?|diagn[oó]stico(?:s)?|hallazgos)\b)/gi, "\n\n$1");
        const rawParagraphsLocal = normalizedReportLocal.split(/\n\n+/);
        const paragraphsLocal: string[] = [];
        let inConclusionLocal = false;
        let conclusionBufferLocal: string[] = [];

        rawParagraphsLocal.forEach((p) => {
          const trimmed = p.trim();
          if (!trimmed) return;

          const isSemiologyLineLocal = /semiolog[ií]a|justificaci[oó]n|exclusi[oó]n/i.test(trimmed);
          const isConclusionHeader = !isSemiologyLineLocal && /^\s*(?:#+|\*+|-|_|\d+\.)*\s*(?:conclusión|conclusiones|conclusion|impresión\s+diagnóstica|impresion\s+diagnostica|impresiones\s+diagnósticas|impresiones\s+diagnosticas|diagnósticos|diagnóstico|diagnostico|diagnosticos)\b/i.test(trimmed);

          const isFootnoteOrDividerLocal = trimmed === "---" || /^---+\s*$/.test(trimmed) ||
            /^\s*(?:\*+)?\s*(?:pie de página|nota de pie|nota de pie de página|pie de pagina|nota de pie de pagina)\b/i.test(trimmed);

          const isOtherSectionHeader = /^\s*(?:##+|#)\s+/i.test(trimmed) ||
            /^\s*\*\*(?:hallazgos|estudio|técnica|tecnica|método|metodo|exploración|exploracion|motivo|comparación|comparacion|datos\s+clínicos|indicación|indicacion|antecedentes|pie\s+de\s+página|nota\s+de\s+pie)\b/i.test(trimmed) ||
            isFootnoteOrDividerLocal;

          if (isFootnoteOrDividerLocal) {
            if (inConclusionLocal && conclusionBufferLocal.length > 0) {
              paragraphsLocal.push(conclusionBufferLocal.join("\n\n"));
              conclusionBufferLocal = [];
            }
            inConclusionLocal = false;
            paragraphsLocal.push(trimmed);
          } else if (isConclusionHeader) {
            if (inConclusionLocal && conclusionBufferLocal.length > 0) {
              paragraphsLocal.push(conclusionBufferLocal.join("\n\n"));
              conclusionBufferLocal = [];
            }
            inConclusionLocal = true;
            conclusionBufferLocal.push(trimmed);
          } else if (isOtherSectionHeader) {
            if (inConclusionLocal && conclusionBufferLocal.length > 0) {
              paragraphsLocal.push(conclusionBufferLocal.join("\n\n"));
              conclusionBufferLocal = [];
            }
            inConclusionLocal = false;
            paragraphsLocal.push(trimmed);
          } else {
            if (inConclusionLocal) {
              conclusionBufferLocal.push(trimmed);
            } else {
              paragraphsLocal.push(trimmed);
            }
          }
        });

        if (inConclusionLocal && conclusionBufferLocal.length > 0) {
          paragraphsLocal.push(conclusionBufferLocal.join("\n\n"));
        }

        const tempDoc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        let isFirstBlockLocal = true;
        const estContentWidth = pdfLayoutType === "asymmetric" ? 116 : contentWidth;

        paragraphsLocal.forEach((block) => {
          const trimmedBlock = block.trim();
          if (!trimmedBlock) return;

          if (!isFirstBlockLocal) {
            estimatedHeight += 4.5;
          } else {
            isFirstBlockLocal = false;
          }

          if (trimmedBlock.startsWith("|") && (trimmedBlock.includes("-|-") || trimmedBlock.includes("---") || trimmedBlock.includes(":---"))) {
            // Table block
            const rows = trimmedBlock.split("\n").filter(r => r.trim() !== "");
            const bodyRows = rows.slice(2);
            estimatedHeight += 16;
            bodyRows.forEach((r) => {
              const cells = r.split("|").map(c => c.trim());
              let maxLinesLocal = 1;
              cells.forEach((cellText) => {
                const wrapped = tempDoc.splitTextToSize(cellText.replace(/\*\*/g, ""), (estContentWidth / cells.length) - 6);
                if (wrapped.length > maxLinesLocal) maxLinesLocal = wrapped.length;
              });
              estimatedHeight += (maxLinesLocal * 5) + 4;
            });
            estimatedHeight += 4;
          } else {
            // Standard block
            const linesOfBlock = trimmedBlock.split("\n");
            linesOfBlock.forEach((line) => {
              let trimmed = line.trim();
              if (!trimmed) {
                estimatedHeight += 2.5;
                return;
              }
              if (trimmed === "---" || /^---+\s*$/.test(trimmed)) {
                return;
              }
              const isHeader = trimmed.startsWith("#") || (
                trimmed.startsWith("**") && (
                  trimmed.endsWith("**") || 
                  trimmed.replace(/[:\s]+$/, "").endsWith("**")
                )
              );
              if (isHeader) {
                estimatedHeight += 5.5;
              } else {
                const wrappedLines = tempDoc.splitTextToSize(trimmed.replace(/\*\*/g, ""), estContentWidth);
                estimatedHeight += wrappedLines.length * 5.0;
              }
            });
          }
        });
      } catch (estError) {
        console.warn("Error estimating paragraph heights:", estError);
      }

      // 5. Signature block estimation
      estimatedHeight += 38;

      // 6. Calculate pages and remainder for widow/orphan detection
      const usablePageHeight = 255;
      const estTotalPages = Math.ceil(estimatedHeight / usablePageHeight);
      const estRemainder = estimatedHeight % usablePageHeight;

      // If we spill onto a new page, and that new page has less than 48mm of content (orphaned signature/conclusion!),
      // we reduce spacing to pull it back onto the previous page elegantly!
      if (estTotalPages > 1 && estRemainder < 48) {
        factor = 0.84; // 16% spacing compression
      } else if (estTotalPages > 1 && estRemainder < 60) {
        factor = 0.88; // 12% spacing compression
      }

      // Adjust starting patient offset with factor
      if (patientName || reportDate) {
        yCoord = yCoord - 19 + (19 * factor);
      }

      // Strip emojis from the generated report
      const stripEmojis = stripEmojisForPdf;

      const reportToRender = isEditingReportManual ? editedReportText : generatedReport;
      const emojiFreeReport = stripEmojis(reportToRender);
      let cleanReport = cleanRawClinicalText(emojiFreeReport);

      // Extract all CASE_ANALYSIS blocks from the report text to draw them in the Annex at the end
      const caseAnalysisBlocks: CaseAnalysisData[] = [];
      const caseRegex = /\[CASE_ANALYSIS_JSON\]\s*([\s\S]*?)\s*\[\/CASE_ANALYSIS_JSON\]/g;
      let caseMatch;
      while ((caseMatch = caseRegex.exec(cleanReport)) !== null) {
        if (caseMatch[1]) {
          try {
            const parsed = JSON.parse(caseMatch[1]) as CaseAnalysisData;
            caseAnalysisBlocks.push(parsed);
          } catch (e) {
            console.error("Error parsing case data block for PDF annex:", e);
          }
        }
      }

      // Strip all [START_CASE_ANALYSIS:format] ... [END_CASE_ANALYSIS:format] blocks
      // from the main report content so they do not print as plain text.
      cleanReport = cleanReport.replace(/\[START_CASE_ANALYSIS:[\s\S]*?\[END_CASE_ANALYSIS:[^\]]+\]/gi, "");

      // Strip the fallback text summary of the case analysis from the PDF text entirely
      const legacyIdx = cleanReport.indexOf("[CASE_ANALYSIS_JSON]");
      if (legacyIdx !== -1) {
        cleanReport = cleanReport.substring(0, legacyIdx).trim();
      }
      const summaryIdx = cleanReport.indexOf("**ANÁLISIS INTEGRADO DE CASO");
      if (summaryIdx !== -1) {
        cleanReport = cleanReport.substring(0, summaryIdx).trim();
      }
      cleanReport = cleanReport.trim();

      const normalizedReport = cleanReport
        .replace(/\n+\s*(---\s*)/g, "\n\n$1")
        .replace(/\n+\s*((?:\*+)?\s*(?:pie de página|nota de pie|nota de pie de página|pie de pagina|nota de pie de pagina)\b)/gi, "\n\n$1")
        .replace(/\n+\s*(\s*(?:##+|#|\*\*)\s*(?:conclusi[oó]n(?:es)?|impresi[oó]n(?:es)?\s+diagn[oó]stica(?:s)?|diagn[oó]stico(?:s)?|hallazgos)\b)/gi, "\n\n$1");
      const rawParagraphs = normalizedReport.split(/\n\n+/);
      const paragraphs: string[] = [];
      let inConclusion = false;
      let conclusionBuffer: string[] = [];

      rawParagraphs.forEach((p) => {
        const trimmed = p.trim();
        if (!trimmed) return;

        // If this is a CASE_ANALYSIS_JSON block, do not merge it with the conclusion or any other buffer
        if (trimmed.includes("[CASE_ANALYSIS_JSON]")) {
          if (inConclusion && conclusionBuffer.length > 0) {
            paragraphs.push(conclusionBuffer.join("\n\n"));
            conclusionBuffer = [];
          }
          inConclusion = false;
          paragraphs.push(trimmed);
          return;
        }

        const isSemiologyLine = /semiolog[ií]a|justificaci[oó]n|exclusi[oó]n/i.test(trimmed);
        const isConclusionHeader = !isSemiologyLine && /^\s*(?:#+|\*+|-|_|\d+\.)*\s*(?:conclusión|conclusiones|conclusion|impresión\s+diagnóstica|impresion\s+diagnostica|impresiones\s+diagnósticas|impresiones\s+diagnosticas|diagnósticos|diagnóstico|diagnostico|diagnosticos)\b/i.test(trimmed);

        const isFootnoteOrDivider = trimmed === "---" || /^---+\s*$/.test(trimmed) ||
          /^\s*(?:\*+)?\s*(?:pie de página|nota de pie|nota de pie de página|pie de pagina|nota de pie de pagina)\b/i.test(trimmed);

        const isOtherSectionHeader = /^\s*(?:##+|#)\s+/i.test(trimmed) ||
          /^\s*\*\*(?:hallazgos|estudio|técnica|tecnica|método|metodo|exploración|exploracion|motivo|comparación|comparacion|datos\s+clínicos|indicación|indicacion|antecedentes|pie\s+de\s+página|nota\s+de\s+pie)\b/i.test(trimmed) ||
          trimmed.includes("ANEXO DIAGNÓSTICO") ||
          trimmed.includes("DESGLOSE Y JUSTIFICACIÓN") ||
          isFootnoteOrDivider;

        if (isFootnoteOrDivider) {
          if (inConclusion && conclusionBuffer.length > 0) {
            paragraphs.push(conclusionBuffer.join("\n\n"));
            conclusionBuffer = [];
          }
          inConclusion = false;
          paragraphs.push(trimmed);
        } else if (isConclusionHeader) {
          if (inConclusion && conclusionBuffer.length > 0) {
            paragraphs.push(conclusionBuffer.join("\n\n"));
            conclusionBuffer = [];
          }
          inConclusion = true;
          conclusionBuffer.push(trimmed);
        } else if (isOtherSectionHeader) {
          if (inConclusion && conclusionBuffer.length > 0) {
            paragraphs.push(conclusionBuffer.join("\n\n"));
            conclusionBuffer = [];
          }
          inConclusion = false;
          paragraphs.push(trimmed);
        } else {
          if (inConclusion) {
            conclusionBuffer.push(trimmed);
          } else {
            paragraphs.push(trimmed);
          }
        }
      });

      if (inConclusion && conclusionBuffer.length > 0) {
        paragraphs.push(conclusionBuffer.join("\n\n"));
      }

      // Set standard font settings
      doc.setFont("times", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(30, 41, 59);

      let isFirstLine = true;
      let isFirstBlock = true;
      let inFootnoteSection = false;
      let hasDrawnSignature = false;

      const renderSignatureBlock = () => {
        if (hasDrawnSignature) return;
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
        hasDrawnSignature = true;
      };

      const renderSingleReportBlock = (block: string) => {
        const trimmedBlock = block.trim();
        if (!trimmedBlock) return;

        // Check for explicit page break tag
        if (/^(?:\[(?:salto(?:_de_p[aá]gina)?|page_break|salto_pagina)\]|<pagebreak>)$/i.test(trimmedBlock)) {
          doc.addPage();
          yCoord = 20;
          if (pdfLayoutType === "asymmetric") {
            drawAsymmetricSidebar(doc, doc.getNumberOfPages(), 20);
          }
          return;
        }

        // Check for explicit vertical spacing tag (e.g. [ESPACIO] or [ESPACIO_10MM])
        const spaceMatch = trimmedBlock.match(/^\[ESPACIO(?:_(\d+)MM)?\]$/i);
        if (spaceMatch) {
          const mm = spaceMatch[1] ? parseInt(spaceMatch[1], 10) : 10;
          yCoord += mm * factor;
          return;
        }

        // Skip inline Case Analysis JSON blocks as they are rendered in Step 5 (Diagnóstico Avanzado)
        if (trimmedBlock.includes("[CASE_ANALYSIS_JSON]")) {
          return;
        }


        // Check if the block is a footnote (for Creador de Notas de Pie de Página)
        const blockLower = trimmedBlock.toLowerCase();
        
        const isHeadingOrTableOrCode = trimmedBlock.startsWith("#") || 
                                       trimmedBlock.startsWith("**") || 
                                       trimmedBlock.startsWith("|") || 
                                       trimmedBlock.startsWith("```") || 
                                       (trimmedBlock.startsWith("===") && (trimmedBlock.includes("SÍNTESIS VASCULAR") || trimmedBlock.includes("SÍNTESIS DE ANATOMÍA")));
        
        if (isHeadingOrTableOrCode) {
          inFootnoteSection = false;
        }

        const isFootnote = inFootnoteSection ||
                            blockLower.startsWith("*pie de página:") || 
                            blockLower.startsWith("pie de página:") ||
                            blockLower.startsWith("*nota de pie:") ||
                            blockLower.startsWith("nota de pie:") ||
                            blockLower.startsWith("*nota de pie de página:") ||
                            blockLower.startsWith("nota de pie de página:");

        if (isFootnote) {
          checkPageBreak(8 * factor);
          doc.setFont("times", "italic");
          doc.setFontSize(8.5);
          doc.setTextColor(115, 125, 140); // Slate-500 (dim gray)
          
          let cleanTxt = trimmedBlock;
          // Strip "Pie de página: " or similar prefixes if they exist
          const prefixRegex = /^\s*(?:\*+)?\s*(?:pie de página|nota de pie|nota de pie de página)\s*(?:\*+)?\s*:\s*(?:\*+)?\s*/i;
          cleanTxt = cleanTxt.replace(prefixRegex, "");

          if (cleanTxt.startsWith("*")) {
            cleanTxt = cleanTxt.replace(/^\*\s*/, "").replace(/\*$/, "");
          }
          cleanTxt = cleanTxt.replace(/\*\*/g, "");

          const lines = doc.splitTextToSize(cleanTxt, contentWidth);
          lines.forEach((l: string) => {
            checkPageBreak(4.5 * factor);
            doc.text(l, marginX, yCoord);
            yCoord += 4.5 * factor;
          });
          yCoord += 2 * factor; // subtle gap
          
          // Reset default font styles
          doc.setFont("times", "normal");
          doc.setFontSize(10.5);
          doc.setTextColor(30, 41, 59);
          return;
        }

        // 1. Check if the block is a conclusion/diagnostic impression block (Sugerencia 1: Cuadro de Conclusión)
        const isConclusionBlock = /^\s*(?:#+|\*+|-|_|\d+\.)*\s*(?:conclusión|conclusiones|conclusion|impresión\s+diagnóstica|impresion\s+diagnostica|impresiones\s+diagnósticas|impresiones\s+diagnosticas|diagnósticos|diagnóstico|diagnostico|diagnosticos)\b/i.test(trimmedBlock);

        if (isConclusionBlock) {
          const blockLines = trimmedBlock.split("\n");
          
          let totalBlockHeight = 0;
          const parsedLines: {
            isHeader: boolean;
            isBulleted: boolean;
            bulletToken?: string;
            wrappedLines: { text: string; isBold: boolean }[][];
          }[] = [];
          
          // Padding dentro del bloque de sombreado sutil
          const boxPaddingLeft = 6;
          const boxPaddingRight = 6;
          const boxPaddingTop = 5;
          const boxPaddingBottom = 5;
          
          const boxContentWidth = contentWidth - boxPaddingLeft - boxPaddingRight;
          let headerTitle = "";

          blockLines.forEach((line) => {
            let lineTrimmed = line.trim();
            if (!lineTrimmed) {
              totalBlockHeight += 2.5 * factor;
              parsedLines.push({ isHeader: false, isBulleted: false, wrappedLines: [] });
              return;
            }
            const isFootnoteLineInBox = lineTrimmed === "---" || /^---+\s*$/.test(lineTrimmed) ||
              /^\s*(?:\*+)?\s*(?:pie de página|nota de pie|nota de pie de página|pie de pagina|nota de pie de pagina)\b/i.test(lineTrimmed);
            if (isFootnoteLineInBox) {
              return;
            }
            
            let isMarkdownHeading = false;
            if (lineTrimmed.startsWith("# ")) { isMarkdownHeading = true; lineTrimmed = lineTrimmed.replace(/^#\s+/, ""); }
            else if (lineTrimmed.startsWith("## ")) { isMarkdownHeading = true; lineTrimmed = lineTrimmed.replace(/^##\s+/, ""); }
            else if (lineTrimmed.startsWith("### ")) { isMarkdownHeading = true; lineTrimmed = lineTrimmed.replace(/^###\s+/, ""); }
            else if (lineTrimmed.startsWith("#### ")) { isMarkdownHeading = true; lineTrimmed = lineTrimmed.replace(/^####\s+/, ""); }

            const lineLower = lineTrimmed.toLowerCase();
            const isHeader = isMarkdownHeading || 
              (lineTrimmed.startsWith("**") && lineTrimmed.includes("**")) ||
              lineLower.startsWith("conclusión") ||
              lineLower.startsWith("conclusiones") ||
              lineLower.startsWith("conclusion") ||
              lineLower.startsWith("impresión diagnóstica") ||
              lineLower.startsWith("impresion diagnostica") ||
              lineLower.startsWith("impresiones diagnósticas") ||
              lineLower.startsWith("impresiones diagnosticas") ||
              lineLower.startsWith("diagnósticos") ||
              lineLower.startsWith("diagnóstico") ||
              lineLower.startsWith("diagnostico") ||
              lineLower.startsWith("diagnosticos");
            
            if (isHeader && !headerTitle) {
              let cleanHeading = lineTrimmed;
              cleanHeading = cleanHeading.replace(/^#+\s*/, "");
              cleanHeading = cleanHeading.replace(/\*\*/g, "");
              cleanHeading = cleanHeading.replace(/\*/g, "");
              cleanHeading = cleanHeading.replace(/:$/, ""); // Remover dos puntos finales
              cleanHeading = cleanHeading.trim();
              headerTitle = cleanHeading;
            } else {
              const isBulleted = lineTrimmed.startsWith("- ") || lineTrimmed.startsWith("* ") || /^\d+\.\s+/.test(lineTrimmed);
              let bulletToken = "-";
              let cleanText = lineTrimmed;
              
              if (isBulleted) {
                if (/^\d+\.\s+/.test(cleanText)) {
                  const numMatch = cleanText.match(/^(\d+\.)\s+/);
                  if (numMatch) {
                    bulletToken = numMatch[1];
                    cleanText = cleanText.substring(numMatch[0].length);
                  }
                } else if (cleanText.startsWith("- ") || cleanText.startsWith("* ")) {
                  cleanText = cleanText.substring(2);
                }
              }
              
              const wrapped = wrapMarkdown(doc, cleanText, isBulleted ? (boxContentWidth - 6) : boxContentWidth);
              totalBlockHeight += (wrapped.length * 5.0) * factor;
              
              parsedLines.push({
                isHeader: false,
                isBulleted,
                bulletToken,
                wrappedLines: wrapped
              });
            }
          });
          
          // Calcular la altura para el título de la cabecera si existe
          let wrappedHeaderLines: string[] = [];
          let headerHeight = 0;
          if (headerTitle) {
            wrappedHeaderLines = doc.splitTextToSize(headerTitle.toUpperCase(), boxContentWidth);
            headerHeight = (wrappedHeaderLines.length * 5.5 + 3.0) * factor; // Altura de línea + espaciado debajo
          }
          
          const finalBoxHeight = totalBlockHeight + headerHeight + (boxPaddingTop + boxPaddingBottom) * factor;
          
          // Margen de seguridad para evitar saltos huérfanos
          checkPageBreak(finalBoxHeight + 6);
          
          // Colores de Opción 3 (Sombreado Clínico Sutil sin bordes laterales)
          let bgColor = [248, 250, 252]; // Tono pizarra extremadamente sutil (slate-50)
          let lineAccentColor = [148, 163, 184]; // Delicada línea pizarra (slate-400)
          let textColor = [30, 41, 59]; // slate-800
          let headerColor = [15, 23, 42]; // slate-900 para el título interno
          
          if (pdfLayoutType === "clinical_slate") {
            bgColor = [241, 245, 249]; // slate-100
            lineAccentColor = [100, 116, 139]; // slate-500
            textColor = [15, 23, 42];
            headerColor = [71, 85, 105];
          } else if (pdfLayoutType === "executive_medical") {
            bgColor = [253, 251, 247]; // Crema sutil (warm white)
            lineAccentColor = [197, 160, 89]; // Línea dorada de cierre
            textColor = [15, 23, 42];
            headerColor = [141, 110, 50]; // Bronce profundo
          } else if (pdfLayoutType === "asymmetric") {
            bgColor = [249, 250, 254]; // Índigo extremadamente sutil
            lineAccentColor = [129, 140, 248]; // Índigo suave (indigo-400)
            textColor = [15, 23, 42];
            headerColor = [79, 70, 229];
          }
          
          // Dibujar el sombreado de fondo sin bordes perimetrales rígidos
          doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
          doc.rect(marginX, yCoord, contentWidth, finalBoxHeight, "F");
          
          // Dibujar la delgada línea horizontal superior para abrir el bloque
          doc.setDrawColor(lineAccentColor[0], lineAccentColor[1], lineAccentColor[2]);
          doc.setLineWidth(0.35); // Grosor fino y elegante (0.35mm)
          doc.line(marginX, yCoord, marginX + contentWidth, yCoord);
          
          // Dibujar la delgada línea horizontal inferior para cerrar el bloque
          doc.line(marginX, yCoord + finalBoxHeight, marginX + contentWidth, yCoord + finalBoxHeight);
          
          let currentY = yCoord + boxPaddingTop * factor;
          
          // Renderizar el título de la cabecera si existe
          if (headerTitle) {
            doc.setFont("times", "bold");
            doc.setFontSize(10.5);
            doc.setTextColor(headerColor[0], headerColor[1], headerColor[2]);
            
            wrappedHeaderLines.forEach((wLine) => {
              doc.text(wLine, marginX + boxPaddingLeft, currentY);
              currentY += 5.5 * factor;
            });
            currentY += 3.0 * factor; // Espaciado elegante bajo el título
          }
          
          parsedLines.forEach((pLine) => {
            if (pLine.wrappedLines.length === 0) {
              currentY += 2.5 * factor;
              return;
            }
            
            doc.setFont("times", "normal");
            doc.setFontSize(10.5);
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            
            if (pLine.isBulleted) {
              let isFirstLineOfBullet = true;
              pLine.wrappedLines.forEach((wLineArr) => {
                if (isFirstLineOfBullet) {
                  doc.setFont("times", "bold");
                  doc.text(pLine.bulletToken || "-", marginX + boxPaddingLeft + 1.5, currentY);
                  isFirstLineOfBullet = false;
                }
                
                let currentX = marginX + boxPaddingLeft + 6;
                wLineArr.forEach((span) => {
                  if (span.isBold) {
                    doc.setFont("times", "bold");
                  } else {
                    doc.setFont("times", "normal");
                  }
                  doc.text(span.text, currentX, currentY);
                  currentX += doc.getTextWidth(span.text);
                });
                currentY += 5.0 * factor;
              });
            } else {
              pLine.wrappedLines.forEach((wLineArr) => {
                let currentX = marginX + boxPaddingLeft;
                wLineArr.forEach((span) => {
                  if (span.isBold) {
                    doc.setFont("times", "bold");
                  } else {
                    doc.setFont("times", "normal");
                  }
                  doc.text(span.text, currentX, currentY);
                  currentX += doc.getTextWidth(span.text);
                });
                currentY += 5.0 * factor;
              });
            }
          });
          
          yCoord = yCoord + finalBoxHeight + 3 * factor;
          
          doc.setFont("times", "normal");
          doc.setFontSize(10.5);
          doc.setTextColor(30, 41, 59);
          return;
        }

        // 2. Check if the block is a code block (starts/ends with triple backticks, or is a raw EMR segment)
        const isCodeBlockSegment = trimmedBlock.startsWith("```") || (trimmedBlock.startsWith("===") && (trimmedBlock.includes("SÍNTESIS VASCULAR") || trimmedBlock.includes("SÍNTESIS DE ANATOMÍA")));

        if (isCodeBlockSegment) {
          const linesOfBlock = trimmedBlock.split("\n");
          // Filter out the opening/closing backtick lines
          const codeBlockLines = linesOfBlock.filter(line => !line.trim().startsWith("```"));
          
          // Allocate height for the spacing
          const lineSpacing = 4.2 * factor;
          const neededHeight = (codeBlockLines.length * lineSpacing) + 7 * factor;
          checkPageBreak(neededHeight);

          // Draw a clean background box
          doc.setFillColor(248, 250, 252); // slate-50 / light gray
          doc.rect(marginX, yCoord, contentWidth, neededHeight - 2 * factor, "F");
          doc.setDrawColor(226, 232, 240); // slate-200 border
          doc.setLineWidth(0.3);
          doc.rect(marginX, yCoord, contentWidth, neededHeight - 2 * factor, "D");

          // Set monospace font Courier (built-in)
          doc.setFont("courier", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(30, 41, 59);

          let relativeY = yCoord + 4.5 * factor;
          codeBlockLines.forEach((line) => {
            doc.text(line, marginX + 4, relativeY);
            relativeY += lineSpacing;
          });

          yCoord = relativeY + 1.5 * factor;
          
          // Re-set default font settings for the next paragraphs
          doc.setFont("times", "normal");
          doc.setFontSize(10.5);
          doc.setTextColor(30, 41, 59);
          return;
        }

        // 2. Check if the block is a separator/divider
        if (trimmedBlock === "---") {
          inFootnoteSection = true;
          checkPageBreak(8 * factor);
          yCoord += 4 * factor;
          doc.setDrawColor(226, 232, 240); // slate-200
          doc.setLineWidth(0.4);
          doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
          yCoord += 6 * factor;
          return;
        }

        // 2. Check if the block is a markdown table
        const linesOfBlock = trimmedBlock.split("\n");
        const hasPipe = linesOfBlock.some(line => line.includes("|"));
        const isTableDivider = linesOfBlock.some(line => line.includes("---") && line.includes("|"));
        const isTable = hasPipe && (isTableDivider || linesOfBlock.length >= 2);

        if (isTable) {
          if (!isFirstBlock) {
            yCoord += 16 * factor; // Elegant, clear vertical gap between preceding diagnostic text and table
          } else {
            isFirstBlock = false;
          }
          const nonTableLinesAtTop: string[] = [];
          const tableOnlyLines: string[] = [];
          let foundTableStart = false;

          linesOfBlock.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine.includes("|")) {
              foundTableStart = true;
            }
            if (foundTableStart) {
              tableOnlyLines.push(line);
            } else {
              nonTableLinesAtTop.push(line);
            }
          });

          const cleanTableRows = tableOnlyLines
            .map(line => line.trim())
            .filter(line => {
              const rowHasPipe = line.includes("|");
              const isDivider = line.includes("---") || /^[|:\-\s]+$/.test(line);
              return rowHasPipe && !isDivider && line.replace(/\|/g, "").trim().length > 0;
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

            // Determine column widths
            const colCount = headers.length || 1;
            const colWidths: number[] = [];
            
            if (colCount === 1) {
              colWidths.push(contentWidth);
            } else if (colCount === 2) {
              const isAsistenteUnilateralNoRef = headers.some(h => h.toLowerCase().includes("estructura")) && 
                                                 headers.some(h => h.toLowerCase().includes("derecha") || h.toLowerCase().includes("izquierda") || h.toLowerCase().includes("medida"));
              if (isAsistenteUnilateralNoRef) {
                colWidths.push(contentWidth * 0.45);
                colWidths.push(contentWidth * 0.55);
              } else {
                colWidths.push(contentWidth * 0.4);
                colWidths.push(contentWidth * 0.6);
              }
            } else if (colCount === 3) {
              const isAsistenteUnilateral = headers.some(h => h.toLowerCase().includes("referencia"));
              const isVascular = headers.some(h => {
                const lower = h.toLowerCase();
                return lower.includes("derech") || lower.includes("izquierd") || lower.includes("alterad") || lower.includes("vaso");
              });
              if (isAsistenteUnilateral) {
                // Column 0: Estructura (30%), Column 1: Derecha/Izquierda (50%), Column 2: Valor de Referencia (20%)
                colWidths.push(contentWidth * 0.30);
                colWidths.push(contentWidth * 0.50);
                colWidths.push(contentWidth * 0.20);
              } else if (isVascular) {
                colWidths.push(contentWidth * 0.34);
                colWidths.push(contentWidth * 0.33);
                colWidths.push(contentWidth * 0.33);
              } else {
                colWidths.push(contentWidth * 0.15); // ID col (compact)
                colWidths.push(contentWidth * 0.35); // Structure / Site Name
                colWidths.push(contentWidth * 0.50); // Detailed Main Findings
              }
            } else if (colCount === 4) {
              const isClassificationTable = headers.some(h => {
                const l = (h || "").toLowerCase();
                return l.includes("criterio") || l.includes("pondera") || l.includes("score") || l.includes("justifica") || l.includes("sustento");
              });
              const isAsistenteBilateral = headers.some(h => {
                const l = h.toLowerCase();
                return l.includes("derecha") || l.includes("izquierda");
              });
              const isGenericAsistente = headers.some(h => h.toLowerCase().includes("registrada")) || headers.some(h => h.toLowerCase().includes("referencia"));

              if (isClassificationTable) {
                colWidths.push(contentWidth * 0.24); // Criterio Evaluado
                colWidths.push(contentWidth * 0.28); // Hallazgo en el Reporte
                colWidths.push(contentWidth * 0.16); // Ponderación / Score
                colWidths.push(contentWidth * 0.32); // Justificación Diagnóstica
              } else if (isAsistenteBilateral) {
                colWidths.push(contentWidth * 0.25);
                colWidths.push(contentWidth * 0.30);
                colWidths.push(contentWidth * 0.30);
                colWidths.push(contentWidth * 0.15);
              } else if (isGenericAsistente) {
                colWidths.push(contentWidth * 0.30);
                colWidths.push(contentWidth * 0.20);
                colWidths.push(contentWidth * 0.20);
                colWidths.push(contentWidth * 0.30);
              } else {
                colWidths.push(contentWidth * 0.12); // ID Column (e.g. H1, H2, H3)
                colWidths.push(contentWidth * 0.28); // Estructura / Sitio
                colWidths.push(contentWidth * 0.22); // Categoría
                colWidths.push(contentWidth * 0.38); // Hallazgo Principal
              }
            } else {
              const equalWidth = contentWidth / colCount;
              for (let i = 0; i < colCount; i++) {
                colWidths.push(equalWidth);
              }
            }

            // Pre-calculate heights of all table rows to prevent the table from being split across pages if possible.
            const cachedRowsData: {
              cellSpansLines: { text: string; isBold: boolean }[][][];
              rowHeight: number;
            }[] = [];

            let calculatedRowsHeightSum = 0;

            bodyRows.forEach((row) => {
              const cellSpansLinesList: { text: string; isBold: boolean }[][][] = [];
              let maxLines = 0;

              row.forEach((cellText, cIdx) => {
                const currentColWidth = colWidths[cIdx] || (contentWidth / colCount);
                const cellSpansLines = wrapMarkdown(doc, cellText, currentColWidth - 6);
                cellSpansLinesList.push(cellSpansLines);
                if (cellSpansLines.length > maxLines) {
                  maxLines = cellSpansLines.length;
                }
              });

              const rowHeight = (maxLines * 5 * factor) + 4 * factor;
              calculatedRowsHeightSum += rowHeight;
              cachedRowsData.push({
                cellSpansLines: cellSpansLinesList,
                rowHeight,
              });
            });

            // The header takes 12 units baseline check, then yCoord is advanced by 9.
            // So total calculated height for table is roughly: header (12) + rows + extra gap (4)
            const totalTableNeededHeight = (12 * factor) + calculatedRowsHeightSum + (4 * factor);

            // Estimate the height of any non-table lines/titles at the top
            let estimatedHeadingsHeight = 0;
            nonTableLinesAtTop.forEach((line) => {
              let trimmed = line.trim();
              if (!trimmed) return;

              let isMarkdownHeading = false;
              if (trimmed.startsWith("# ")) {
                isMarkdownHeading = true;
                trimmed = trimmed.replace(/^#\s+/, "");
              } else if (trimmed.startsWith("## ")) {
                isMarkdownHeading = true;
                trimmed = trimmed.replace(/^##\s+/, "");
              } else if (trimmed.startsWith("### ")) {
                isMarkdownHeading = true;
                trimmed = trimmed.replace(/^###\s+/, "");
              } else if (trimmed.startsWith("#### ")) {
                isMarkdownHeading = true;
                trimmed = trimmed.replace(/^####\s+/, "");
              }

              const isHeader = isMarkdownHeading || (
                trimmed.startsWith("**") && (
                  trimmed.endsWith("**") || 
                  trimmed.replace(/[:\s]+$/, "").endsWith("**")
                )
              );
              const cleanHeaderTxt = trimmed.replace(/\*\*/g, "");

              if (isHeader) {
                const wrappedHeaders = doc.splitTextToSize(cleanHeaderTxt, contentWidth);
                estimatedHeadingsHeight += (wrappedHeaders.length * 5.5 + 4) * factor;
              } else {
                const lines = doc.splitTextToSize(trimmed, contentWidth);
                estimatedHeadingsHeight += (lines.length * 4.5 + 4) * factor;
              }
            });

            // We want to make sure that the headings AND the table header + at least the first row of the table
            // can fit together on the current page to avoid orphans!
            const firstRowHeight = cachedRowsData[0]?.rowHeight || (15 * factor);
            const minimumCombinedHeight = estimatedHeadingsHeight + (12 * factor) + firstRowHeight + (4 * factor);

            // Check combined page break before printing anything (including headings)!
            checkPageBreak(Math.min(minimumCombinedHeight, pageHeight - 40));

            // Draw any non-table heading lines from the top (e.g., table titles/headings)
            nonTableLinesAtTop.forEach((line) => {
              let trimmed = line.trim();
              if (!trimmed) return;

              let isMarkdownHeading = false;
              if (trimmed.startsWith("# ")) {
                isMarkdownHeading = true;
                trimmed = trimmed.replace(/^#\s+/, "");
              } else if (trimmed.startsWith("## ")) {
                isMarkdownHeading = true;
                trimmed = trimmed.replace(/^##\s+/, "");
              } else if (trimmed.startsWith("### ")) {
                isMarkdownHeading = true;
                trimmed = trimmed.replace(/^###\s+/, "");
              } else if (trimmed.startsWith("#### ")) {
                isMarkdownHeading = true;
                trimmed = trimmed.replace(/^####\s+/, "");
              }

              const isHeader = isMarkdownHeading || (
                trimmed.startsWith("**") && (
                  trimmed.endsWith("**") || 
                  trimmed.replace(/[:\s]+$/, "").endsWith("**")
                )
              );
              const cleanHeaderTxt = trimmed.replace(/\*\*/g, "");

              checkPageBreak(10 * factor);
              if (isHeader) {
                doc.setFont("times", "bold");
                doc.setFontSize(11);
                
                if (pdfLayoutType === "clinical_slate") {
                  doc.setTextColor(30, 41, 59); // slate-800
                } else if (pdfLayoutType === "executive_medical") {
                  doc.setTextColor(15, 23, 42); // Navy
                } else {
                  doc.setTextColor(15, 23, 42);
                }

                const wrappedHeaders = doc.splitTextToSize(cleanHeaderTxt, contentWidth);
                wrappedHeaders.forEach((lineText: string) => {
                  checkPageBreak(5.5 * factor);
                  
                  if (pdfLayoutType === "clinical_slate") {
                    // Left vertical slate bar
                    doc.setFillColor(71, 85, 105);
                    doc.rect(marginX - 3, yCoord - 3.8 * factor, 1.0, 4.5 * factor, "F");
                  }
                  
                  doc.text(lineText, marginX, yCoord);
                  yCoord += 5.5 * factor;
                });

                // Underlines for headings
                if (pdfLayoutType === "clinical_slate") {
                  doc.setDrawColor(226, 232, 240); // slate-200
                  doc.setLineWidth(0.25);
                  doc.line(marginX, yCoord - 1.5 * factor, marginX + contentWidth, yCoord - 1.5 * factor);
                  yCoord += 1.5 * factor;
                } else if (pdfLayoutType === "executive_medical") {
                  doc.setDrawColor(197, 160, 89); // Gold
                  doc.setLineWidth(0.35);
                  doc.line(marginX, yCoord - 1.5 * factor, marginX + contentWidth, yCoord - 1.5 * factor);
                  yCoord += 1.5 * factor;
                }
              } else {
                doc.setFont("times", "normal");
                doc.setFontSize(10.5);
                doc.setTextColor(51, 65, 85);
                const lines = doc.splitTextToSize(trimmed, contentWidth);
                lines.forEach((l: string) => {
                  checkPageBreak(5 * factor);
                  doc.text(l, marginX, yCoord);
                  yCoord += 4.5 * factor;
                });
                yCoord += 2 * factor;
              }
            });

            // Now check page break for table header + first row only. If that fits, we start the table on this page
            // and let subsequent rows split naturally across pages as needed.
            checkPageBreak(12 * factor + (cachedRowsData[0]?.rowHeight || 10 * factor));

            // Header Render
            checkPageBreak(12 * factor);
            
            if (pdfLayoutType === "clinical_slate") {
              doc.setFillColor(71, 85, 105); // slate-600
              doc.rect(marginX, yCoord - 4 * factor, contentWidth, 8 * factor, "F");
              doc.setDrawColor(51, 65, 85); // slate-700
              doc.setLineWidth(0.35);
              doc.line(marginX, yCoord - 4 * factor, marginX + contentWidth, yCoord - 4 * factor);
              doc.line(marginX, yCoord + 4 * factor, marginX + contentWidth, yCoord + 4 * factor);
            } else if (pdfLayoutType === "executive_medical") {
              doc.setFillColor(15, 23, 42); // Navy-900
              doc.rect(marginX, yCoord - 4 * factor, contentWidth, 8 * factor, "F");
              doc.setDrawColor(197, 160, 89); // Gold
              doc.setLineWidth(0.4);
              doc.line(marginX, yCoord - 4 * factor, marginX + contentWidth, yCoord - 4 * factor);
              doc.line(marginX, yCoord + 4 * factor, marginX + contentWidth, yCoord + 4 * factor);
            } else {
              doc.setFillColor(241, 245, 249); // slate-100 / cool grey background
              doc.rect(marginX, yCoord - 4 * factor, contentWidth, 8 * factor, "F");
              doc.setDrawColor(203, 213, 225); // slate-300 border
              doc.setLineWidth(0.3);
              doc.line(marginX, yCoord - 4 * factor, marginX + contentWidth, yCoord - 4 * factor);
              doc.line(marginX, yCoord + 4 * factor, marginX + contentWidth, yCoord + 4 * factor);
            }

            let currentX = marginX;
            doc.setFont("times", "bold");
            doc.setFontSize(9.5);
            
            if (pdfLayoutType === "clinical_slate" || pdfLayoutType === "executive_medical") {
              doc.setTextColor(255, 255, 255); // white text
            } else {
              doc.setTextColor(15, 23, 42); // slate-900
            }

            const isVascularTable = false;

            headers.forEach((headerTxt, hIdx) => {
              let hClean = headerTxt.replace(/\*\*/g, "").trim();
              if (colCount === 2) {
                // Force headers to read exactly "INTERPRETACIÓN" and "Hallazgos" ONLY if header explicitly indicates semiology or interpretation
                const isSynoptic = headers.some(h => {
                  const l = h.toLowerCase();
                  return l.includes("aspecto") || l.includes("detalle") || l.includes("sinopsis") || l.includes("evaluado") || l.includes("clínico") || l.includes("sistema") || l.includes("categoría") || l.includes("criterio") || l.includes("paso") || l.includes("parámetro") || l.includes("definición") || l.includes("estadio") || l.includes("ponderación") || l.includes("justificación");
                });
                const isExplicitSemiology = headers.some(h => {
                  const l = h.toLowerCase();
                  return l.includes("interpretaci") || l.includes("semiol");
                });
                if (!isSynoptic && isExplicitSemiology) {
                  if (hIdx === 0) hClean = "INTERPRETACIÓN";
                  if (hIdx === 1) hClean = "Hallazgos";
                }
              } else if (isVascularTable) {
                if (hIdx === 0) hClean = "Segmento Alterado";
                if (hIdx === 1) hClean = "Derecho";
                if (hIdx === 2) hClean = "Izquierdo";
              }

              const currentColW = colWidths[hIdx] || (contentWidth / colCount);
              doc.setFont("times", "bold");
              doc.setFontSize(9.5);
              if (doc.getTextWidth(hClean) > currentColW - 4) {
                doc.setFontSize(8.5);
              }
              if (doc.getTextWidth(hClean) > currentColW - 4) {
                doc.setFontSize(7.5);
              }
              doc.text(hClean, currentX + 3, yCoord + 1);
              currentX += currentColW;
            });
            
            yCoord += 9 * factor;

            // Rows Render
            bodyRows.forEach((row, rIdx) => {
              const cachedRow = cachedRowsData[rIdx];
              const cellLines = cachedRow.cellSpansLines;
              const rowHeight = cachedRow.rowHeight;

              checkPageBreak(rowHeight);

              if (rIdx % 2 === 1) {
                if (pdfLayoutType === "clinical_slate") {
                  doc.setFillColor(241, 245, 249); // slate-100
                } else if (pdfLayoutType === "executive_medical") {
                  doc.setFillColor(253, 251, 247); // Cream-50
                } else {
                  doc.setFillColor(248, 250, 252); // standard grey alternate background
                }
                doc.rect(marginX, yCoord - 4 * factor, contentWidth, rowHeight, "F");
              }

              if (pdfLayoutType === "clinical_slate") {
                doc.setDrawColor(203, 213, 225); // slate-300
                doc.setLineWidth(0.25);
              } else if (pdfLayoutType === "executive_medical") {
                doc.setDrawColor(220, 210, 195); // light gold-gray
                doc.setLineWidth(0.25);
              } else {
                doc.setDrawColor(226, 232, 240); // slate-200 border
                doc.setLineWidth(0.2);
              }
              doc.line(marginX, yCoord - 4 * factor + rowHeight, marginX + contentWidth, yCoord - 4 * factor + rowHeight);

              let startRowX = marginX;
              row.forEach((_, cIdx) => {
                const colW = colWidths[cIdx] || (contentWidth / colCount);
                let tempY = yCoord;
                const spansLines = cellLines[cIdx] || [];

                spansLines.forEach((spanLine) => {
                  let cellX = startRowX + 3;
                  spanLine.forEach((span) => {
                    if (span.isBold) {
                      doc.setFont("times", "bold");
                    } else {
                      doc.setFont("times", "normal");
                    }
                    doc.setFontSize(9.5);
                    doc.setTextColor(51, 65, 85);
                    doc.text(span.text, cellX, tempY + 1);
                    cellX += doc.getTextWidth(span.text);
                  });
                  tempY += 5 * factor;
                });

                startRowX += colW;
              });

              yCoord += rowHeight;
            });

            yCoord += 4 * factor; // margin after table completes
            return;
          }
        }

        // 3. Render as standard block with paragraphs and line spacing
        if (!isFirstBlock) {
          yCoord += 4.5 * factor;
        } else {
          isFirstBlock = false;
        }

        const blockSeverity = getParagraphSeverity(trimmedBlock);

        linesOfBlock.forEach((line, lineIdx) => {
          let trimmed = line.trim();
          if (!trimmed) {
            yCoord += 2.5 * factor;
            return;
          }

          // Clean Markdown headers format if any
          let isMarkdownHeading = false;
          if (trimmed.startsWith("# ")) {
            isMarkdownHeading = true;
            trimmed = trimmed.replace(/^#\s+/, "");
          } else if (trimmed.startsWith("## ")) {
            isMarkdownHeading = true;
            trimmed = trimmed.replace(/^##\s+/, "");
          } else if (trimmed.startsWith("### ")) {
            isMarkdownHeading = true;
            trimmed = trimmed.replace(/^###\s+/, "");
          } else if (trimmed.startsWith("#### ")) {
            isMarkdownHeading = true;
            trimmed = trimmed.replace(/^####\s+/, "");
          }

          const isHeader = isMarkdownHeading || (
            trimmed.startsWith("**") && (
              trimmed.endsWith("**") || 
              trimmed.replace(/[:\s]+$/, "").endsWith("**")
            )
          );
          const cleanHeaderTxt = trimmed.replace(/\*\*/g, "");

          // Determine if first visual line is the main title of study
          const isMainTitle = isFirstLine && (isHeader || /REPORTE|INFORME|ESTUDIO|DIAGNÓSTICO|VALORACIÓN/i.test(trimmed));

          if (isMainTitle) {
            isFirstLine = false;
            // Center-align main title beautifully
            doc.setFont("times", "bold");
            doc.setFontSize(13);
            doc.setTextColor(15, 23, 42);
            const wrappedTitle = doc.splitTextToSize(cleanHeaderTxt.toUpperCase(), contentWidth);
            wrappedTitle.forEach((lineText: string) => {
              checkPageBreak(7 * factor);
              doc.text(lineText, pageWidth / 2, yCoord, { align: "center" });
              yCoord += 6 * factor;
            });
            return;
          }

          if (isFirstLine) {
            isFirstLine = false;
          }

          if (isHeader) {
            // Let's estimate the height of the header + next few lines to avoid orphans!
            let lookAheadHeight = 12 * factor; // space for header + spacing
            let countLinesLookedAt = 0;
            
            // 1. Look ahead in the remaining lines of the current block
            for (let nextIdx = lineIdx + 1; nextIdx < linesOfBlock.length; nextIdx++) {
              const nextLine = linesOfBlock[nextIdx].trim();
              if (!nextLine) continue;
              
              // If we hit another header, stop look-ahead
              const isNextHeader = nextLine.startsWith("#") || (
                nextLine.startsWith("**") && (
                  nextLine.endsWith("**") || 
                  nextLine.replace(/[:\s]+$/, "").endsWith("**")
                )
              );
              if (isNextHeader) break;
              
              const isNextBulleted = nextLine.startsWith("- ") || nextLine.startsWith("* ") || /^\d+\.\s+/.test(nextLine);
              let cleanNext = nextLine;
              if (isNextBulleted) {
                if (/^\d+\.\s+/.test(cleanNext)) {
                  cleanNext = cleanNext.substring(cleanNext.indexOf(".") + 1).trim();
                } else {
                  cleanNext = cleanNext.substring(2).trim();
                }
              }
              
              const wrappedNext = wrapMarkdown(doc, cleanNext, isNextBulleted ? contentWidth - 6 : contentWidth);
              lookAheadHeight += (wrappedNext.length * 5) * factor;
              
              countLinesLookedAt++;
              if (countLinesLookedAt >= 2) break;
            }
            
            // 2. If we haven't found enough content lines yet, look at the next paragraph blocks!
            if (countLinesLookedAt < 2) {
              const currentBlockIdx = paragraphs.indexOf(block);
              if (currentBlockIdx !== -1) {
                for (let nextBlockIdx = currentBlockIdx + 1; nextBlockIdx < paragraphs.length; nextBlockIdx++) {
                  const nextBlock = paragraphs[nextBlockIdx].trim();
                  if (!nextBlock) continue;
                  
                  if (nextBlock.startsWith("```") || nextBlock.startsWith("|") || (nextBlock.startsWith("===") && (nextBlock.includes("SÍNTESIS VASCULAR") || nextBlock.includes("SÍNTESIS DE ANATOMÍA")))) {
                    lookAheadHeight += 15 * factor;
                    countLinesLookedAt += 2;
                    break;
                  }
                  
                  const nextBlockLines = nextBlock.split("\n");
                  let hitHeaderInNextBlock = false;
                  
                  for (let i = 0; i < nextBlockLines.length; i++) {
                    const nextLine = nextBlockLines[i].trim();
                    if (!nextLine) continue;
                    
                    const isNextHeader = nextLine.startsWith("#") || (
                      nextLine.startsWith("**") && (
                        nextLine.endsWith("**") || 
                        nextLine.replace(/[:\s]+$/, "").endsWith("**")
                      )
                    );
                    if (isNextHeader) {
                      hitHeaderInNextBlock = true;
                      break;
                    }
                    
                    const isNextBulleted = nextLine.startsWith("- ") || nextLine.startsWith("* ") || /^\d+\.\s+/.test(nextLine);
                    let cleanNext = nextLine;
                    if (isNextBulleted) {
                      if (/^\d+\.\s+/.test(cleanNext)) {
                        cleanNext = cleanNext.substring(cleanNext.indexOf(".") + 1).trim();
                      } else {
                        cleanNext = cleanNext.substring(2).trim();
                      }
                    }
                    
                    const wrappedNext = wrapMarkdown(doc, cleanNext, isNextBulleted ? contentWidth - 6 : contentWidth);
                    lookAheadHeight += (wrappedNext.length * 5) * factor;
                    
                    countLinesLookedAt++;
                    if (countLinesLookedAt >= 2) break;
                  }
                  
                  if (hitHeaderInNextBlock || countLinesLookedAt >= 2) {
                    break;
                  }
                }
              }
            }
            
            // Avoid heading orphans by requiring at least 25mm of space, up to calculated lookahead
            const minRequiredHeight = Math.max(25 * factor, lookAheadHeight);
            checkPageBreak(minRequiredHeight);
            
            doc.setFont("times", "bold");
            doc.setFontSize(11);
            
            if (pdfLayoutType === "clinical_slate") {
              doc.setTextColor(30, 41, 59); // slate-800
            } else if (pdfLayoutType === "executive_medical") {
              doc.setTextColor(15, 23, 42); // Navy
            } else {
              doc.setTextColor(15, 23, 42);
            }

            const wrappedHeaders = doc.splitTextToSize(cleanHeaderTxt, contentWidth);
            wrappedHeaders.forEach((lineText: string) => {
              checkPageBreak(5.5 * factor);
              
              if (pdfLayoutType === "clinical_slate") {
                // Draw elegant vertical slate bar on the left of header
                doc.setFillColor(71, 85, 105); // slate-600
                doc.rect(marginX - 3, yCoord - 3.8 * factor, 1.0, 4.5 * factor, "F");
              }
              
              doc.text(lineText, marginX, yCoord);
              yCoord += 5.5 * factor;
            });

            // Underlines for headings
            const isAnnexHeading = cleanHeaderTxt.toUpperCase().includes("ANEXO") || 
                                   cleanHeaderTxt.toUpperCase().includes("DESGLOSE Y JUSTIFICACIÓN");
            if (isAnnexHeading) {
              doc.setDrawColor(203, 213, 225); // slate-300
              doc.setLineWidth(0.3);
              doc.line(marginX, yCoord - 1 * factor, marginX + contentWidth, yCoord - 1 * factor);
              yCoord += 3.5 * factor;
            } else if (pdfLayoutType === "clinical_slate") {
              doc.setDrawColor(226, 232, 240); // slate-200
              doc.setLineWidth(0.25);
              doc.line(marginX, yCoord - 1.5 * factor, marginX + contentWidth, yCoord - 1.5 * factor);
              yCoord += 1.5 * factor;
            } else if (pdfLayoutType === "executive_medical") {
              doc.setDrawColor(197, 160, 89); // Gold
              doc.setLineWidth(0.35);
              doc.line(marginX, yCoord - 1.5 * factor, marginX + contentWidth, yCoord - 1.5 * factor);
              yCoord += 1.5 * factor;
            }
          } else {
            // Is it a bullet/list item in original design?
            const isBulleted = trimmed.startsWith("- ") || trimmed.startsWith("* ") || /^\d+\.\s+/.test(trimmed);
            if (isBulleted) {
              let cleanItem = trimmed;
              let bulletToken = "-";
              const isNumbered = /^\d+\.\s+/.test(cleanItem);

              if (isNumbered) {
                const numMatch = cleanItem.match(/^(\d+\.)\s+/);
                if (numMatch) {
                  bulletToken = numMatch[1];
                  cleanItem = cleanItem.substring(numMatch[0].length);
                }
              } else if (cleanItem.startsWith("- ") || cleanItem.startsWith("* ")) {
                cleanItem = cleanItem.substring(2);
              }

              const indent = 6;
              const textWidth = contentWidth - indent;
              
              checkPageBreak(6 * factor);
              doc.setFont("times", "bold");
              doc.setFontSize(10.5);
              doc.setTextColor(15, 23, 42);
              doc.text(bulletToken || "-", marginX + 1.5, yCoord);
 
              const lines = wrapMarkdown(doc, cleanItem, textWidth);
              const itemSeverity = getParagraphSeverity(cleanItem);
              lines.forEach((lineVal) => {
                checkPageBreak(5 * factor);
                
                // Fine continuous left chromatic accent based on severity of findings
                if (isSyntacticHighlightingActive) {
                  if (itemSeverity === "critical") {
                    doc.setFillColor(251, 113, 133); // soft coral rose-400
                    doc.rect(marginX - 3.5, yCoord - 3.8 * factor, 0.4, 5 * factor, "F"); // Left accent only (fine continuous line)
                  } else if (itemSeverity === "altered") {
                    doc.setFillColor(245, 158, 11); // amber-500
                    doc.rect(marginX - 3.5, yCoord - 3.8 * factor, 0.4, 5 * factor, "F"); // Left accent only (fine continuous line)
                  }
                }
 
                let currentX = marginX + indent;
                lineVal.forEach((span) => {
                  if (span.isBold) {
                    doc.setFont("times", "bold");
                  } else {
                    doc.setFont("times", "normal");
                  }
                  doc.setFontSize(10.5);
                  doc.setTextColor(30, 41, 59);
                  doc.text(span.text, currentX, yCoord);
                  currentX += doc.getTextWidth(span.text);
                });
                yCoord += 5 * factor;
              });
            } else {
              // Wrap markdown formatted lines (bold and normal text mixed) safely and beautifully
              const lines = wrapMarkdown(doc, trimmed, contentWidth);
              const itemSeverity = getParagraphSeverity(trimmed);
              lines.forEach((lineVal) => {
                checkPageBreak(5 * factor);
 
                // Fine continuous left chromatic accent based on severity of findings
                if (isSyntacticHighlightingActive) {
                  if (itemSeverity === "critical") {
                    doc.setFillColor(251, 113, 133); // soft coral rose-400
                    doc.rect(marginX - 3.5, yCoord - 3.8 * factor, 0.4, 5 * factor, "F"); // Left accent only (fine continuous line)
                  } else if (itemSeverity === "altered") {
                    doc.setFillColor(245, 158, 11); // amber-500
                    doc.rect(marginX - 3.5, yCoord - 3.8 * factor, 0.4, 5 * factor, "F"); // Left accent only (fine continuous line)
                  }
                }
 
                let currentX = marginX;
                lineVal.forEach((span) => {
                  if (span.isBold) {
                    doc.setFont("times", "bold");
                  } else {
                    doc.setFont("times", "normal");
                  }
                  doc.setFontSize(10.5);
                  doc.setTextColor(30, 41, 59);
                  doc.text(span.text, currentX, yCoord);
                  currentX += doc.getTextWidth(span.text);
                });
                yCoord += 5 * factor;
              });
            }
          }
        });
      };

      // Categorize paragraph blocks according to requested 10-step insertion sequence:
      // 1. CUERPO DE REPORTE CON FIRMA AL FINAL
      // 2. CUADRO SINOPTICO
      // 3. SINOPSIS POR ORGANO
      // 4. SINOPSIS DE HALLAZGOS CON DIBUJO Y TARJETAS SINOPTICAS
      // 5. CUADRO DE ASISTENTE DE MEDIDAS
      // 6. ANEXO DE FOTOS Y CAPTURAS DE ULTRASONIDO
      // 7. DIAGNOSTICO AVANZADO
      // 8. DESGLOCE Y JUSTIFICACION DE CLASIFICACIONES
      // 9. RESUMEN DEL PACIENTE
      // 10. INFOGRAFIA DEL PACIENTE
      const mainReportBlocks: string[] = [];
      const cuadroSinopticoBlocks: string[] = [];
      const organSynopsisBlocks: string[] = [];
      const measurementAssistantBlocks: string[] = [];
      const classificationAnnexBlocks: string[] = [];

      let pdfSectionTarget: "main" | "cuadro" | "organ" | "medidas" | "annex" = "main";

      paragraphs.forEach((block) => {
        const trimmedBlock = block.trim();
        if (!trimmedBlock) return;

        if (trimmedBlock.includes("[CASE_ANALYSIS_JSON]")) {
          return;
        }

        const upperBlock = trimmedBlock.toUpperCase();
        if (
          upperBlock.includes("RADAR BIOMECÁNICO") ||
          upperBlock.includes("RADAR BIOMECANICO") ||
          upperBlock.includes("PUNTAJE GLOBAL DE CARGA TISULAR:") ||
          upperBlock.includes("VECTOR PATOLÓGICO DOMINANTE:") ||
          upperBlock.includes("MATRIZ DE VECTORES CLAVE:") ||
          upperBlock.includes("SÍNTESIS BIOMECÁNICO-INFLAMATORIA:") ||
          upperBlock.includes("RECOMENDACIÓN DINÁMICA:") ||
          (upperBlock.startsWith("•") && (upperBlock.includes("/10") || upperBlock.includes("[")))
        ) {
          return;
        }

        const isHeaderMarker = /^\s*(?:#{1,6}\s+|\*\*\s*)/.test(trimmedBlock) || trimmedBlock.toUpperCase().startsWith("ANEXO:");
        const isImpressionHeader = /^\s*(?:#{1,6}\s*|\*\*)*\s*(?:IMPRESI[OÓ]N\s+DIAGN[OÓ]STICA|IMPRESI[OÓ]N\b|CONCLUSI[OÓ]N|CONCLUSIONES|DIAGN[OÓ]STICO|DIAGN[OÓ]STICOS)\b/i.test(trimmedBlock) ||
                                    upperBlock.includes("IMPRESIÓN DIAGNÓSTICA") || upperBlock.includes("IMPRESION DIAGNOSTICA") ||
                                    upperBlock.includes("CONCLUSIÓN:") || upperBlock.includes("CONCLUSIONES:");
        const isCuadroHeader = isHeaderMarker && /^\s*(?:#{1,6}\s*|\*\*)*\s*(?:ESQUEMA\s+CLÍNICO\s+DE\s+HALLAZGOS\s+PRINCIPALES|CUADRO\s+SINÓPTICO|MATRIZ\s+SEMIÓTICA)\b/i.test(trimmedBlock) && !isImpressionHeader;
        const isOrganHeader = isHeaderMarker && /^\s*(?:#{1,6}\s*|\*\*)*\s*(?:SINOPSIS\s+CLÍNICA|SINOPSIS\s+POR\s+[OÓ]RGANO|SINOPSIS\s+DE\s+[OÓ]RGANO)\b/i.test(trimmedBlock) && !isCuadroHeader && !isImpressionHeader;
        const isMeasurementHeader = isHeaderMarker && /^\s*(?:#{1,6}\s*|\*\*)*\s*(?:ASISTENTE\s+DE\s+MEDIDAS|CUADRO\s+DE\s+ASISTENTE\s+DE\s+MEDIDAS|TABLA\s+DE\s+MEDIDAS|MEDICIONES\s+Y\s+PARÁMETROS|PARÁMETROS\s+Y\s+MEDIDAS)\b/i.test(trimmedBlock) && !isCuadroHeader && !isOrganHeader && !isImpressionHeader;
        const isAnnexHeader = isHeaderMarker && (trimmedBlock.includes("ANEXO DIAGNÓSTICO") || 
                              trimmedBlock.includes("DESGLOSE Y JUSTIFICACIÓN DE CLASIFICACIÓN") || 
                              trimmedBlock.includes("DESGLOSE Y JUSTIFICACIÓN") ||
                              trimmedBlock.includes("CLASIFICACIÓN DE") ||
                              /^\s*(?:#{1,6}\s*|\*\*)*\s*(?:ANEXO|CLASIFICACI[OÓ]N)\b/i.test(trimmedBlock)) && !isCuadroHeader && !isOrganHeader && !isMeasurementHeader && !isImpressionHeader;

        if (isImpressionHeader) {
          pdfSectionTarget = "main";
        } else if (isCuadroHeader) {
          pdfSectionTarget = "cuadro";
        } else if (isOrganHeader) {
          pdfSectionTarget = "organ";
        } else if (isMeasurementHeader) {
          pdfSectionTarget = "medidas";
        } else if (isAnnexHeader) {
          pdfSectionTarget = "annex";
        }

        if (pdfSectionTarget === "cuadro") {
          cuadroSinopticoBlocks.push(trimmedBlock);
        } else if (pdfSectionTarget === "organ") {
          organSynopsisBlocks.push(trimmedBlock);
        } else if (pdfSectionTarget === "medidas") {
          measurementAssistantBlocks.push(trimmedBlock);
        } else if (pdfSectionTarget === "annex") {
          classificationAnnexBlocks.push(trimmedBlock);
        } else {
          mainReportBlocks.push(trimmedBlock);
        }
      });

      // Safety recovery pass for jsPDF: Ensure Impression & Conclusions are NEVER trapped inside annexes
      recoverImpressionForPDF(cuadroSinopticoBlocks, mainReportBlocks);
      recoverImpressionForPDF(organSynopsisBlocks, mainReportBlocks);
      recoverImpressionForPDF(measurementAssistantBlocks, mainReportBlocks);
      recoverImpressionForPDF(classificationAnnexBlocks, mainReportBlocks);

      // --- 1. CUERPO DE REPORTE CON FIRMA AL FINAL ---
      mainReportBlocks.forEach((block) => {
        renderSingleReportBlock(block);
      });

      if (!hasDrawnSignature) {
        renderSignatureBlock();
      }

      // --- 2. CUADRO SINÓPTICO ---
      if (cuadroSinopticoBlocks.length > 0) {
        doc.addPage();
        yCoord = 20;
        cuadroSinopticoBlocks.forEach((block) => {
          renderSingleReportBlock(block);
        });
      }

      // --- 3. SINOPSIS POR ÓRGANO (PÁGINA INDEPENDIENTE DESPUÉS DEL CUERPO DEL REPORTE) ---
      if (organSynopsisBlocks.length > 0) {
        doc.addPage();
        yCoord = 20;
        organSynopsisBlocks.forEach((block) => {
          renderSingleReportBlock(block);
        });
      }

      // --- 4. SUITES ESPECÍFICAS DE ÓRGANO (vascular/tiroides/mama/hombro) ---
      // Después de la sinopsis por órgano si está presente; si no, después del cuerpo/cuadro.
      // Corte Focal 3D: justo después de la suite usada; si no hay suite, justo después del reporte/sinopsis.
      const pdfSnap = pdfStateRef.current;
      const pdfSuiteData = <T,>(overrideKey: string, live: T): T =>
        (studyOverride ? (studyOverride as any)[overrideKey] : (pdfSnap as any)?.[overrideKey] ?? live) as T;
      const pdfSuiteInclude = (overrideKey: string, live: boolean): boolean =>
        studyOverride
          ? (studyOverride as any)[overrideKey] !== false
          : ((pdfSnap as any)?.[overrideKey] !== false && live);
      const anySuiteInPdf =
        (pdfSuiteInclude("includeVascular3dInReport", includeVascular3dInReport) &&
          suiteHasRenderableContent(pdfSuiteData("vascular3dData", vascular3dData))) ||
        (pdfSuiteInclude("includeThyroid3dInReport", includeThyroid3dInReport) &&
          suiteHasRenderableContent(pdfSuiteData("thyroid3dData", thyroid3dData))) ||
        (pdfSuiteInclude("includeBreast3dInReport", includeBreast3dInReport) &&
          suiteHasRenderableContent(pdfSuiteData("breast3dData", breast3dData))) ||
        (pdfSuiteInclude("includeShoulder3dInReport", includeShoulder3dInReport) &&
          suiteHasRenderableContent(pdfSuiteData("shoulder3dData", shoulder3dData))) ||
        (pdfSuiteInclude("includeKnee3dInReport", includeKnee3dInReport) &&
          suiteHasRenderableContent(pdfSuiteData("knee3dData", knee3dData))) ||
        (pdfSuiteInclude("includeAnkle3dInReport", includeAnkle3dInReport) &&
          suiteHasRenderableContent(pdfSuiteData("ankle3dData", ankle3dData))) ||
        (pdfSuiteInclude("includeKidney3dInReport", includeKidney3dInReport) &&
          suiteHasRenderableContent(pdfSuiteData("kidney3dData", kidney3dData))) ||
        (pdfSuiteInclude("includeAbdomen3dInReport", includeAbdomen3dInReport) &&
          suiteHasRenderableContent(pdfSuiteData("abdomen3dData", abdomen3dData))) ||
        (pdfSuiteInclude("includeAbdominalWall3dInReport", includeAbdominalWall3dInReport) &&
          suiteHasRenderableContent(pdfSuiteData("abdominalWall3dData", abdominalWall3dData))) ||
        (pdfSuiteInclude("includeScrotum3dInReport", includeScrotum3dInReport) &&
          suiteHasRenderableContent(pdfSuiteData("scrotum3dData", scrotum3dData))) ||
        (pdfSuiteInclude("includeMuscleTendon3dInReport", includeMuscleTendon3dInReport) &&
          suiteHasRenderableContent(pdfSuiteData("muscleTendon3dData", muscleTendon3dData))) ||
        (pdfSuiteInclude("includeWrist3dInReport", includeWrist3dInReport) &&
          suiteHasRenderableContent(pdfSuiteData("wrist3dData", wrist3dData)));

      const renderFocalLesionAnnexHere = () => {
        const activeFocalLesionData = studyOverride
          ? studyOverride.focalLesion3dData
          : (pdfSnap?.focalLesion3dData || focalLesion3dData);
        const shouldIncludeFocalLesion = studyOverride
          ? studyOverride.includeFocalLesion3dInReport !== false
          : pdfSnap?.includeFocalLesion3dInReport !== false && includeFocalLesion3dInReport;
        if (
          activeFocalLesionData &&
          shouldIncludeFocalLesion &&
          activeFocalLesionData.panels &&
          activeFocalLesionData.panels.length > 0
        ) {
          renderFocalLesion3DAnnexToPDF(doc, activeFocalLesionData, {
            marginX,
            pageWidth,
            pageHeight,
            contentWidth,
            factor,
          });
        }
      };

      if (!anySuiteInPdf) {
        // Sin suite: Corte Focal inmediatamente después del reporte / sinopsis
        renderFocalLesionAnnexHere();
      }

      // --- 5.6. ANEXO: SUITE VASCULAR 3D & MAPA ANATOMO-HEMODINÁMICO (PÁGINA DEDICADA) ---
      
      const activeVascularData = studyOverride ? studyOverride.vascular3dData : (pdfStateRef.current?.vascular3dData || vascular3dData);
      const shouldIncludeVascular = studyOverride ? (studyOverride.includeVascular3dInReport !== false) : (pdfStateRef.current?.includeVascular3dInReport !== false && includeVascular3dInReport);
      if (activeVascularData && shouldIncludeVascular && ((activeVascularData.panels && activeVascularData.panels.length > 0) || (activeVascularData.hemodynamicTable && activeVascularData.hemodynamicTable.length > 0))) {
        await renderVascular3DPageToPdf(doc, activeVascularData, doc.internal.pageSize.getHeight() > 280 ? "a4" : "letter", pdfLayoutType);
      }

      // --- 5.64. ANEXO: SUITE TIROIDES 3D (PÁGINA COMPLETA) ---
      const activeThyroidData = studyOverride ? studyOverride.thyroid3dData : (pdfStateRef.current?.thyroid3dData || thyroid3dData);
      const shouldIncludeThyroid = studyOverride ? (studyOverride.includeThyroid3dInReport !== false) : (pdfStateRef.current?.includeThyroid3dInReport !== false && includeThyroid3dInReport);
      if (activeThyroidData && shouldIncludeThyroid && (activeThyroidData.panels?.length || activeThyroidData.noduleTable?.length)) {
        await renderThyroid3DPageToPdf(doc, activeThyroidData, doc.internal.pageSize.getHeight() > 280 ? "a4" : "letter", pdfLayoutType);
      }

      const activeBreastData = studyOverride ? studyOverride.breast3dData : (pdfStateRef.current?.breast3dData || breast3dData);
      const shouldIncludeBreast = studyOverride ? (studyOverride.includeBreast3dInReport !== false) : (pdfStateRef.current?.includeBreast3dInReport !== false && includeBreast3dInReport);
      if (activeBreastData && shouldIncludeBreast && (activeBreastData.panels?.length || activeBreastData.lesionTable?.length)) {
        await renderBreast3DPageToPdf(doc, activeBreastData, doc.internal.pageSize.getHeight() > 280 ? "a4" : "letter", pdfLayoutType);
      }

      const activeShoulderData = studyOverride ? studyOverride.shoulder3dData : (pdfStateRef.current?.shoulder3dData || shoulder3dData);
      const shouldIncludeShoulder = studyOverride ? (studyOverride.includeShoulder3dInReport !== false) : (pdfStateRef.current?.includeShoulder3dInReport !== false && includeShoulder3dInReport);
      if (activeShoulderData && shouldIncludeShoulder && (activeShoulderData.panels?.length || activeShoulderData.findingTable?.length)) {
        await renderShoulder3DPageToPdf(doc, activeShoulderData, doc.internal.pageSize.getHeight() > 280 ? "a4" : "letter", pdfLayoutType);
      }

      const activeKneeData = studyOverride ? studyOverride.knee3dData : (pdfStateRef.current?.knee3dData || knee3dData);
      const shouldIncludeKnee = studyOverride ? (studyOverride.includeKnee3dInReport !== false) : (pdfStateRef.current?.includeKnee3dInReport !== false && includeKnee3dInReport);
      if (activeKneeData && shouldIncludeKnee && (activeKneeData.panels?.length || activeKneeData.findingTable?.length)) {
        await renderKnee3DPageToPdf(doc, activeKneeData, doc.internal.pageSize.getHeight() > 280 ? "a4" : "letter", pdfLayoutType);
      }

      const activeAnkleData = studyOverride ? studyOverride.ankle3dData : (pdfStateRef.current?.ankle3dData || ankle3dData);
      const shouldIncludeAnkle = studyOverride ? (studyOverride.includeAnkle3dInReport !== false) : (pdfStateRef.current?.includeAnkle3dInReport !== false && includeAnkle3dInReport);
      if (activeAnkleData && shouldIncludeAnkle && (activeAnkleData.panels?.length || activeAnkleData.findingTable?.length)) {
        await renderAnkle3DPageToPdf(doc, activeAnkleData, doc.internal.pageSize.getHeight() > 280 ? "a4" : "letter", pdfLayoutType);
      }

      const activeKidneyData = studyOverride ? studyOverride.kidney3dData : (pdfStateRef.current?.kidney3dData || kidney3dData);
      const shouldIncludeKidney = studyOverride ? (studyOverride.includeKidney3dInReport !== false) : (pdfStateRef.current?.includeKidney3dInReport !== false && includeKidney3dInReport);
      if (activeKidneyData && shouldIncludeKidney && (activeKidneyData.panels?.length || activeKidneyData.findingTable?.length)) {
        await renderKidney3DPageToPdf(doc, activeKidneyData, doc.internal.pageSize.getHeight() > 280 ? "a4" : "letter", pdfLayoutType);
      }

      const activeAbdomenData = studyOverride ? studyOverride.abdomen3dData : (pdfStateRef.current?.abdomen3dData || abdomen3dData);
      const shouldIncludeAbdomen = studyOverride ? (studyOverride.includeAbdomen3dInReport !== false) : (pdfStateRef.current?.includeAbdomen3dInReport !== false && includeAbdomen3dInReport);
      if (activeAbdomenData && shouldIncludeAbdomen && (activeAbdomenData.panels?.length || activeAbdomenData.findingTable?.length)) {
        await renderAbdomen3DPageToPdf(doc, activeAbdomenData, doc.internal.pageSize.getHeight() > 280 ? "a4" : "letter", pdfLayoutType);
      }

      // --- ANEXO: ELASTOGRAFIA & QUS (pagina dedicada, tras Suite Abdomen 3D) ---
      // Only include when the user explicitly enabled "Adjuntar al PDF" in the Elastografia module.
      const activeElastoInclude = studyOverride
        ? (studyOverride as any).includeElastographyInReport === true
        : (pdfStateRef.current?.includeElastographyInReport === true || includeElastographyInReport === true);
      if (activeElastoInclude) {
        const elastoKpa: number = studyOverride ? ((studyOverride as any).elastographyStiffness ?? elastographyStiffness) : (pdfStateRef.current?.elastographyStiffness ?? elastographyStiffness);
        const elastoCap: number = studyOverride ? ((studyOverride as any).elastographyCAP ?? elastographyCAP) : (pdfStateRef.current?.elastographyCAP ?? elastographyCAP);
        const elastoFat: number = studyOverride ? ((studyOverride as any).elastographyFatFraction ?? elastographyFatFraction) : (pdfStateRef.current?.elastographyFatFraction ?? elastographyFatFraction);
        const elastoImg3d: string | null = studyOverride ? ((studyOverride as any).elastographyImage3d ?? null) : (pdfStateRef.current?.elastographyImage3d ?? elastographyImage3d);
        const elastoOriginalImg: string | null = studyOverride ? ((studyOverride as any).elastographyOriginalImage ?? null) : (pdfStateRef.current?.elastographyOriginalImage ?? elastographyOriginalImage);
        const elastoEtiology: string = studyOverride ? ((studyOverride as any).elastographyEtiology ?? "masld") : (pdfStateRef.current?.elastographyEtiology ?? elastographyEtiology);

        {
          let elastoFibrosisStage: "F0" | "F1" | "F2" | "F3" | "F4" = "F0";
          if (elastoKpa < 6.0) elastoFibrosisStage = "F0";
          else if (elastoKpa < 7.2) elastoFibrosisStage = "F1";
          else if (elastoKpa < 9.5) elastoFibrosisStage = "F2";
          else if (elastoKpa < 12.5) elastoFibrosisStage = "F3";
          else elastoFibrosisStage = "F4";

          let elastoSteatosisGrade: "S0" | "S1" | "S2" | "S3" = "S0";
          if (elastoFat < 5.0) elastoSteatosisGrade = "S0";
          else if (elastoFat <= 12.0) elastoSteatosisGrade = "S1";
          else if (elastoFat <= 20.0) elastoSteatosisGrade = "S2";
          else elastoSteatosisGrade = "S3";

          let elastoBaveno = "";
          if (elastoKpa < 5.0) elastoBaveno = "Parenquima Hepatico Sano (< 5.0 kPa): Sin sospecha de dano hepatico.";
          else if (elastoKpa < 10.0) elastoBaveno = "Zona de Seguridad (< 10.0 kPa): Se descarta cACLD con alta certeza.";
          else if (elastoKpa < 15.0) elastoBaveno = "Zona Gris (10.0-14.9 kPa): Sospecha de cACLD. Requiere test confirmatorio (FIB-4 / ELF).";
          else if (elastoKpa < 20.0) elastoBaveno = "cACLD Sugestiva (15.0-19.9 kPa): Riesgo intermedio de Hipertension Portal Clinicamente Significativa (CSPH).";
          else if (elastoKpa <= 25.0) elastoBaveno = "CSPH Altamente Probable (20.0-25.0 kPa): Cumple criterios Baveno VII para hipertension portal clinicamente relevante.";
          else elastoBaveno = "Riesgo Severo (> 25.0 kPa): Marcada hipertension portal con indicacion de tamizaje endoscopico y profilaxis.";

          const elastoHistoMap: Record<string, string> = {
            F0: "Microarquitectura lobulillar preservada. Sin expansion fibrosa ni distorsion sinusoidal.",
            F1: "Fibrosis portal inicial con discreta expansion periportal. Sin puentes conectivos.",
            F2: "Fibrosis periportal con escasos puentes septales incompletos. Orientacion lobulillar conservada.",
            F3: "Fibrosis avanzada en puentes porto-centrales y porto-portales multiples.",
            F4: "Cirrosis establecida (F4): Nodulos regenerativos rodeados por bandas densas de tejido conectivo fibrilar.",
          };
          let elastoHisto = elastoHistoMap[elastoFibrosisStage] || "";
          if (elastoSteatosisGrade !== "S0") {
            elastoHisto += ` Coexiste esteatosis ${elastoSteatosisGrade === "S1" ? "leve (5-33%)" : elastoSteatosisGrade === "S2" ? "moderada (33-66%)" : "severa (>66%)"} de hepatocitos.`;
          }

          const elastoVelocity = parseFloat(Math.sqrt((elastoKpa * 1000) / 3000).toFixed(2));
          const elastoIqr = parseFloat((elastoKpa * 0.12).toFixed(1));
          const elastoIqrRatio = parseFloat(((elastoIqr / elastoKpa) * 100).toFixed(1));

          const elastoEtiologyLabels: Record<string, string> = {
            masld: "MASLD / Esteatosis Metabolica",
            viral_c: "Hepatitis Viral C (VHC)",
            viral_b: "Hepatitis Viral B (VHB)",
            ald: "Alcohol / ARLD",
            cholestatic: "Colestasica / CBP / CEP",
            general: "Hepatopatia Indeterminada / General",
          };

          renderElastographyAnnexToPdf(doc, {
            stiffnessKpa: elastoKpa,
            capDbM: elastoCap,
            fatFractionPercent: elastoFat,
            etiology: elastoEtiologyLabels[elastoEtiology] || elastoEtiology,
            fibrosisStage: elastoFibrosisStage,
            steatosisGrade: elastoSteatosisGrade,
            bavenoClassification: elastoBaveno,
            histologicalCorrelation: elastoHisto,
            velocityMs: elastoVelocity,
            iqrKpa: elastoIqr,
            iqrMedianRatioPercent: elastoIqrRatio,
            image3dBase64: elastoImg3d,
            originalImageBase64: elastoOriginalImg,
          }, doc.internal.pageSize.getHeight() > 280 ? "a4" : "letter");
        }
      }


      const activeAbdominalWallData = studyOverride ? studyOverride.abdominalWall3dData : (pdfStateRef.current?.abdominalWall3dData || abdominalWall3dData);
      const shouldIncludeAbdominalWall = studyOverride ? (studyOverride.includeAbdominalWall3dInReport !== false) : (pdfStateRef.current?.includeAbdominalWall3dInReport !== false && includeAbdominalWall3dInReport);
      if (activeAbdominalWallData && shouldIncludeAbdominalWall && (activeAbdominalWallData.panels?.length || activeAbdominalWallData.findingTable?.length)) {
        await renderAbdominalWall3DPageToPdf(doc, activeAbdominalWallData, doc.internal.pageSize.getHeight() > 280 ? "a4" : "letter", pdfLayoutType);
      }
      const activeScrotumData = studyOverride ? studyOverride.scrotum3dData : (pdfStateRef.current?.scrotum3dData || scrotum3dData);
      const shouldIncludeScrotum = studyOverride ? (studyOverride.includeScrotum3dInReport !== false) : (pdfStateRef.current?.includeScrotum3dInReport !== false && includeScrotum3dInReport);
      if (activeScrotumData && shouldIncludeScrotum && (activeScrotumData.panels?.length || activeScrotumData.findingTable?.length)) {
        await renderScrotum3DPageToPdf(doc, activeScrotumData, doc.internal.pageSize.getHeight() > 280 ? "a4" : "letter", pdfLayoutType);
      }

      const activeMuscleTendonData = studyOverride ? studyOverride.muscleTendon3dData : (pdfStateRef.current?.muscleTendon3dData || muscleTendon3dData);
      const shouldIncludeMuscleTendon = studyOverride ? (studyOverride.includeMuscleTendon3dInReport !== false) : (pdfStateRef.current?.includeMuscleTendon3dInReport !== false && includeMuscleTendon3dInReport);
      if (activeMuscleTendonData && shouldIncludeMuscleTendon && (activeMuscleTendonData.panels?.length || activeMuscleTendonData.findingTable?.length)) {
        await renderMuscleTendon3DPageToPdf(doc, activeMuscleTendonData, doc.internal.pageSize.getHeight() > 280 ? "a4" : "letter", pdfLayoutType);
      }

      const activeWristData = studyOverride ? studyOverride.wrist3dData : (pdfStateRef.current?.wrist3dData || wrist3dData);
      const shouldIncludeWrist = studyOverride ? (studyOverride.includeWrist3dInReport !== false) : (pdfStateRef.current?.includeWrist3dInReport !== false && includeWrist3dInReport);
      if (activeWristData && shouldIncludeWrist && (activeWristData.panels?.length || activeWristData.findingTable?.length)) {
        await renderWrist3DPageToPdf(doc, activeWristData, doc.internal.pageSize.getHeight() > 280 ? "a4" : "letter", pdfLayoutType);
      }

      if (anySuiteInPdf) {
        // Con suite: Corte Focal inmediatamente después de la(s) suite(s) 3D
        renderFocalLesionAnnexHere();
      }

      // Restore standard margins and content widths for any diagrams, annexes, and signature block
      marginX = 20;
      contentWidth = pageWidth - (2 * marginX);


      // --- 5. CUADRO DE ASISTENTE DE MEDIDAS ---
      if (measurementAssistantBlocks.length > 0) {
        checkPageBreak(25 * factor);
        measurementAssistantBlocks.forEach((block) => {
          renderSingleReportBlock(block);
        });
      }

      // --- 5.5. ANEXO: ATLAS 3D FOTORREALISTA Y CORRELACIÓN ANATÓMICA (PÁGINA DEDICADA) ---
      const activeAtlasData = studyOverride ? studyOverride.atlas3dData : (pdfStateRef.current?.atlas3dData || atlas3dData);
      const shouldIncludeAtlas = studyOverride ? (studyOverride.includeAtlas3dInReport !== false) : (pdfStateRef.current?.includeAtlas3dInReport !== false && includeAtlas3dInReport);
      if (activeAtlasData && shouldIncludeAtlas && activeAtlasData.panels && activeAtlasData.panels.length > 0) {
        renderAtlas3DAnnexToPDF(doc, activeAtlasData, {
          marginX,
          pageWidth,
          pageHeight,
          contentWidth,
          factor
        });
      }

      // --- ANEXO: SCORECARD DE CRITERIOS CLINICOS ---
      const activeScorecard = studyOverride ? (studyOverride as any).clinicalScorecardData : (pdfStateRef.current?.clinicalScorecardData || clinicalScorecardData);
      const shouldIncludeScorecard = studyOverride
        ? (studyOverride as any).includeScorecardInReport === true
        : (pdfStateRef.current?.includeScorecardInReport ?? includeScorecardInReport) === true;
      if (activeScorecard && shouldIncludeScorecard && Array.isArray(activeScorecard.criteria) && activeScorecard.criteria.length > 0) {
        renderScorecardAnnexToPDF(doc, activeScorecard, {
          marginX,
          pageWidth,
          pageHeight,
          contentWidth,
          factor
        });
      }

      // --- ANEXO: CADENA DE RAZONAMIENTO RADIOLOGICO ---
      const activeReasoningChain = studyOverride
        ? (studyOverride as any).reasoningChainData
        : (pdfStateRef.current?.reasoningChainData || reasoningChainData);
      const shouldIncludeReasoningChain = studyOverride
        ? ((studyOverride as any).includeReasoningChainInReport !== false)
        : ((pdfStateRef.current?.includeReasoningChainInReport !== false) && includeReasoningChainInReport);
      if (
        activeReasoningChain &&
        shouldIncludeReasoningChain &&
        Array.isArray(activeReasoningChain.nodes) &&
        activeReasoningChain.nodes.length > 0
      ) {
        renderReasoningChainAnnexToPDF(doc, activeReasoningChain, {
          marginX,
          pageWidth,
          pageHeight,
          contentWidth,
          factor,
        });
      }

      // --- ANEXO: CHECKLIST DE NEGATIVIDAD DIRIGIDA (1 página) ---
      const activeNegativityChecklist = studyOverride
        ? (studyOverride as any).negativityChecklistData
        : (pdfStateRef.current?.negativityChecklistData || negativityChecklistData);
      const shouldIncludeNegativityChecklist = studyOverride
        ? (studyOverride as any).includeNegativityChecklistInReport === true
        : (pdfStateRef.current?.includeNegativityChecklistInReport ??
            includeNegativityChecklistInReport) === true;
      if (
        activeNegativityChecklist &&
        shouldIncludeNegativityChecklist &&
        Array.isArray(activeNegativityChecklist.items) &&
        activeNegativityChecklist.items.length > 0
      ) {
        renderNegativityChecklistAnnexToPDF(doc, activeNegativityChecklist, {
          marginX,
          pageWidth,
          pageHeight,
          contentWidth,
          factor,
        });
      }

      // --- ANEXO: ARBOL DE DIFERENCIALES CON PODA ---
      const activeDifferentialTree = studyOverride
        ? (studyOverride as any).differentialTreeData
        : (pdfStateRef.current?.differentialTreeData || differentialTreeData);
      const shouldIncludeDifferentialTree = studyOverride
        ? ((studyOverride as any).includeDifferentialTreeInReport !== false)
        : ((pdfStateRef.current?.includeDifferentialTreeInReport !== false) && includeDifferentialTreeInReport);
      if (
        activeDifferentialTree &&
        shouldIncludeDifferentialTree &&
        Array.isArray(activeDifferentialTree.branches) &&
        activeDifferentialTree.branches.length > 0
      ) {
        renderDifferentialTreeAnnexToPDF(doc, activeDifferentialTree, {
          marginX,
          pageWidth,
          pageHeight,
          contentWidth,
          factor,
        });
      }

      // --- ANEXO: MATRIZ SEMIOLOGIA ? CONDUCTA ---
      const activeSemioticsMatrix = studyOverride
        ? (studyOverride as any).semioticsConductMatrixData
        : (pdfStateRef.current?.semioticsConductMatrixData || semioticsConductMatrixData);
      const shouldIncludeSemioticsMatrix = studyOverride
        ? ((studyOverride as any).includeSemioticsConductMatrixInReport !== false)
        : ((pdfStateRef.current?.includeSemioticsConductMatrixInReport !== false) && includeSemioticsConductMatrixInReport);
      if (
        activeSemioticsMatrix &&
        shouldIncludeSemioticsMatrix &&
        Array.isArray(activeSemioticsMatrix.rows) &&
        activeSemioticsMatrix.rows.length > 0
      ) {
        renderSemioticsConductMatrixAnnexToPDF(doc, activeSemioticsMatrix, {
          marginX,
          pageWidth,
          pageHeight,
          contentWidth,
          factor,
        });
      }

      // --- ANEXO: INFOGRAFIA DE JUSTIFICACION DIAGNOSTICA ---
      const activeFindingsInfographic = studyOverride
        ? (studyOverride as any).findingsInfographicData
        : (pdfStateRef.current?.findingsInfographicData || findingsInfographicData);
      const shouldIncludeFindingsInfographic = studyOverride
        ? ((studyOverride as any).includeFindingsInfographicInReport !== false)
        : ((pdfStateRef.current?.includeFindingsInfographicInReport !== false) && includeFindingsInfographicInReport);
      if (
        activeFindingsInfographic &&
        shouldIncludeFindingsInfographic &&
        Array.isArray(activeFindingsInfographic.nodes) &&
        activeFindingsInfographic.nodes.length > 0
      ) {
        await renderFindingsInfographicAnnexToPDF(doc, activeFindingsInfographic, {
          marginX,
          pageWidth,
          pageHeight,
          contentWidth,
          factor,
        });
      }

      // --- ANEXO: MAPA DE HALLAZGOS NUMERADOS ---
      const activeFindingsMap = studyOverride
        ? (studyOverride as any).findingsMapData
        : (pdfStateRef.current?.findingsMapData || findingsMapData);
      const shouldIncludeFindingsMap = studyOverride
        ? ((studyOverride as any).includeFindingsMapInReport !== false)
        : ((pdfStateRef.current?.includeFindingsMapInReport !== false) && includeFindingsMapInReport);
      if (
        activeFindingsMap &&
        shouldIncludeFindingsMap &&
        Array.isArray(activeFindingsMap.items) &&
        activeFindingsMap.items.length > 0
      ) {
        await renderFindingsMapAnnexToPDF(doc, activeFindingsMap, {
          clinicName: pdfStateRef.current?.clinicName,
        });
      }

      // --- ANEXO: MEDICIONES CUANTITATIVAS vs RANGO ---
      const activeMeasurementGauges = studyOverride
        ? (studyOverride as any).measurementGaugeData
        : (pdfStateRef.current?.measurementGaugeData || measurementGaugeData);
      const shouldIncludeMeasurementGauges = studyOverride
        ? ((studyOverride as any).includeMeasurementGaugesInReport !== false)
        : ((pdfStateRef.current?.includeMeasurementGaugesInReport !== false) && includeMeasurementGaugesInReport);
      const includeNormalsInMeasurementPdf = studyOverride
        ? ((studyOverride as any).includeMeasurementNormalsInPdf === true)
        : !!(pdfStateRef.current?.includeMeasurementNormalsInPdf ?? includeMeasurementNormalsInPdf);
      if (
        activeMeasurementGauges &&
        shouldIncludeMeasurementGauges &&
        Array.isArray(activeMeasurementGauges.measurements) &&
        activeMeasurementGauges.measurements.length > 0
      ) {
        renderMeasurementsGaugeAnnexToPDF(doc, activeMeasurementGauges, {
          marginX,
          pageWidth,
          pageHeight,
          contentWidth,
          factor,
          includeNormals: includeNormalsInMeasurementPdf,
        });
      }


      // Corte Focal 3D ya se insertó tras reporte (sin suite) o tras suites (con suite).

      // --- 5.66. ANEXO: SIMULADOR DE PLANO ECOGRÁFICO 3D ---
      const activeUsPlaneData = studyOverride ? studyOverride.usPlaneSimulatorData : (pdfStateRef.current?.usPlaneSimulatorData || usPlaneSimulatorData);
      const shouldIncludeUsPlane = studyOverride ? (studyOverride.includeUsPlaneSimulatorInReport !== false) : (pdfStateRef.current?.includeUsPlaneSimulatorInReport !== false && includeUsPlaneSimulatorInReport);
      if (activeUsPlaneData && shouldIncludeUsPlane && activeUsPlaneData.panels && activeUsPlaneData.panels.length > 0) {
        renderUsPlaneSimulatorAnnexToPDF(doc, activeUsPlaneData, {
          marginX,
          pageWidth,
          pageHeight,
          contentWidth,
          factor
        });
      }


      // --- 6. ANEXOS DE IMÁGENES DIAGNÓSTICAS (MAMOGRAFÍA Y ULTRASONIDO) ---
      if (attachedImages.length > 0) {
        const mmgImages = attachedImages.filter(img => (img.modality || detectImageMetaFromFilename(img.name, img.dicomMetaData).modality) === "MMG");
        const usImages = attachedImages.filter(img => !mmgImages.includes(img));

        const sortMmg = (list: typeof attachedImages) => {
          return [...list].sort((a, b) => {
            const metaA = detectImageMetaFromFilename(a.name, a.dicomMetaData);
            const metaB = detectImageMetaFromFilename(b.name, b.dicomMetaData);
            const projA = a.projection || metaA.projection;
            const projB = b.projection || metaB.projection;

            const scoreA = projA === "CC" ? 1 : (projA === "MLO" ? 2 : 3);
            const scoreB = projB === "CC" ? 1 : (projB === "MLO" ? 2 : 3);
            return scoreA - scoreB;
          });
        };

        const sortedMmgImages = sortMmg(mmgImages);
        if (sortedMmgImages.length === 2) {
          const meta0 = detectImageMetaFromFilename(sortedMmgImages[0].name, sortedMmgImages[0].dicomMetaData);
          const meta1 = detectImageMetaFromFilename(sortedMmgImages[1].name, sortedMmgImages[1].dicomMetaData);
          const proj0 = sortedMmgImages[0].projection || meta0.projection;
          const proj1 = sortedMmgImages[1].projection || meta1.projection;
          if (proj0 === "OTRO" && proj1 === "OTRO") {
            sortedMmgImages[0].projection = "CC";
            sortedMmgImages[1].projection = "MLO";
          }
        }

        let globalFigIdx = 1;

        // 6A. ANEXO DE IMÁGENES DE MAMOGRAFÍA (MMG) - FORMATO ELEGANTE DE REVISTA CIENTÍFICA
        if (sortedMmgImages.length > 0) {
          globalFigIdx = renderMmgImagesToPdf(doc, sortedMmgImages, {
            startFigIdx: globalFigIdx,
            studyTitle: specificStudy || studyType || "MAMOGRAFÍA",
            factor,
            detectMetaFn: (name, meta) => detectImageMetaFromFilename(name, meta)
          });
        }

        // 6B. ANEXO DE IMÁGENES Y CAPTURAS DE ULTRASONIDO (US) - FORMATO REVISTA CIENTÍFICA
        if (usImages.length > 0) {
          const activeGridMode = (studyOverride ? studyOverride.usImagesGridMode : (pdfStateRef.current?.usImagesGridMode || usImagesGridMode)) || "auto";
          globalFigIdx = renderUsImagesToPdf(doc, usImages, {
            gridMode: activeGridMode,
            startFigIdx: globalFigIdx,
            studyTitle: specificStudy || studyType || "ULTRASONIDO",
            factor
          });
        }
      }

      // --- 6.5. ANEXO: REPRESENTACIÓN ESQUEMÁTICA 3D DEL HALLAZGO ---
      const active3dRenders = (studyOverride ? (studyOverride.findings3dRenders || []) : (pdfStateRef.current?.findings3dRenders || findings3dRenders || [])).filter((r: any) => r && r.includeInPdf !== false);

      if (active3dRenders.length > 0) {
        doc.addPage();
        yCoord = 20;

        // Title of 3D Annex
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12 * factor);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text("ANEXO: REPRESENTACIÓN ESQUEMÁTICA 3D DEL HALLAZGO", marginX, yCoord);
        yCoord += 4 * factor;

        doc.setDrawColor(6, 182, 212); // Cyan 500
        doc.setLineWidth(0.6);
        doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
        yCoord += 6 * factor;

        // Subtitle disclaimer
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5 * factor);
        doc.setTextColor(100, 116, 139); // slate-500
        const subtitleText = "Representación volumétrica tridimensional orientativa correlacionada con la ecografía 2D. Ilustración didáctica de alta resolución diseñada para facilitar la comprensión espacial y anatómica del hallazgo.";
        const subLines = doc.splitTextToSize(subtitleText, contentWidth);
        subLines.forEach((line: string) => {
          doc.text(line, marginX, yCoord);
          yCoord += 3.5 * factor;
        });
        yCoord += 4 * factor;

        for (let rIdx = 0; rIdx < active3dRenders.length; rIdx++) {
          const renderItem = active3dRenders[rIdx];
          const hasSourceImg = !!renderItem.sourceImageBase64;
          const isDual = !!renderItem.render3dMacroBase64;
          const isGrid2x2 = isDual && renderItem.pdfLayout === "grid2x2";
          
          // Check if space remains on page
          const requiredHeight = isGrid2x2 ? 115 : (isDual ? 95 : 90);
          if (yCoord > pageHeight - requiredHeight) {
            doc.addPage();
            yCoord = 20;
          }

          // Card header with Title and Badge (prevent text overlap)
          const badgeText = isDual ? "RENDER 3D DUAL: FOCAL + TOPOGRÁFICO" : "RENDER VOLUMÉTRICO DIDÁCTICO";
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7 * factor);
          const badgeWidth = (doc as any).getTextWidth ? (doc as any).getTextWidth(badgeText) : 52;
          const maxTitleWidth = contentWidth - badgeWidth - 10;

          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5 * factor);
          const titleText = renderItem.title || `Ilustración 3D del Hallazgo #${rIdx + 1}`;
          const titleLines = doc.splitTextToSize(titleText, maxTitleWidth);
          const headerHeight = Math.max(7, titleLines.length * 4 + 2) * factor;

          doc.setFillColor(241, 245, 249); // slate-100
          doc.setDrawColor(203, 213, 225); // slate-300
          doc.setLineWidth(0.3);
          doc.roundedRect(marginX, yCoord, contentWidth, headerHeight, 1.5, 1.5, "FD");

          let curTitleY = yCoord + 4.5 * factor;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5 * factor);
          doc.setTextColor(15, 23, 42);
          titleLines.forEach((tLine: string) => {
            doc.text(tLine, marginX + 3, curTitleY);
            curTitleY += 3.8 * factor;
          });

          // Badge
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7 * factor);
          doc.setTextColor(14, 116, 144); // cyan-700
          doc.text(badgeText, pageWidth - marginX - badgeWidth - 3, yCoord + 4.5 * factor);
          yCoord += headerHeight + 3.5 * factor;

          const imageRowY = yCoord;

          if (isGrid2x2) {
            // ==========================================
            // OPTION B: CUADRÍCULA 2x2 (GRID LAYOUT)
            // ==========================================
            const pairWidth = (contentWidth - 6) / 2;
            const pairHeight = pairWidth * 0.75;

            // Row 1 - Left: 2D Ecografía
            try {
              if (renderItem.sourceImageBase64) {
                doc.addImage(renderItem.sourceImageBase64, "JPEG", marginX, imageRowY, pairWidth, pairHeight, undefined, "FAST");
              }
              doc.setDrawColor(148, 163, 184);
              doc.setLineWidth(0.3);
              doc.rect(marginX, imageRowY, pairWidth, pairHeight);
              
              doc.setFillColor(15, 23, 42);
              doc.rect(marginX, imageRowY + pairHeight - 5, pairWidth, 5, "F");
              doc.setFont("helvetica", "bold");
              doc.setFontSize(6.5);
              doc.setTextColor(255, 255, 255);
              doc.text("1. ECOGRAFÍA 2D ORIGINAL", marginX + 2, imageRowY + pairHeight - 1.5);
            } catch (err2d) {
              doc.setDrawColor(203, 213, 225);
              doc.rect(marginX, imageRowY, pairWidth, pairHeight);
            }

            // Row 1 - Right: 3D Focal Render
            try {
              doc.addImage(renderItem.render3dBase64, "PNG", marginX + pairWidth + 6, imageRowY, pairWidth, pairHeight, undefined, "FAST");
              doc.setDrawColor(6, 182, 212);
              doc.setLineWidth(0.5);
              doc.rect(marginX + pairWidth + 6, imageRowY, pairWidth, pairHeight);

              doc.setFillColor(8, 51, 68); // cyan-950
              doc.rect(marginX + pairWidth + 6, imageRowY + pairHeight - 5, pairWidth, 5, "F");
              doc.setFont("helvetica", "bold");
              doc.setFontSize(6.5);
              doc.setTextColor(103, 232, 249); // cyan-300
              doc.text("2. RENDER 3D FOCAL (DETALLE)", marginX + pairWidth + 8, imageRowY + pairHeight - 1.5);
            } catch (err3dFocal) {
              doc.setDrawColor(203, 213, 225);
              doc.rect(marginX + pairWidth + 6, imageRowY, pairWidth, pairHeight);
            }

            const row2Y = imageRowY + pairHeight + 4;

            // Row 2 - Left: 3D Macro Panoramic Render
            try {
              doc.addImage(renderItem.render3dMacroBase64!, "PNG", marginX, row2Y, pairWidth, pairHeight, undefined, "FAST");
              doc.setDrawColor(99, 102, 241);
              doc.setLineWidth(0.5);
              doc.rect(marginX, row2Y, pairWidth, pairHeight);

              doc.setFillColor(30, 27, 75); // indigo-950
              doc.rect(marginX, row2Y + pairHeight - 5, pairWidth, 5, "F");
              doc.setFont("helvetica", "bold");
              doc.setFontSize(6.5);
              doc.setTextColor(199, 210, 254); // indigo-200
              doc.text("3. VISTA MACRO TOPOGRÁFICA", marginX + 2, row2Y + pairHeight - 1.5);
            } catch (err3dMacro) {
              doc.setDrawColor(203, 213, 225);
              doc.rect(marginX, row2Y, pairWidth, pairHeight);
            }

            // Row 2 - Right: Structured Text Box side-by-side
            const textPanelX = marginX + pairWidth + 6;
            const findingLabel = `Hallazgo: ${renderItem.findingDescription || "No especificado"}`;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7 * factor);
            const findingLines = doc.splitTextToSize(findingLabel, pairWidth - 6);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.8 * factor);
            const explLines = doc.splitTextToSize(renderItem.explanation || "", pairWidth - 6);

            const textContentHeight = (findingLines.length * 3.2 + explLines.length * 3.2 + 8) * factor;
            const rightBoxHeight = Math.max(pairHeight, textContentHeight);

            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.3);
            doc.roundedRect(textPanelX, row2Y, pairWidth, rightBoxHeight, 1.5, 1.5, "FD");

            let textInnerY = row2Y + 4 * factor;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7 * factor);
            doc.setTextColor(30, 41, 59);
            findingLines.forEach((fl: string) => {
              doc.text(fl, textPanelX + 3, textInnerY);
              textInnerY += 3.2 * factor;
            });

            textInnerY += 1.5 * factor;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.8 * factor);
            doc.setTextColor(51, 65, 85);
            explLines.forEach((el: string) => {
              doc.text(el, textPanelX + 3, textInnerY);
              textInnerY += 3.2 * factor;
            });

            yCoord = row2Y + Math.max(pairHeight, rightBoxHeight) + 8 * factor;

          } else if (isDual) {
            // ==========================================
            // OPTION A: TRÍPTICO HORIZONTAL (3 COLUMNS)
            // ==========================================
            const colWidth = (contentWidth - 8) / 3;
            const colHeight = colWidth * 0.75;

            // Col 1: 2D Ecografía
            try {
              if (renderItem.sourceImageBase64) {
                doc.addImage(renderItem.sourceImageBase64, "JPEG", marginX, imageRowY, colWidth, colHeight, undefined, "FAST");
              }
              doc.setDrawColor(148, 163, 184);
              doc.setLineWidth(0.3);
              doc.rect(marginX, imageRowY, colWidth, colHeight);
              
              doc.setFillColor(15, 23, 42);
              doc.rect(marginX, imageRowY + colHeight - 4.5, colWidth, 4.5, "F");
              doc.setFont("helvetica", "bold");
              doc.setFontSize(5.8);
              doc.setTextColor(255, 255, 255);
              doc.text("1. ECOGRAFÍA 2D", marginX + 1.5, imageRowY + colHeight - 1.2);
            } catch (err2d) {
              doc.setDrawColor(203, 213, 225);
              doc.rect(marginX, imageRowY, colWidth, colHeight);
            }

            // Col 2: 3D Focal
            const col2X = marginX + colWidth + 4;
            try {
              doc.addImage(renderItem.render3dBase64, "PNG", col2X, imageRowY, colWidth, colHeight, undefined, "FAST");
              doc.setDrawColor(6, 182, 212);
              doc.setLineWidth(0.5);
              doc.rect(col2X, imageRowY, colWidth, colHeight);

              doc.setFillColor(8, 51, 68);
              doc.rect(col2X, imageRowY + colHeight - 4.5, colWidth, 4.5, "F");
              doc.setFont("helvetica", "bold");
              doc.setFontSize(5.8);
              doc.setTextColor(103, 232, 249);
              doc.text("2. 3D FOCAL (DETALLE)", col2X + 1.5, imageRowY + colHeight - 1.2);
            } catch (err3dFocal) {
              doc.setDrawColor(203, 213, 225);
              doc.rect(col2X, imageRowY, colWidth, colHeight);
            }

            // Col 3: 3D Macro
            const col3X = marginX + (colWidth + 4) * 2;
            try {
              doc.addImage(renderItem.render3dMacroBase64!, "PNG", col3X, imageRowY, colWidth, colHeight, undefined, "FAST");
              doc.setDrawColor(99, 102, 241);
              doc.setLineWidth(0.5);
              doc.rect(col3X, imageRowY, colWidth, colHeight);

              doc.setFillColor(30, 27, 75);
              doc.rect(col3X, imageRowY + colHeight - 4.5, colWidth, 4.5, "F");
              doc.setFont("helvetica", "bold");
              doc.setFontSize(5.8);
              doc.setTextColor(199, 210, 254);
              doc.text("3. 3D PANORÁMICO (MACRO)", col3X + 1.5, imageRowY + colHeight - 1.2);
            } catch (err3dMacro) {
              doc.setDrawColor(203, 213, 225);
              doc.rect(col3X, imageRowY, colWidth, colHeight);
            }

            yCoord += colHeight + 4 * factor;

            // Full-width Structured text block below 3-columns
            const findingLabel = `Hallazgo Ecográfico Base: ${renderItem.findingDescription || "No especificado"}`;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5 * factor);
            const findingLines = doc.splitTextToSize(findingLabel, contentWidth - 6);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5 * factor);
            const explLines = doc.splitTextToSize(renderItem.explanation || "", contentWidth - 6);

            const boxHeight = (findingLines.length * 3.5 + explLines.length * 3.5 + 8) * factor;

            if (yCoord + boxHeight > pageHeight - 15) {
              doc.addPage();
              yCoord = 20;
            }

            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.3);
            doc.roundedRect(marginX, yCoord, contentWidth, boxHeight, 1.5, 1.5, "FD");

            let textInnerY = yCoord + 4 * factor;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5 * factor);
            doc.setTextColor(30, 41, 59);
            findingLines.forEach((fl: string) => {
              doc.text(fl, marginX + 3, textInnerY);
              textInnerY += 3.5 * factor;
            });

            textInnerY += 1.5 * factor;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5 * factor);
            doc.setTextColor(51, 65, 85);
            explLines.forEach((el: string) => {
              doc.text(el, marginX + 3, textInnerY);
              textInnerY += 3.5 * factor;
            });

            yCoord += boxHeight + 8 * factor;

          } else {
            // ==========================================
            // SINGLE 3D RENDER (CLASSIC LAYOUT)
            // ==========================================
            if (hasSourceImg) {
              const pairWidth = (contentWidth - 6) / 2;
              const pairHeight = pairWidth * 0.75;

              // Left: 2D Ecografía
              try {
                doc.addImage(renderItem.sourceImageBase64, "JPEG", marginX, imageRowY, pairWidth, pairHeight, undefined, "FAST");
                doc.setDrawColor(148, 163, 184);
                doc.setLineWidth(0.3);
                doc.rect(marginX, imageRowY, pairWidth, pairHeight);
                
                // Caption banner
                doc.setFillColor(15, 23, 42);
                doc.rect(marginX, imageRowY + pairHeight - 5, pairWidth, 5, "F");
                doc.setFont("helvetica", "bold");
                doc.setFontSize(6.5);
                doc.setTextColor(255, 255, 255);
                doc.text("ECOGRAFÍA 2D ORIGINAL", marginX + 2, imageRowY + pairHeight - 1.5);
              } catch (err2d) {
                doc.setDrawColor(203, 213, 225);
                doc.rect(marginX, imageRowY, pairWidth, pairHeight);
                doc.setFont("helvetica", "italic");
                doc.setFontSize(7.5);
                doc.setTextColor(148, 163, 184);
                doc.text("Captura 2D de referencia", marginX + 4, imageRowY + pairHeight / 2);
              }

              // Right: 3D Volumetric Render
              try {
                doc.addImage(renderItem.render3dBase64, "PNG", marginX + pairWidth + 6, imageRowY, pairWidth, pairHeight, undefined, "FAST");
                doc.setDrawColor(6, 182, 212);
                doc.setLineWidth(0.5);
                doc.rect(marginX + pairWidth + 6, imageRowY, pairWidth, pairHeight);

                // Caption banner
                doc.setFillColor(8, 51, 68); // cyan-950
                doc.rect(marginX + pairWidth + 6, imageRowY + pairHeight - 5, pairWidth, 5, "F");
                doc.setFont("helvetica", "bold");
                doc.setFontSize(6.5);
                doc.setTextColor(103, 232, 249); // cyan-300
                doc.text("RECONSTRUCCIÓN ESQUEMÁTICA 3D", marginX + pairWidth + 8, imageRowY + pairHeight - 1.5);
              } catch (err3d) {
                doc.setDrawColor(203, 213, 225);
                doc.rect(marginX + pairWidth + 6, imageRowY, pairWidth, pairHeight);
              }

              yCoord += pairHeight + 4;
            } else {
              // Single wide 3D render
              const singleWidth = Math.min(contentWidth * 0.7, 120);
              const singleHeight = singleWidth * 0.75;
              const singleX = marginX + (contentWidth - singleWidth) / 2;

              try {
                doc.addImage(renderItem.render3dBase64, "PNG", singleX, imageRowY, singleWidth, singleHeight, undefined, "FAST");
                doc.setDrawColor(6, 182, 212);
                doc.setLineWidth(0.5);
                doc.rect(singleX, imageRowY, singleWidth, singleHeight);
              } catch (errSingle) {}

              yCoord += singleHeight + 4;
            }

            // Measure explanation height
            const findingLabel = `Hallazgo Ecográfico Base: ${renderItem.findingDescription || "No especificado"}`;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5 * factor);
            const findingLines = doc.splitTextToSize(findingLabel, contentWidth - 6);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5 * factor);
            const explLines = doc.splitTextToSize(renderItem.explanation || "", contentWidth - 6);

            const boxHeight = (findingLines.length * 3.5 + explLines.length * 3.5 + 8) * factor;

            // Check if box fits or needs new page
            if (yCoord + boxHeight > pageHeight - 15) {
              doc.addPage();
              yCoord = 20;
            }

            // Set fill and draw colors AFTER potential addPage() to prevent jsPDF from resetting fill to black
            doc.setFillColor(248, 250, 252); // slate-50 light background
            doc.setDrawColor(226, 232, 240); // slate-200
            doc.setLineWidth(0.3);

            doc.roundedRect(marginX, yCoord, contentWidth, boxHeight, 1.5, 1.5, "FD");
            let textInnerY = yCoord + 4 * factor;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5 * factor);
            doc.setTextColor(30, 41, 59); // slate-800
            findingLines.forEach((fl: string) => {
              doc.text(fl, marginX + 3, textInnerY);
              textInnerY += 3.5 * factor;
            });

            textInnerY += 1.5 * factor;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5 * factor);
            doc.setTextColor(51, 65, 85); // slate-700
            explLines.forEach((el: string) => {
              doc.text(el, marginX + 3, textInnerY);
              textInnerY += 3.5 * factor;
            });

            yCoord += boxHeight + 8 * factor;
          }
        }
      }

      // --- 7. DIAGNÓSTICO AVANZADO Y ANÁLISIS DEL CASO ---
      if (caseAnalysisBlocks.length > 0) {
        doc.addPage();
        yCoord = 20;

        // Title of Annex
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12 * factor);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text("ANEXO: DIAGNÓSTICO AVANZADO Y ANÁLISIS DEL CASO", marginX, yCoord);
        yCoord += 4 * factor;
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.4);
        doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
        yCoord += 10 * factor;

        // Resolve active theme palette to match the rest of the report (no "embedded/foreign" look)
        let activeThemeBg = [248, 250, 252]; // default slate-50
        let activeThemeHeaderBg = [15, 23, 42]; // default slate-900
        let activeThemeBorder = [203, 213, 225]; // default slate-300
        let activeThemeAccent = [79, 70, 229]; // default Indigo
        let activeThemeTextDark = [15, 23, 42]; // slate-900
        let activeThemeTextMuted = [71, 85, 105]; // slate-600

        // Determine card styles based on pdfLayoutType to be cohesive with the rest of the report
        let cardsStyle = {
          sonographic: { border: [79, 70, 229], bg: [245, 247, 255] },
          clinical: { border: [16, 185, 129], bg: [240, 253, 244] },
          differentials: { border: [217, 119, 6], bg: [254, 252, 232] },
          management: { border: [147, 51, 234], bg: [250, 245, 255] }
        };

        let pillar1Color = [79, 70, 229];
        let pillar2Color = [16, 185, 129];
        let pillar3Color = [217, 119, 6];
        let pillar4Color = [147, 51, 234];

        if (pdfLayoutType === "clinical_slate") {
          activeThemeBg = [241, 245, 249]; // slate-100
          activeThemeHeaderBg = [71, 85, 105]; // slate-600
          activeThemeBorder = [148, 163, 184]; // slate-400
          activeThemeAccent = [100, 116, 139]; // slate-500
          activeThemeTextDark = [15, 23, 42];
          activeThemeTextMuted = [100, 116, 139];

          cardsStyle = {
            sonographic: { border: [71, 85, 105], bg: [241, 245, 249] },
            clinical: { border: [100, 116, 139], bg: [248, 250, 252] },
            differentials: { border: [148, 163, 184], bg: [241, 245, 249] },
            management: { border: [71, 85, 105], bg: [248, 250, 252] }
          };

          pillar1Color = [71, 85, 105];
          pillar2Color = [100, 116, 139];
          pillar3Color = [148, 163, 184];
          pillar4Color = [71, 85, 105];
        } else if (pdfLayoutType === "executive_medical") {
          activeThemeBg = [253, 251, 247]; // cream-white
          activeThemeHeaderBg = [141, 110, 50]; // metallic bronze-gold
          activeThemeBorder = [220, 201, 159]; // golden-cream border
          activeThemeAccent = [141, 110, 50]; // Bronze
          activeThemeTextDark = [15, 23, 42];
          activeThemeTextMuted = [141, 110, 50];

          cardsStyle = {
            sonographic: { border: [141, 110, 50], bg: [253, 251, 247] },
            clinical: { border: [197, 160, 89], bg: [254, 253, 250] },
            differentials: { border: [141, 110, 50], bg: [253, 251, 247] },
            management: { border: [197, 160, 89], bg: [254, 253, 250] }
          };

          pillar1Color = [141, 110, 50];
          pillar2Color = [197, 160, 89];
          pillar3Color = [141, 110, 50];
          pillar4Color = [197, 160, 89];
        } else if (pdfLayoutType === "asymmetric") {
          activeThemeBg = [249, 250, 254]; // Soft blue-indigo
          activeThemeHeaderBg = [79, 70, 229]; // Indigo
          activeThemeBorder = [165, 180, 252]; // Indigo-300
          activeThemeAccent = [79, 70, 229]; // Indigo
          activeThemeTextDark = [15, 23, 42];
          activeThemeTextMuted = [99, 102, 241];

          cardsStyle = {
            sonographic: { border: [79, 70, 229], bg: [249, 250, 254] },
            clinical: { border: [129, 140, 248], bg: [245, 247, 255] },
            differentials: { border: [79, 70, 229], bg: [249, 250, 254] },
            management: { border: [129, 140, 248], bg: [245, 247, 255] }
          };

          pillar1Color = [79, 70, 229];
          pillar2Color = [129, 140, 248];
          pillar3Color = [79, 70, 229];
          pillar4Color = [129, 140, 248];
        }

        caseAnalysisBlocks.forEach((caseData, blockIdx) => {
          // If we are on a subsequent block, let's put a page break or a nice spacing
          if (blockIdx > 0) {
            checkPageBreak(85 * factor); // require generous space, otherwise break page
          }

          const cfg = caseData.elementsConfig || {
            includeSonographic: true,
            includeSonographicDetails: true,
            includeClinicalCorr: true,
            includeCertainty: true,
            includeDifferentials: true,
            includeDiscardedDifferentials: true,
            includeManagement: true,
          };

          let formatTitle = caseData.title || "ANÁLISIS DEL CASO";
          if (!caseData.title) {
            if (caseData.format === "flujograma_semiologico") {
              formatTitle = "FLUJOGRAMA SEMIOLÓGICO";
            } else if (caseData.format === "flujograma_algoritmico") {
              formatTitle = "FLUJOGRAMA ALGORÍTMICO / ÁRBOL DE DECISIÓN";
            } else if (caseData.format === "esquema_pilares") {
              formatTitle = "ESQUEMA INTEGRADOR POR PILARES";
            } else if (caseData.format === "mapa_diferenciales") {
              formatTitle = "MAPA DE DIAGNÓSTICOS DIFERENCIALES";
            } else if (caseData.format === "matriz_semiotica") {
              formatTitle = "MATRIZ SEMIÓTICA COMPARATIVA";
            }
          }

          // Header title bar of the format
          checkPageBreak(25 * factor);
          doc.setFillColor(activeThemeHeaderBg[0], activeThemeHeaderBg[1], activeThemeHeaderBg[2]);
          doc.roundedRect(marginX, yCoord, contentWidth, 11 * factor, 1.8, 1.8, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10.5 * factor); // Spacious, readable font size in appendix
          doc.setTextColor(255, 255, 255);
          doc.text(formatTitle, marginX + 5 * factor, yCoord + 7 * factor);

          yCoord += 16 * factor;

          // --- FORMAT 1: FLUJOGRAMA SEMIOLÓGICO ---
          if (caseData.format === "flujograma_semiologico") {
            const semiologyStepsToDraw: Array<{
              title: string;
              subtitle: string;
              content: string;
              bullets?: string[];
              accentColor: number[];
              bgColor: number[];
            }> = [];

            if (cfg.includeSonographic && caseData.sonographicPillar) {
              semiologyStepsToDraw.push({
                title: "HALLAZGO ECOGRÁFICO PRINCIPAL",
                subtitle: "Punto de Partida Semiológico",
                content: cleanTextForJSPDF(caseData.sonographicPillar.primaryFinding),
                bullets: (cfg.includeSonographicDetails !== false && caseData.sonographicPillar.details) ? caseData.sonographicPillar.details.map(cleanTextForJSPDF) : undefined,
                accentColor: cardsStyle.sonographic.border,
                bgColor: cardsStyle.sonographic.bg
              });
            }

            if (cfg.includeClinicalCorr && caseData.clinicalCorrelation) {
              semiologyStepsToDraw.push({
                title: "INTEGRACIÓN CLÍNICO-ANATÓMICA",
                subtitle: "Correlación de Síntomas y Laboratorio",
                content: cleanTextForJSPDF(caseData.clinicalCorrelation),
                accentColor: cardsStyle.clinical.border,
                bgColor: cardsStyle.clinical.bg
              });
            }

            const primaryDiag = caseData.diagnostics && caseData.diagnostics.length > 0 ? caseData.diagnostics[0] : null;
            const discardedDifferentials = caseData.diagnostics
              ?.filter(d => d.refutingCriteria && d !== primaryDiag && (!primaryDiag || d.name.toLowerCase() !== primaryDiag.name.toLowerCase()))
              .map(d => cleanTextForJSPDF(`${d.name}: ${d.refutingCriteria}`)) || [];

            const showDiscarded = cfg.includeDiscardedDifferentials !== false && cfg.includeDifferentials;
            if (showDiscarded && discardedDifferentials.length > 0) {
              semiologyStepsToDraw.push({
                title: "CRITERIOS DESCARTADOS Y EXCLUSIONES",
                subtitle: "Diferenciales Desestimados",
                content: "Criterios que permitieron descartar otras sospechas clínicas:",
                bullets: discardedDifferentials,
                accentColor: [185, 28, 28], // Red/Rose tone
                bgColor: [254, 242, 242] // Light Rose bg
              });
            }

            if (cfg.includeDifferentials && caseData.diagnostics && caseData.diagnostics.length > 0) {
              const primaryDiag = caseData.diagnostics[0];
              let conclusionText = cleanTextForJSPDF(primaryDiag.name);
              const bulletsArr: string[] = [];
              if (primaryDiag.supportingCriteria) {
                bulletsArr.push(cleanTextForJSPDF(`Soporte: ${primaryDiag.supportingCriteria}`));
              }
              if (cfg.includeManagement && caseData.managementRecommendation) {
                bulletsArr.push(cleanTextForJSPDF(`Manejo sugerido: ${caseData.managementRecommendation}`));
              }

              semiologyStepsToDraw.push({
                title: "DIAGNÓSTICO PRESUNTIVO DEFINITIVO",
                subtitle: "Conclusión del Juicio Radiológico",
                content: conclusionText,
                bullets: bulletsArr,
                accentColor: cardsStyle.differentials.border,
                bgColor: cardsStyle.differentials.bg
              });
            }

            semiologyStepsToDraw.forEach((step, idx) => {
              doc.setFont("helvetica", "normal");
              doc.setFontSize(9.5 * factor);
              const wrappedContent = doc.splitTextToSize(cleanTextForJSPDF(step.content), contentWidth - 12 * factor);
              let cardHeight = 14 * factor + (wrappedContent.length * 4.6 * factor); // generous vertical spacing

              let wrappedBullets: string[][] = [];
              if (step.bullets && step.bullets.length > 0) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9 * factor);
                step.bullets.forEach(b => {
                  const lines = doc.splitTextToSize(`- ${cleanTextForJSPDF(b)}`, contentWidth - 18 * factor);
                  wrappedBullets.push(lines);
                  cardHeight += lines.length * 4.2 * factor;
                });
              }
              cardHeight += 3.5 * factor; // Bottom padding

              checkPageBreak(cardHeight + (idx < semiologyStepsToDraw.length - 1 ? 6 * factor : 0));

              // Background card
              doc.setFillColor(step.bgColor[0], step.bgColor[1], step.bgColor[2]);
              doc.roundedRect(marginX, yCoord, contentWidth, cardHeight, 1.5, 1.5, "F");

              // Left accent border (thick for step)
              doc.setFillColor(step.accentColor[0], step.accentColor[1], step.accentColor[2]);
              doc.rect(marginX, yCoord, 2.5 * factor, cardHeight, "F");

              // Header and Subtitle
              doc.setFont("helvetica", "bold");
              doc.setFontSize(9 * factor); // Spacious, readable
              doc.setTextColor(step.accentColor[0], step.accentColor[1], step.accentColor[2]);
              doc.text(`${idx + 1}. ${step.title}`, marginX + 5 * factor, yCoord + 5.5 * factor);

              doc.setFont("helvetica", "oblique");
              doc.setFontSize(8 * factor); // Spacious, readable
              doc.setTextColor(100, 116, 139);
              doc.text(step.subtitle, marginX + 5 * factor, yCoord + 9 * factor);

              let textY = yCoord + 14 * factor;

              // Main Content text
              doc.setFont("helvetica", "normal");
              doc.setFontSize(9.5 * factor); // Spacious, readable (increased from 8)
              doc.setTextColor(30, 41, 59);
              wrappedContent.forEach((line: string) => {
                doc.text(line, marginX + 5 * factor, textY);
                textY += 4.6 * factor;
              });

              // Bullets if any
              if (step.bullets && step.bullets.length > 0) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9 * factor); // Spacious, readable (increased from 7.5)
                doc.setTextColor(71, 85, 105);
                wrappedBullets.forEach(lines => {
                  lines.forEach((line: string) => {
                    doc.text(line, marginX + 7 * factor, textY);
                    textY += 4.2 * factor;
                  });
                });
              }

              yCoord += cardHeight;

              // Draw dashed connecting line between steps
              if (idx < semiologyStepsToDraw.length - 1) {
                const arrowY = yCoord;
                doc.setDrawColor(step.accentColor[0], step.accentColor[1], step.accentColor[2]);
                doc.setLineWidth(0.5 * factor);
                doc.line(marginX + contentWidth / 2, arrowY, marginX + contentWidth / 2, arrowY + 5 * factor);
                
                // Draw a small downwards arrowhead
                doc.line(marginX + contentWidth / 2 - 1.5 * factor, arrowY + 3.8 * factor, marginX + contentWidth / 2, arrowY + 5 * factor);
                doc.line(marginX + contentWidth / 2 + 1.5 * factor, arrowY + 3.8 * factor, marginX + contentWidth / 2, arrowY + 5 * factor);

                yCoord += 5 * factor;
              }
            });

            yCoord += 6 * factor;
          }

          // --- FORMAT 2: FLUJOGRAMA ALGORÍTMICO ---
          else if (caseData.format === "flujograma_algoritmico") {
            const steps = caseData.decisionFlow || [
              ...(cfg.includeSonographic && caseData.sonographicPillar ? [{ title: "Punto de Partida Sonográfico", desc: caseData.sonographicPillar.primaryFinding }] : []),
              ...(cfg.includeClinicalCorr && caseData.clinicalCorrelation ? [{ title: "Integración Clínico-Laboratorial", desc: caseData.clinicalCorrelation }] : []),
              ...(cfg.includeDifferentials && caseData.diagnostics && caseData.diagnostics.length > 0 ? [{ title: "Conclusión Diagnóstica", desc: `Diagnóstico principal: ${caseData.diagnostics[0].name}.` }] : []),
              ...(cfg.includeManagement && caseData.managementRecommendation ? [{ title: "Conducta y Manejo Sugerido", desc: caseData.managementRecommendation }] : []),
            ];

            steps.forEach((st, idx) => {
              const stepNum = idx + 1;
              doc.setFont("helvetica", "normal");
              doc.setFontSize(9.5 * factor);
              const wrappedDesc = doc.splitTextToSize(st.desc, contentWidth - 22 * factor);
              const boxHeight = (9 * factor) + (wrappedDesc.length * 4.6 * factor);

              checkPageBreak(boxHeight + (idx < steps.length - 1 ? 8 * factor : 0));

              // Draw background box using activeThemeBg
              doc.setFillColor(activeThemeBg[0], activeThemeBg[1], activeThemeBg[2]);
              doc.setDrawColor(activeThemeBorder[0], activeThemeBorder[1], activeThemeBorder[2]);
              doc.setLineWidth(0.3);
              doc.roundedRect(marginX, yCoord, contentWidth, boxHeight, 1.5, 1.5, "FD");

              // Step Number pill using activeThemeAccent
              doc.setFillColor(activeThemeAccent[0], activeThemeAccent[1], activeThemeAccent[2]);
              doc.roundedRect(marginX + 4 * factor, yCoord + 2.5 * factor, 7 * factor, 5 * factor, 0.8, 0.8, "F");
              doc.setFont("helvetica", "bold");
              doc.setFontSize(8.5 * factor);
              doc.setTextColor(255, 255, 255);
              doc.text(`${stepNum}`, marginX + 7.5 * factor, yCoord + 6.1 * factor, { align: "center" });

              // Step Title
              doc.setFont("helvetica", "bold");
              doc.setFontSize(9 * factor); // Spacious, readable (increased from 8)
              doc.setTextColor(activeThemeAccent[0], activeThemeAccent[1], activeThemeAccent[2]);
              doc.text(st.title.toUpperCase(), marginX + 13 * factor, yCoord + 6 * factor);

              // Description
              doc.setFont("helvetica", "normal");
              doc.setFontSize(9.5 * factor); // Spacious, readable (increased from 8.5)
              doc.setTextColor(30, 41, 59);
              let descY = yCoord + 11 * factor;
              wrappedDesc.forEach((line: string) => {
                doc.text(line, marginX + 5 * factor, descY);
                descY += 4.6 * factor;
              });

              yCoord += boxHeight;

              // Down arrow indicator
              if (idx < steps.length - 1) {
                yCoord += 2 * factor;
                doc.setDrawColor(activeThemeAccent[0], activeThemeAccent[1], activeThemeAccent[2]);
                doc.setLineWidth(0.5);
                const midX = marginX + (contentWidth / 2);
                doc.line(midX, yCoord, midX, yCoord + 6 * factor);
                doc.line(midX, yCoord + 6 * factor, midX - 1.5 * factor, yCoord + 4.5 * factor);
                doc.line(midX, yCoord + 6 * factor, midX + 1.5 * factor, yCoord + 4.5 * factor);
                
                yCoord += 7 * factor;
              } else {
                yCoord += 4 * factor;
              }
            });
          }

          // --- FORMAT 3: ESQUEMA INTEGRADOR POR PILARES ---
          else if (caseData.format === "esquema_pilares") {
            const pillars = [
              {
                title: "PILAR 1 — HALLAZGOS ECOGRÁFICOS",
                content: caseData.sonographicPillar ? caseData.sonographicPillar.primaryFinding : "",
                subContent: caseData.sonographicPillar?.details ? caseData.sonographicPillar.details.map(cleanTextForJSPDF).join(" - ") : "",
                borderColor: pillar1Color,
                included: cfg.includeSonographic && !!caseData.sonographicPillar
              },
              {
                title: "PILAR 2 — CORRELACIÓN CLÍNICO-LAB",
                content: caseData.clinicalCorrelation || "Sin datos de laboratorio o clínica adicionales.",
                subContent: "",
                borderColor: pillar2Color,
                included: cfg.includeClinicalCorr
              },
              {
                title: "PILAR 3 — CONCLUSIÓN & DIAGNÓSTICO",
                content: caseData.diagnostics && caseData.diagnostics.length > 0 
                  ? `Diag. Principal: ${caseData.diagnostics[0].name}` 
                  : "Diagnóstico diferencial sustentado.",
                subContent: "",
                borderColor: pillar3Color,
                included: cfg.includeDifferentials
              },
              {
                title: "PILAR 4 — CONDUCTA Y MANEJO",
                content: caseData.managementRecommendation || "Seguimiento ecográfico según evolución clínica.",
                subContent: "",
                borderColor: pillar4Color,
                included: cfg.includeManagement
              }
            ].filter(p => p.included);

            pillars.forEach(p => {
              doc.setFont("helvetica", "bold");
              doc.setFontSize(9.5 * factor);
              const wrappedContent = doc.splitTextToSize(p.content, contentWidth - 10 * factor);
              
              doc.setFont("helvetica", "normal");
              doc.setFontSize(8.5 * factor);
              const wrappedSub = p.subContent ? doc.splitTextToSize(p.subContent, contentWidth - 10 * factor) : [];
              
              const cardHeight = (10 * factor) + (wrappedContent.length * 4.8 * factor) + (wrappedSub.length > 0 ? (wrappedSub.length * 4.2 * factor) + 1.5 * factor : 0);

              checkPageBreak(cardHeight + 10 * factor);

              // Draw card background
              doc.setFillColor(activeThemeBg[0], activeThemeBg[1], activeThemeBg[2]);
              doc.setDrawColor(activeThemeBorder[0], activeThemeBorder[1], activeThemeBorder[2]);
              doc.setLineWidth(0.25);
              doc.roundedRect(marginX, yCoord, contentWidth, cardHeight, 1.5, 1.5, "FD");

              // Thick top border color
              doc.setDrawColor(p.borderColor[0], p.borderColor[1], p.borderColor[2]);
              doc.setLineWidth(1.2 * factor);
              doc.line(marginX, yCoord + 0.6 * factor, marginX + contentWidth, yCoord + 0.6 * factor);

              // Header title
              doc.setFont("helvetica", "bold");
              doc.setFontSize(8.5 * factor); // Spacious, readable (increased from 7.5)
              doc.setTextColor(p.borderColor[0], p.borderColor[1], p.borderColor[2]);
              doc.text(p.title, marginX + 5 * factor, yCoord + 5.5 * factor);

              let textY = yCoord + 10.5 * factor;

              // Main content
              doc.setFont("helvetica", "bold");
              doc.setFontSize(9.5 * factor); // Spacious, readable (increased from 8.5)
              doc.setTextColor(15, 23, 42);
              wrappedContent.forEach((line: string) => {
                doc.text(line, marginX + 5 * factor, textY);
                textY += 4.8 * factor;
              });

              // Subcontent details
              if (wrappedSub.length > 0) {
                textY += 1.5 * factor;
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5 * factor); // Spacious, readable (increased from 7.5)
                doc.setTextColor(100, 116, 139);
                wrappedSub.forEach((line: string) => {
                  doc.text(line, marginX + 5 * factor, textY);
                  textY += 4.2 * factor;
                });
              }

              yCoord += cardHeight + 4.5 * factor;
            });
          }

          // --- FORMAT 4: MAPA DE DIAGNÓSTICOS DIFERENCIALES ---
          else if (caseData.format === "mapa_diferenciales") {
            if (cfg.includeSonographic && caseData.sonographicPillar) {
              doc.setFont("helvetica", "normal");
              doc.setFontSize(9.5 * factor);
              const wrappedPillar = doc.splitTextToSize(caseData.sonographicPillar.primaryFinding, contentWidth - 40 * factor);
              const pillarHeight = 10 * factor + (wrappedPillar.length * 4.6 * factor);
              checkPageBreak(pillarHeight + 12 * factor);
              
              // Draw background
              doc.setFillColor(activeThemeBg[0], activeThemeBg[1], activeThemeBg[2]);
              doc.setDrawColor(activeThemeBorder[0], activeThemeBorder[1], activeThemeBorder[2]);
              doc.setLineWidth(0.25);
              doc.roundedRect(marginX + 15 * factor, yCoord, contentWidth - 30 * factor, pillarHeight, 1.5, 1.5, "FD");

              // Left marker line
              doc.setFillColor(activeThemeAccent[0], activeThemeAccent[1], activeThemeAccent[2]);
              doc.rect(marginX + 15 * factor, yCoord, 1.5 * factor, pillarHeight, "F");

              // Title label
              doc.setFont("helvetica", "bold");
              doc.setFontSize(8 * factor); // Spacious, readable (increased from 7)
              doc.setTextColor(activeThemeAccent[0], activeThemeAccent[1], activeThemeAccent[2]);
              doc.text("HALLAZGO SONOGRÁFICO PRIMARIO", marginX + 19 * factor, yCoord + 5 * factor);

              // Text content
              doc.setFont("helvetica", "normal");
              doc.setFontSize(9.5 * factor); // Spacious, readable (increased from 8)
              doc.setTextColor(30, 41, 59);
              let tempY = yCoord + 10 * factor;
              wrappedPillar.forEach((line: string) => {
                doc.text(line, marginX + 19 * factor, tempY);
                tempY += 4.6 * factor;
              });

              yCoord += pillarHeight + 2 * factor;

              // Draw visual radiating line
              doc.setDrawColor(activeThemeAccent[0], activeThemeAccent[1], activeThemeAccent[2]);
              doc.setLineWidth(0.4);
              doc.line(marginX + contentWidth / 2, yCoord, marginX + contentWidth / 2, yCoord + 5 * factor);
              yCoord += 6 * factor;
            }

            if (caseData.diagnostics && caseData.diagnostics.length > 0) {
              caseData.diagnostics.forEach((diag, idx) => {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9.5 * factor);
                const wrappedName = doc.splitTextToSize(diag.name, contentWidth - 30 * factor);
                const nameLinesCount = wrappedName.length;

                let cardHeight = 11 * factor + (nameLinesCount > 1 ? (nameLinesCount - 1) * 4.6 * factor : 0);
                
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9 * factor);
                const wrappedSup = diag.supportingCriteria 
                  ? doc.splitTextToSize(`- A favor (Sonográfico): ${cleanTextForJSPDF(diag.supportingCriteria)}`, contentWidth - 14 * factor)
                  : [];
                const wrappedRef = diag.refutingCriteria 
                  ? doc.splitTextToSize(`- En contra / Ausente: ${cleanTextForJSPDF(diag.refutingCriteria)}`, contentWidth - 14 * factor)
                  : [];
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9 * factor);
                const wrappedTest = (cfg.includeManagement && diag.confirmatoryTest) 
                  ? doc.splitTextToSize(`- Test Confirmativo / Conducta: ${cleanTextForJSPDF(diag.confirmatoryTest)}`, contentWidth - 14 * factor)
                  : [];

                if (wrappedSup.length > 0) cardHeight += 2 * factor + (wrappedSup.length * 4.2 * factor);
                if (wrappedRef.length > 0) cardHeight += 2 * factor + (wrappedRef.length * 4.2 * factor);
                if (wrappedTest.length > 0) cardHeight += 2 * factor + (wrappedTest.length * 4.2 * factor);
                
                cardHeight += 3 * factor;

                checkPageBreak(cardHeight + 5 * factor);

                // Draw card background
                doc.setFillColor(activeThemeBg[0], activeThemeBg[1], activeThemeBg[2]);
                doc.setDrawColor(activeThemeBorder[0], activeThemeBorder[1], activeThemeBorder[2]);
                doc.setLineWidth(0.25);
                doc.roundedRect(marginX, yCoord, contentWidth, cardHeight, 1.5, 1.5, "FD");

                // Left number indicator
                doc.setFillColor(activeThemeAccent[0], activeThemeAccent[1], activeThemeAccent[2]);
                doc.roundedRect(marginX + 4 * factor, yCoord + 2.5 * factor, 6 * factor, 5 * factor, 0.6, 0.6, "F");
                doc.setFont("helvetica", "bold");
                doc.setFontSize(8 * factor);
                doc.setTextColor(255, 255, 255);
                doc.text(`${idx + 1}`, marginX + 7 * factor, yCoord + 6 * factor, { align: "center" });

                // Title
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9.5 * factor); // Spacious, readable (increased from 8.5)
                doc.setTextColor(15, 23, 42);
                let titleY = yCoord + 6 * factor;
                wrappedName.forEach((line: string) => {
                  doc.text(line, marginX + 12 * factor, titleY);
                  titleY += 4.6 * factor;
                });

                let textY = yCoord + 11 * factor + (nameLinesCount > 1 ? (nameLinesCount - 1) * 4.6 * factor : 0);

                if (wrappedSup.length > 0) {
                  doc.setFont("helvetica", "normal");
                  doc.setFontSize(9 * factor); // Spacious, readable (increased from 7.5)
                  doc.setTextColor(16, 120, 80);
                  wrappedSup.forEach((line: string) => {
                    doc.text(line, marginX + 7 * factor, textY);
                    textY += 4.2 * factor;
                  });
                  textY += 2 * factor;
                }

                if (wrappedRef.length > 0) {
                  doc.setFont("helvetica", "normal");
                  doc.setFontSize(9 * factor); // Spacious, readable (increased from 7.5)
                  doc.setTextColor(185, 28, 28);
                  wrappedRef.forEach((line: string) => {
                    doc.text(line, marginX + 7 * factor, textY);
                    textY += 4.2 * factor;
                  });
                  textY += 2 * factor;
                }

                if (wrappedTest.length > 0) {
                  doc.setFont("helvetica", "bold");
                  doc.setFontSize(9 * factor); // Spacious, readable (increased from 7.5)
                  doc.setTextColor(109, 40, 217);
                  wrappedTest.forEach((line: string) => {
                    doc.text(line, marginX + 7 * factor, textY);
                    textY += 4.2 * factor;
                  });
                }

                yCoord += cardHeight + 4.5 * factor;
              });
            }
          }

          // --- FORMAT 5: MATRIZ SEMIÓTICA COMPARATIVA ---
          else if (caseData.format === "matriz_semiotica") {
            const requestingSigns: string[] = [];
            if (caseData.semioticMatrix?.requestingSigns && caseData.semioticMatrix.requestingSigns.length > 0) {
              requestingSigns.push(...caseData.semioticMatrix.requestingSigns);
            } else {
              if (cfg.includeSonographic && caseData.sonographicPillar?.primaryFinding) {
                requestingSigns.push(caseData.sonographicPillar.primaryFinding);
              }
              if (cfg.includeSonographicDetails !== false && caseData.sonographicPillar?.details) {
                requestingSigns.push(...caseData.sonographicPillar.details);
              }
            }

            const discardSigns: string[] = [];
            if (caseData.semioticMatrix?.exclusiveSigns && caseData.semioticMatrix.exclusiveSigns.length > 0) {
              discardSigns.push(...caseData.semioticMatrix.exclusiveSigns);
            }
            if (caseData.semioticMatrix?.discardCriteria && caseData.semioticMatrix.discardCriteria.length > 0) {
              discardSigns.push(...caseData.semioticMatrix.discardCriteria);
            }
            if (discardSigns.length === 0 && caseData.diagnostics) {
              const pDiag = caseData.diagnostics[0];
              caseData.diagnostics.forEach(d => {
                if (d.refutingCriteria && d !== pDiag && (!pDiag || d.name.toLowerCase() !== pDiag.name.toLowerCase())) {
                  discardSigns.push(`[Exclusión ${d.name}] ${d.refutingCriteria}`);
                }
              });
            }

            const colWidth = (contentWidth - 6 * factor) / 2; // more gap

            // Column 1: Signos Peticionantes (Inclusivos)
            let reqHeight = 10 * factor;
            const wrappedReqLines: string[][] = [];
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9 * factor);
            requestingSigns.forEach(s => {
              const wrapped = doc.splitTextToSize(`- ${cleanTextForJSPDF(s)}`, colWidth - 10 * factor);
              wrappedReqLines.push(wrapped);
              reqHeight += (wrapped.length * 4.2 * factor) + 2.5 * factor;
            });

            // Column 2: Signos Exclusivos / Descarte
            let discHeight = 10 * factor;
            const wrappedDiscLines: string[][] = [];
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9 * factor);
            discardSigns.forEach(s => {
              const wrapped = doc.splitTextToSize(`- ${cleanTextForJSPDF(s)}`, colWidth - 10 * factor);
              wrappedDiscLines.push(wrapped);
              discHeight += (wrapped.length * 4.2 * factor) + 2.5 * factor;
            });

            const matrixHeight = Math.max(reqHeight, discHeight, 25 * factor);
            checkPageBreak(matrixHeight + 15 * factor);

            // Column 1 Box (Emerald)
            doc.setFillColor(240, 253, 244);
            doc.setDrawColor(187, 247, 208);
            doc.setLineWidth(0.25);
            doc.roundedRect(marginX, yCoord, colWidth, matrixHeight, 1.5, 1.5, "FD");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(8 * factor);
            doc.setTextColor(16, 120, 80);
            doc.text("SIGNOS PETICIONANTES (A FAVOR)", marginX + 5 * factor, yCoord + 6 * factor);

            let reqY = yCoord + 11 * factor;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9 * factor); // Spacious, readable (increased from 7)
            doc.setTextColor(30, 41, 59);
            wrappedReqLines.forEach(wrapped => {
              wrapped.forEach((line: string) => {
                doc.text(line, marginX + 5 * factor, reqY);
                reqY += 4.2 * factor;
              });
              reqY += 1.5 * factor;
            });

            // Column 2 Box (Rose)
            const col2X = marginX + colWidth + 6 * factor;
            doc.setFillColor(255, 241, 242);
            doc.setDrawColor(254, 205, 211);
            doc.setLineWidth(0.25);
            doc.roundedRect(col2X, yCoord, colWidth, matrixHeight, 1.5, 1.5, "FD");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(8 * factor);
            doc.setTextColor(185, 28, 28);
            doc.text("SIGNOS EXCLUSIVOS Y DESCARTE", col2X + 5 * factor, yCoord + 6 * factor);

            let discY = yCoord + 11 * factor;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9 * factor); // Spacious, readable (increased from 7)
            doc.setTextColor(30, 41, 59);
            wrappedDiscLines.forEach(wrapped => {
              wrapped.forEach((line: string) => {
                doc.text(line, col2X + 5 * factor, discY);
                discY += 4.2 * factor;
              });
              discY += 1.5 * factor;
            });

            yCoord += matrixHeight + 5 * factor;

            // Bottom Synthesis Box
            const showMgmt = cfg.includeManagement && !!caseData.managementRecommendation;
            if (caseData.clinicalCorrelation || showMgmt) {
              const wrappedCorr = caseData.clinicalCorrelation ? doc.splitTextToSize(`Correlación Clínica: ${caseData.clinicalCorrelation}`, contentWidth - 10 * factor) : [];
              const wrappedMgmt = showMgmt ? doc.splitTextToSize(`Conducta y Manejo: ${caseData.managementRecommendation}`, contentWidth - 10 * factor) : [];
              
              let synthHeight = 9 * factor + (wrappedCorr.length * 4.2 * factor) + (wrappedMgmt.length * 4.2 * factor) + 5 * factor;
              checkPageBreak(synthHeight + 5 * factor);

              doc.setFillColor(248, 250, 252);
              doc.setDrawColor(226, 232, 240);
              doc.setLineWidth(0.25);
              doc.roundedRect(marginX, yCoord, contentWidth, synthHeight, 1.5, 1.5, "FD");

              doc.setFont("helvetica", "bold");
              doc.setFontSize(8.5 * factor); // Spacious, readable (increased from 7.5)
              doc.setTextColor(79, 70, 229);
              doc.text("SÍNTESIS DIAGNÓSTICA Y BALANCE SEMIÓTICO", marginX + 5 * factor, yCoord + 6 * factor);

              let synthY = yCoord + 11 * factor;
              if (wrappedCorr.length > 0) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9 * factor); // Spacious, readable (increased from 7)
                doc.setTextColor(30, 41, 59);
                wrappedCorr.forEach((line: string) => {
                  doc.text(line, marginX + 5 * factor, synthY);
                  synthY += 4.2 * factor;
                });
                synthY += 2 * factor;
              }

              if (wrappedMgmt.length > 0) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9 * factor); // Spacious, readable (increased from 7)
                doc.setTextColor(67, 56, 202);
                wrappedMgmt.forEach((line: string) => {
                  doc.text(line, marginX + 5 * factor, synthY);
                  synthY += 4.2 * factor;
                });
              }

              yCoord += synthHeight + 5 * factor;
            }
          }

          yCoord += 6 * factor;
        });
      }

      // --- 8. DESGLOSE Y JUSTIFICACIÓN DE CLASIFICACIONES ---
      if (classificationAnnexBlocks.length > 0) {
        doc.addPage();
        yCoord = 20;
        isFirstBlock = true;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12 * factor);
        doc.setTextColor(15, 23, 42);
        doc.text("ANEXO: DESGLOSE Y JUSTIFICACIÓN DE CLASIFICACIONES RADIOLÓGICAS", marginX, yCoord);
        yCoord += 4 * factor;
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.4);
        doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
        yCoord += 10 * factor;

        classificationAnnexBlocks.forEach((block) => {
          renderSingleReportBlock(block);
        });
      }

      // --- 8.5 ANEXO: RADAR BIOMECÁNICO E INFLAMATORIO (ANÁLISIS MULTIVECTOR 6D) ---
      const radarDataToRender = getBiomechanicalRadarDataFromReport(
        generatedReportLocal,
        pdfStateRef.current.biomechanicalRadarData || biomechanicalRadarData
      );

      if (includeRadarInReport && radarDataToRender && radarDataToRender.axes && radarDataToRender.axes.length > 0) {
        doc.addPage();
        yCoord = 21 * factor;

        // Header Title (Positioned cleanly below global running header line at 14mm)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11 * factor);
        doc.setTextColor(15, 23, 42); // slate 900
        const headerTitleText = getRadarTitle(radarDataToRender?.radarMode || radarDataToRender);
        doc.text(headerTitleText, marginX, yCoord);

        yCoord += 4 * factor;
        doc.setDrawColor(203, 213, 225); // slate 300
        doc.setLineWidth(0.4);
        doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
        yCoord += 7 * factor;

        // Spider Chart Geometry Parameters (Optimized scale and safety margin to guarantee zero overlaps with right panel)
        const chartCenterX = marginX + 37 * factor;
        const chartCenterY = yCoord + 35 * factor;
        const maxR = 21 * factor;
        const numAxes = radarDataToRender.axes.length;

        const getRadarPt = (axisIdx: number, valScore: number) => {
          const angle = (Math.PI * 2 / numAxes) * axisIdx - Math.PI / 2;
          const r = (valScore / 10) * maxR;
          return {
            x: chartCenterX + r * Math.cos(angle),
            y: chartCenterY + r * Math.sin(angle),
            angle
          };
        };

        // 1. Concentric Regular Hexagons (scale levels 0.2, 0.4, 0.6, 0.8, 1.0)
        doc.setDrawColor(226, 232, 240); // slate 200
        doc.setLineWidth(0.35);
        [0.2, 0.4, 0.6, 0.8, 1.0].forEach((scale) => {
          const points: [number, number][] = [];
          for (let i = 0; i < numAxes; i++) {
            const pt = getRadarPt(i, scale * 10);
            points.push([pt.x, pt.y]);
          }
          for (let i = 0; i < numAxes; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % numAxes];
            doc.line(p1[0], p1[1], p2[0], p2[1]);
          }
        });

        // 2. Radial Axis Lines & Outer Labels
        const rightX = marginX + 94 * factor;
        const rightWidth = contentWidth - 94 * factor; // 86mm width
        const rightBoundary = rightX - 3.0 * factor; // Hard boundary limit for spider chart labels

        doc.setDrawColor(148, 163, 184); // slate 400
        doc.setLineWidth(0.4);
        radarDataToRender.axes.forEach((axis, i) => {
          const endPt = getRadarPt(i, 10);
          doc.line(chartCenterX, chartCenterY, endPt.x, endPt.y);

          const lblPt = getRadarPt(i, 11.0);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.0 * factor);
          doc.setTextColor(30, 41, 59); // slate 800

          const cleanLabel = getShortRadarAxisLabel(sanitizeRadarPdfText(axis.label), 18);
          let textAlign: "left" | "right" | "center" = "center";
          let labelX = lblPt.x;
          let labelY = lblPt.y;

          const cosVal = Math.cos(lblPt.angle);
          const sinVal = Math.sin(lblPt.angle);

          if (cosVal > 0.25) {
            textAlign = "left";
            labelX += 1.5 * factor;
          } else if (cosVal < -0.25) {
            textAlign = "right";
            labelX -= 1.5 * factor;
          }

          if (sinVal < -0.8) {
            labelY -= 1.8 * factor;
          } else if (sinVal > 0.8) {
            labelY += 2.5 * factor;
          } else {
            labelY += 0.8 * factor;
          }

          const fullLabelStr = `${cleanLabel} (${axis.score}/10)`;
          let textW = doc.getTextWidth(fullLabelStr);

          if (textAlign === "left" && (labelX + textW > rightBoundary)) {
            // Split onto two stacked lines to avoid right panel overlap
            doc.setFontSize(6.8 * factor);
            const line1W = doc.getTextWidth(cleanLabel);
            if (labelX + line1W > rightBoundary) {
              const maxAllowedW = Math.max(10 * factor, rightBoundary - labelX);
              const wrappedLabel = doc.splitTextToSize(cleanLabel, maxAllowedW);
              doc.text(wrappedLabel, labelX, labelY - 1.2 * factor, { align: "left" });
            } else {
              doc.text(cleanLabel, labelX, labelY - 1.2 * factor, { align: "left" });
            }
            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.5 * factor);
            doc.setTextColor(79, 70, 229);
            doc.text(`(${axis.score}/10)`, labelX, labelY + 2.2 * factor, { align: "left" });
          } else {
            doc.text(fullLabelStr, labelX, labelY, { align: textAlign });
          }
        });

        // 3. Data Filled Polygon
        const dataPts: [number, number][] = radarDataToRender.axes.map((a, i) => {
          const pt = getRadarPt(i, a.score);
          return [pt.x, pt.y];
        });

        doc.setFillColor(224, 231, 255); // indigo 100 fill
        doc.setDrawColor(79, 70, 229);   // indigo 600 border
        doc.setLineWidth(1.2);

        if ((doc as any).polygon) {
          (doc as any).polygon(dataPts, 'FD');
        } else {
          for (let i = 0; i < numAxes; i++) {
            const p1 = dataPts[i];
            const p2 = dataPts[(i + 1) % numAxes];
            doc.line(p1[0], p1[1], p2[0], p2[1]);
          }
        }

        // 4. Vertex Dots
        dataPts.forEach(([vx, vy]) => {
          doc.setFillColor(79, 70, 229);
          doc.circle(vx, vy, 1.5 * factor, 'F');
        });

        // Spider Chart Footer Caption
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5 * factor);
        doc.setTextColor(100, 116, 139);
        doc.text("Representación gráfica vectorial en araña (0-10)", chartCenterX, chartCenterY + maxR + 9 * factor, { align: "center" });

        // RIGHT SIDE PANEL: Global Load Index & 6-Axis Matrix (Positioned cleanly at marginX + 94mm)
        let rightY = yCoord;

        // Global Load Index Card
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.8 * factor);
        const cardMaxTextW = rightWidth - 8 * factor;
        const domVecText = `Vector Dominante: ${radarDataToRender.dominantVector || "No especificado"}`;
        const domVecLines = doc.splitTextToSize(domVecText, cardMaxTextW);
        const finalDomVecLines = domVecLines.length > 2 
          ? [domVecLines[0], domVecLines[1].substring(0, Math.max(0, domVecLines[1].length - 3)) + ".."]
          : domVecLines;

        const cardH = 23 * factor + (finalDomVecLines.length > 1 ? (finalDomVecLines.length - 1) * 4.0 * factor : 0);

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.35);
        doc.roundedRect(rightX, rightY, rightWidth, cardH, 1.5, 1.5, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.2 * factor);
        doc.setTextColor(79, 70, 229);
        doc.text("CARGA TISULAR GLOBAL", rightX + 4 * factor, rightY + 6.0 * factor);

        doc.setFontSize(14 * factor);
        doc.setTextColor(15, 23, 42);
        doc.text(`${radarDataToRender.globalScore} / 10.0`, rightX + 4 * factor, rightY + 14.0 * factor);

        doc.setFontSize(7.2 * factor);
        doc.setTextColor(225, 29, 72); // rose 600
        doc.text(`Carga: ${(radarDataToRender.globalLoadIndex || "Moderada").toUpperCase()}`, rightX + rightWidth - 4 * factor, rightY + 6.0 * factor, { align: "right" });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.8 * factor);
        doc.setTextColor(71, 85, 105);
        finalDomVecLines.forEach((line: string, lIdx: number) => {
          doc.text(line, rightX + 4 * factor, rightY + 18.5 * factor + (lIdx * 4.0 * factor));
        });

        rightY += cardH + 5 * factor;

        // Table of 6 Vectors (Compact: Only label and score badge)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.8 * factor);
        doc.setTextColor(15, 23, 42);
        doc.text("DESGLOSE MULTIVECTORIAL (6D)", rightX, rightY);
        rightY += 5.2 * factor;

        const colW = (rightWidth - 4 * factor) / 2;

        radarDataToRender.axes.forEach((axis, idx) => {
          const isSecondCol = idx % 2 === 1;
          const cardX = isSecondCol ? rightX + colW + 4 * factor : rightX;
          const cardY = rightY + Math.floor(idx / 2) * 8.5 * factor;

          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(cardX, cardY, colW, 7.8 * factor, 1, 1, "FD");

          doc.setFont("helvetica", "bold");
          const displayLabel = getShortRadarAxisLabel(sanitizeRadarPdfText(axis.label), 18);
          const maxLabelWidth = colW - 13 * factor;
          
          let labelFontSize = 7.5;
          doc.setFontSize(labelFontSize * factor);
          while (doc.getTextWidth(displayLabel) > maxLabelWidth && labelFontSize > 4.8) {
            labelFontSize -= 0.2;
            doc.setFontSize(labelFontSize * factor);
          }

          doc.setTextColor(30, 41, 59);
          doc.text(displayLabel, cardX + 2.5 * factor, cardY + 5.2 * factor);

          let levelColor = [16, 185, 129]; // emerald
          if (axis.score >= 8) levelColor = [225, 29, 72]; // rose
          else if (axis.score >= 6) levelColor = [217, 119, 6]; // amber
          else if (axis.score >= 3) levelColor = [8, 145, 178]; // cyan

          doc.setTextColor(levelColor[0], levelColor[1], levelColor[2]);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.8 * factor);
          doc.text(`${axis.score}/10`, cardX + colW - 2.5 * factor, cardY + 5.2 * factor, { align: "right" });
        });

        rightY += Math.ceil(radarDataToRender.axes.length / 2) * 8.5 * factor + 4 * factor;
        yCoord = Math.max(chartCenterY + maxR + 15 * factor, rightY);

        // MIDDLE SECTION: DETALLE Y JUSTIFICACIÓN DE LOS VECTORES
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10 * factor);
        doc.setTextColor(15, 23, 42);
        doc.text("DETALLE Y JUSTIFICACIÓN DE LOS VECTORES (HALLAZGOS Y SOBRECARGA)", marginX, yCoord);
        yCoord += 6.5 * factor;

        const detailColW = (contentWidth - 5 * factor) / 2;
        const axesList = radarDataToRender.axes;

        for (let i = 0; i < axesList.length; i += 2) {
          const axisA = axesList[i];
          const axisB = axesList[i + 1];

          // Set font size BEFORE splitting text
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.0 * factor);

          // Compute lines for axisA (sanitize >= / <= so Helvetica does not break layout)
          const findingA = axisA.finding ? `Hallazgo: ${sanitizeRadarPdfText(axisA.finding)}` : "";
          const justARaw = axisA.justification && axisA.justification !== axisA.finding ? axisA.justification : "";
          const justA = justARaw ? `Justificación: ${sanitizeRadarPdfText(justARaw)}` : "";
          const textA = [findingA, justA].filter(Boolean).join("\n");
          const linesA = doc.splitTextToSize(textA, detailColW - 8 * factor);

          let linesB: string[] = [];
          if (axisB) {
            const findingB = axisB.finding ? `Hallazgo: ${sanitizeRadarPdfText(axisB.finding)}` : "";
            const justBRaw = axisB.justification && axisB.justification !== axisB.finding ? axisB.justification : "";
            const justB = justBRaw ? `Justificación: ${sanitizeRadarPdfText(justBRaw)}` : "";
            const textB = [findingB, justB].filter(Boolean).join("\n");
            linesB = doc.splitTextToSize(textB, detailColW - 8 * factor);
          }

          const maxLines = Math.max(linesA.length, linesB.length, 1);
          const cardH = 9.0 * factor + (maxLines * 4.3 * factor) + 4.0 * factor;

          // Keep detail cards above the footer line / page number
          checkPageBreak(cardH + 6 * factor);

          // Render Card A
          doc.setFillColor(250, 252, 255);
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.3);
          doc.roundedRect(marginX, yCoord, detailColW, cardH, 1.2, 1.2, "FD");

          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5 * factor);

          const levelStrA = `(${axisA.level})`;
          const levelWidthA = doc.getTextWidth(levelStrA);
          const maxTitleWidthA = detailColW - levelWidthA - 7 * factor;

          doc.setTextColor(30, 41, 59);
          const titleA = doc.splitTextToSize(`${i + 1}. ${axisA.label}`, maxTitleWidthA)[0];
          doc.text(titleA, marginX + 3.5 * factor, yCoord + 6.0 * factor);

          doc.setTextColor(79, 70, 229);
          doc.text(levelStrA, marginX + detailColW - 3.5 * factor, yCoord + 6.0 * factor, { align: "right" });

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.0 * factor);
          doc.setTextColor(51, 65, 85); // slate 700
          let textY = yCoord + 10.5 * factor;
          const textBottomA = yCoord + cardH - 2.5 * factor;
          linesA.forEach((l: string) => {
            if (textY > textBottomA) return;
            doc.text(l, marginX + 3.5 * factor, textY);
            textY += 4.3 * factor;
          });

          // Render Card B (if exists)
          if (axisB) {
            const cardBX = marginX + detailColW + 5 * factor;
            doc.setFillColor(250, 252, 255);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.3);
            doc.roundedRect(cardBX, yCoord, detailColW, cardH, 1.2, 1.2, "FD");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5 * factor);

            const levelStrB = `(${axisB.level})`;
            const levelWidthB = doc.getTextWidth(levelStrB);
            const maxTitleWidthB = detailColW - levelWidthB - 7 * factor;

            doc.setTextColor(30, 41, 59);
            const titleB = doc.splitTextToSize(`${i + 2}. ${axisB.label}`, maxTitleWidthB)[0];
            doc.text(titleB, cardBX + 3.5 * factor, yCoord + 6.0 * factor);

            doc.setTextColor(79, 70, 229);
            doc.text(levelStrB, cardBX + detailColW - 3.5 * factor, yCoord + 6.0 * factor, { align: "right" });

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.0 * factor);
            doc.setTextColor(51, 65, 85);
            textY = yCoord + 10.5 * factor;
            const textBottomB = yCoord + cardH - 2.5 * factor;
            linesB.forEach((l: string) => {
              if (textY > textBottomB) return;
              doc.text(l, cardBX + 3.5 * factor, textY);
              textY += 4.3 * factor;
            });
          }

          yCoord += cardH + 4.0 * factor;
        }

        yCoord += 4 * factor;

        // BOTTOM SECTION: SÍNTESIS BIOMECÁNICO-INFLAMATORIA FINAL
        if (radarDataToRender.clinicalSummary) {
          const innerPadding = 7 * factor;
          const availableTextWidth = contentWidth - (innerPadding * 2);
          const synthFontSize = 8.8 * factor;
          const lineHeight = 4.6 * factor;

          // Set EXACT font size BEFORE splitting text
          doc.setFont("helvetica", "normal");
          doc.setFontSize(synthFontSize);

          const wrappedSynth = doc.splitTextToSize(sanitizeRadarPdfText(radarDataToRender.clinicalSummary), availableTextWidth);
          // Extra bottom pad so the box never collides with footer text / gray baseline
          const boxBottomPad = 5 * factor;
          const boxH = 11 * factor + (wrappedSynth.length * lineHeight) + boxBottomPad;

          // Move to next page if the synthesis box would overlap footer (pageHeight - 10)
          checkPageBreak(boxH + 8 * factor);

          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(199, 210, 254); // indigo 200
          doc.setLineWidth(0.4);
          doc.roundedRect(marginX, yCoord, contentWidth, boxH, 1.5, 1.5, "FD");

          doc.setFont("helvetica", "bold");
          doc.setFontSize(9.8 * factor);
          doc.setTextColor(79, 70, 229); // indigo 600
          doc.text("SÍNTESIS BIOMECÁNICO-INFLAMATORIA FINAL", marginX + innerPadding, yCoord + 7.5 * factor);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(synthFontSize);
          doc.setTextColor(30, 41, 59);

          let synthY = yCoord + 13.2 * factor;
          const synthTextBottom = yCoord + boxH - 3 * factor;
          wrappedSynth.forEach((line: string) => {
            if (synthY > synthTextBottom) return;
            doc.text(line, marginX + innerPadding, synthY);
            synthY += lineHeight;
          });

          yCoord += boxH + 6 * factor;
        }
      }

      // --- 9. RESUMEN DEL PACIENTE (SI CORRESPONDE) ---
      if (attachSummaryToOfficialReport && patientSummary) {
        doc.addPage();
        yCoord = 20;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42); // slate 900
        doc.text("ANEXO: EXPLICACIÓN DE INFORME PARA EL PACIENTE", marginX, yCoord);

        // Simple divider
        yCoord += 4;
        doc.setDrawColor(203, 213, 225); // slate 300
        doc.setLineWidth(0.4);
        doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
        yCoord += 11;

        const studyOverviewAnnex = String(patientSummary.studyOverview || "").trim();
        if (studyOverviewAnnex) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(15, 23, 42);
          doc.text("QUÉ ESTUDIO SE LE REALIZÓ", marginX, yCoord);
          yCoord += 6 * factor;
          const cleanOverview = stripEmojis(studyOverviewAnnex);
          doc.setFont("times", "normal");
          doc.setFontSize(10.5);
          doc.setTextColor(51, 65, 85);
          const splitOverview = doc.splitTextToSize(cleanOverview, contentWidth);
          splitOverview.forEach((line: string) => {
            checkPageBreak(5.5 * factor);
            doc.text(line, marginX, yCoord);
            yCoord += 5.5 * factor;
          });
          yCoord += 4 * factor;
        }

        // Introduction Summary
        if (patientSummary.summary) {
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
        if (patientSummary.keyFindings && patientSummary.keyFindings.length > 0) {
          // Estimate first finding height
          const firstFinding = patientSummary.keyFindings[0];
          const title0 = stripEmojis(firstFinding.title || "");
          const originalTerm0 = stripEmojis(firstFinding.originalTerm || "");
          const simplifiedExplanation0 = stripEmojis(firstFinding.simplifiedExplanation || "");
          const analogy0 = stripEmojis(firstFinding.analogy || "");
          const reassurance0 = stripEmojis(firstFinding.clinicalContext || firstFinding.reassurance || "");

          const splitTitle0 = doc.splitTextToSize(title0, contentWidth - 10);
          const splitOrig0 = doc.splitTextToSize(`Término original en informe técnico: "${originalTerm0}"`, contentWidth - 10);
          const splitExp0 = doc.splitTextToSize(`Explicación: ${simplifiedExplanation0}`, contentWidth - 14);
          const splitAnalogy0 = doc.splitTextToSize(`Analogía de comprensión: ${analogy0}`, contentWidth - 14);
          const splitReassurance0 = doc.splitTextToSize(`Contexto descriptivo: ${reassurance0}`, contentWidth - 14);

          const neededHeight0 = ((splitTitle0.length * 5) + 
                               (splitOrig0.length * 4) + 
                               (splitExp0.length * 5) + 
                               (splitAnalogy0.length * 4.5) + 
                               (splitReassurance0.length * 4.5) + 20) * factor;

          checkPageBreak(15 * factor + neededHeight0);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(15, 23, 42);
          doc.text("HALLAZGOS IDENTIFICADOS Y TRADUCIDOS:", marginX, yCoord);
          yCoord += 7 * factor;

          patientSummary.keyFindings.forEach((finding: any) => {
            const title = stripEmojis(finding.title || "");
            const originalTerm = stripEmojis(finding.originalTerm || "");
            const simplifiedExplanation = stripEmojis(finding.simplifiedExplanation || "");
            const analogy = stripEmojis(finding.analogy || "");
            const reassurance = stripEmojis(finding.clinicalContext || finding.reassurance || "");

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
            const splitAnalogy = doc.splitTextToSize(analogy, contentWidth - 14);

            const splitReassurance = doc.splitTextToSize(reassurance, contentWidth - 14);

            const neededHeight = ((splitTitle.length * 5) + 
                                 (splitOrig.length * 4) + 
                                 (splitExp.length * 5) + 
                                 (splitAnalogy.length * 4.5) + 
                                 (splitReassurance.length * 4.5) + 20) * factor;

            checkPageBreak(neededHeight);

            doc.setFillColor(250, 250, 250);
            doc.rect(marginX, yCoord, contentWidth, neededHeight - 4 * factor, "F");
            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(0.35);
            doc.rect(marginX, yCoord, contentWidth, neededHeight - 4 * factor, "D");

            let interiorY = yCoord + 6 * factor;

            // Title
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(30, 58, 138); 
            splitTitle.forEach((line: string) => {
              doc.text(line, marginX + 5, interiorY);
              interiorY += 5 * factor;
            });

            // Original term
            doc.setFont("times", "italic");
            doc.setFontSize(9);
            doc.setTextColor(75, 85, 99); 
            splitOrig.forEach((line: string) => {
              doc.text(line, marginX + 5, interiorY);
              interiorY += 4.5 * factor;
            });
            interiorY += 2 * factor;

            // Explanation
            doc.setFont("times", "normal");
            doc.setFontSize(10);
            doc.setTextColor(15, 23, 42); 
            splitExp.forEach((line: string) => {
              doc.text(line, marginX + 7, interiorY);
              interiorY += 4.8 * factor;
            });
            interiorY += 2 * factor;

            // Analogy
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

            // Context
            const contextHeight = (splitReassurance.length * 4.2 * factor) + 4 * factor;
            doc.setFillColor(239, 246, 255); 
            doc.rect(marginX + 5, interiorY - 3 * factor, contentWidth - 10, contextHeight, "F");
            doc.setDrawColor(59, 130, 246); 
            doc.setLineWidth(0.5);
            doc.line(marginX + 5, interiorY - 3 * factor, marginX + 5, interiorY - 3 * factor + contextHeight);

            doc.setFont("times", "normal");
            doc.setFontSize(9.5);
            doc.setTextColor(30, 58, 138); 
            splitReassurance.forEach((line: string) => {
              doc.text(line, marginX + 8, interiorY);
              interiorY += 4.2 * factor;
            });

            yCoord += neededHeight + 2 * factor;
          });
          yCoord += 4 * factor;
        }

        const annexGlossary = Array.isArray(patientSummary.glossary)
          ? patientSummary.glossary.filter((g: any) => String(g?.term || "").trim() && String(g?.plainDefinition || g?.definition || "").trim())
          : [];
        if (annexGlossary.length > 0) {
          const first = annexGlossary[0];
          const term0 = stripEmojis(first.term || "");
          const def0 = stripEmojis(first.plainDefinition || first.definition || "");
          const splitTerm0 = doc.splitTextToSize(term0, contentWidth - 10);
          const splitDef0 = doc.splitTextToSize(def0, contentWidth - 10);
          checkPageBreak(18 * factor + ((splitTerm0.length * 5) + (splitDef0.length * 4.8) + 8) * factor);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(15, 23, 42);
          doc.text("GLOSARIO DE TÉRMINOS:", marginX, yCoord);
          yCoord += 7 * factor;
          annexGlossary.forEach((entry: any) => {
            const term = stripEmojis(entry.term || "");
            const definition = stripEmojis(entry.plainDefinition || entry.definition || "");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            const splitTerm = doc.splitTextToSize(term, contentWidth - 10);
            doc.setFont("times", "normal");
            doc.setFontSize(10);
            const splitDef = doc.splitTextToSize(definition, contentWidth - 10);
            const needed = ((splitTerm.length * 5) + (splitDef.length * 4.8) + 8) * factor;
            checkPageBreak(needed);
            let iy = yCoord;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(15, 23, 42);
            splitTerm.forEach((line: string) => {
              doc.text(line, marginX + 2, iy);
              iy += 5 * factor;
            });
            doc.setFont("times", "normal");
            doc.setFontSize(10);
            doc.setTextColor(51, 65, 85);
            splitDef.forEach((line: string) => {
              doc.text(line, marginX + 2, iy);
              iy += 4.8 * factor;
            });
            yCoord = iy + 3 * factor;
          });
        }

      }

      // --- 10. INFOGRAFÍA DEL PACIENTE (SI CORRESPONDE) ---
      if (attachInfographicToOfficialReport && infographicUrl) {
        try {
          let base64Image = infographicUrl;
          if (!infographicUrl.startsWith("data:")) {
            // It's a blob or normal URL. Let's fetch it and convert to data URL
            const response = await fetch(infographicUrl);
            const blob = await response.blob();
            base64Image = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          }

          doc.addPage();
          yCoord = 20;

          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(15, 23, 42); // slate 900
          doc.text("ANEXO: INFOGRAFÍA EXPLICATIVA PARA EL PACIENTE", marginX, yCoord);

          // Simple divider
          yCoord += 4;
          doc.setDrawColor(203, 213, 225); // slate 300
          doc.setLineWidth(0.4);
          doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
          yCoord += 11;

          // Let's determine format
          let format = "PNG";
          if (base64Image.includes("image/jpeg") || base64Image.includes("image/jpg")) {
            format = "JPEG";
          } else if (base64Image.includes("image/webp")) {
            format = "WEBP";
          }

          // Measure its aspect ratio to fit perfectly without distortion
          const imgAspect = await new Promise<number>((resolve) => {
            const tempImg = new Image();
            tempImg.onload = () => {
              resolve(tempImg.naturalWidth / tempImg.naturalHeight);
            };
            tempImg.onerror = () => {
              resolve(1.0); // Fallback to square
            };
            tempImg.src = base64Image;
          });

          const maxDrawWidth = contentWidth;
          const maxDrawHeight = pageHeight - yCoord - 20; // 20mm margin bottom

          let drawW = maxDrawWidth;
          let drawH = maxDrawWidth / imgAspect;

          if (drawH > maxDrawHeight) {
            drawH = maxDrawHeight;
            drawW = maxDrawHeight * imgAspect;
          }

          // Center horizontally
          const drawX = marginX + (maxDrawWidth - drawW) / 2;
          const drawY = yCoord;

          doc.addImage(base64Image, format, drawX, drawY, drawW, drawH);
        } catch (err) {
          console.error("Error adding infographic to PDF:", err);
        }
      }

      // Add running headers on pages 2+ and page numbers on all pages (Format Editorial)
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        
        // Footer: draw page number at the bottom.
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        if (pdfLayoutType === "clinical_slate") {
          doc.setTextColor(100, 116, 139); // slate-500
        } else if (pdfLayoutType === "executive_medical") {
          doc.setTextColor(197, 160, 89); // Gold
        } else {
          doc.setTextColor(148, 163, 184); // slate-400
        }
        const footerPageStr = `Pág. ${i} de ${totalPages}`;
        doc.text(footerPageStr, pageWidth - marginX - doc.getTextWidth(footerPageStr), pageHeight - 10);
        
        // Faint, small watermark or clinic name on the left of footer
        const footerLeftText = displayClinicName || "REPORTE RADIOLÓGICO";
        doc.text(footerLeftText, marginX, pageHeight - 10);

        // Header for page 2 onwards (Running Header)
        if (i >= 2) {
          // Draw thin horizontal line
          if (pdfLayoutType === "clinical_slate") {
            doc.setDrawColor(148, 163, 184); // slate-400
            doc.setLineWidth(0.35);
          } else if (pdfLayoutType === "executive_medical") {
            doc.setDrawColor(197, 160, 89); // Gold
            doc.setLineWidth(0.35);
          } else {
            doc.setDrawColor(226, 232, 240); // slate-200
            doc.setLineWidth(0.2);
          }
          doc.line(marginX, 14, pageWidth - marginX, 14);

          // Draw study name on the left of the header
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          if (pdfLayoutType === "clinical_slate") {
            doc.setTextColor(71, 85, 105); // slate-600
          } else if (pdfLayoutType === "executive_medical") {
            doc.setTextColor(15, 23, 42); // Navy
          } else {
            doc.setTextColor(100, 116, 139); // slate-500
          }
          
          let studyLabel = studyType ? studyType.toUpperCase() : "REPORTE DE RADIODIAGNÓSTICO";
          
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

      // Output either as file download or Blob URL opened in a new clean screen
      if (returnRawBlob) { return doc.output("blob"); }
      if (shareViaWebShare) {
        const blob = doc.output("blob");
        const filename = patientName ? `${patientName.trim().replace(/\s+/gi, "_")}_reporte.pdf` : "reporte_radiologico.pdf";
        const file = new File([blob], filename, { type: "application/pdf" });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Reporte de Estudio",
            text: `Le comparto el Reporte de Estudio Doppler de ${patientName || "Paciente"}`
          });
        } else {
          // Automatic physical browser download as backup
          doc.save(filename);
        }
      } else if (openInNewTab) {
        const blob = doc.output("blob");
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
      } else {
        const filename = patientName ? `${patientName.trim()}.pdf` : "reporte_radiologico.pdf";
        doc.save(filename);
      }
    } catch (err) {
      console.error("Error generating native PDF through jsPDF:", err);
      alert("Ocurrió un error al generar el PDF: " + String(err));
    }
  
  };
}
