import type { CaseStoryboardAudience, CaseStoryboardData } from "../lib/caseStoryboard";
import {
  caseStoryboardIsRenderable,
  storyboardFrameCopy,
} from "../lib/caseStoryboard";
import { sanitizePdfText } from "./sanitizePdfText";

function drawContained(
  doc: any,
  dataUrl: string,
  x: number,
  y: number,
  boxW: number,
  boxH: number
) {
  try {
    const props = doc.getImageProperties(dataUrl);
    const iw = Number(props?.width) || boxW;
    const ih = Number(props?.height) || boxH;
    const ratio = iw > 0 && ih > 0 ? iw / ih : 4 / 3;
    let drawW = boxW;
    let drawH = drawW / ratio;
    if (drawH > boxH) {
      drawH = boxH;
      drawW = drawH * ratio;
    }
    const ox = x + (boxW - drawW) / 2;
    const oy = y + (boxH - drawH) / 2;
    const fmt = String(dataUrl).includes("image/png") ? "PNG" : "JPEG";
    doc.addImage(dataUrl, fmt, ox, oy, drawW, drawH);
  } catch {
    doc.setFillColor(30, 41, 59);
    doc.rect(x, y, boxW, boxH, "F");
  }
}

/**
 * Cinematic one-page storyboard annex (clinician or patient tone).
 */
export function renderCaseStoryboardAnnexToPDF(
  doc: any,
  data: CaseStoryboardData | null,
  options: {
    marginX: number;
    pageWidth: number;
    pageHeight: number;
    contentWidth: number;
    factor: number;
    audience?: CaseStoryboardAudience;
  }
) {
  if (!caseStoryboardIsRenderable(data) || !data) return;

  const audience: CaseStoryboardAudience =
    options.audience || data.activeAudience || "clinician";
  const frames = (data.frames || []).slice(0, 5);
  if (!frames.length) return;

  const { marginX, pageWidth, pageHeight, contentWidth, factor } = options;
  const isPatient = audience === "patient";
  // Teal clinician / warm coral patient — ink atmosphere
  const ink = isPatient ? [28, 18, 14] : [6, 24, 32];
  const accent = isPatient ? [251, 146, 60] : [45, 212, 191];
  const accentDeep = isPatient ? [194, 65, 12] : [15, 118, 110];
  const soft = isPatient ? [255, 247, 237] : [240, 253, 250];

  doc.addPage();

  // Full-bleed ink band behind content (within margins for print safety)
  doc.setFillColor(ink[0], ink[1], ink[2]);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  let y = 22 * factor;

  // Eyebrow
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5 * factor);
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text(
    isPatient ? "PARA EL PACIENTE" : "PARA EL CLINICO",
    marginX,
    y
  );
  y += 5.5 * factor;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14 * factor);
  doc.setTextColor(soft[0], soft[1], soft[2]);
  const mainTitle = sanitizePdfText(
    isPatient
      ? data.patientTitle || "La historia de su estudio"
      : data.title || "Storyboard del caso"
  );
  doc.text(mainTitle, marginX, y);
  y += 6.5 * factor;

  // Diagnosis line
  const dx = sanitizePdfText(
    isPatient
      ? data.patientDiagnosis || data.diagnosis || ""
      : data.diagnosis || data.patientDiagnosis || ""
  );
  if (dx) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5 * factor);
    doc.setTextColor(accent[0], accent[1], accent[2]);
    const dxLines = doc.splitTextToSize(dx, contentWidth).slice(0, 2);
    doc.text(dxLines, marginX, y);
    y += dxLines.length * 4.2 * factor + 3 * factor;
  }

  // Accent rule
  doc.setDrawColor(accentDeep[0], accentDeep[1], accentDeep[2]);
  doc.setLineWidth(0.6);
  doc.line(marginX, y, marginX + 42 * factor, y);
  y += 6 * factor;

  // Timeline guide
  const n = frames.length;
  const gap = 3.2 * factor;
  const cardW = (contentWidth - gap * (n - 1)) / n;
  const cardH = Math.min(118 * factor, pageHeight - y - 18 * factor);
  const imgH = Math.min(42 * factor, cardH * 0.38);
  const timelineY = y + 4.5 * factor;

  doc.setDrawColor(accent[0], accent[1], accent[2]);
  doc.setLineWidth(0.35);
  if (n > 1) {
    doc.line(
      marginX + cardW / 2,
      timelineY,
      marginX + (n - 1) * (cardW + gap) + cardW / 2,
      timelineY
    );
  }

  frames.forEach((frame, i) => {
    const x = marginX + i * (cardW + gap);
    const copy = storyboardFrameCopy(frame, audience);
    const title = sanitizePdfText(copy.title);
    const body = sanitizePdfText(copy.body);

    // Card
    doc.setFillColor(
      isPatient ? 40 : 10,
      isPatient ? 28 : 36,
      isPatient ? 22 : 42
    );
    doc.roundedRect(x, y, cardW, cardH, 2, 2, "F");
    doc.setDrawColor(accentDeep[0], accentDeep[1], accentDeep[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, "S");

    // Step disc on timeline
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.circle(x + cardW / 2, timelineY, 3.1 * factor, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7 * factor);
    doc.setTextColor(ink[0], ink[1], ink[2]);
    const step = String(frame.step || i + 1).padStart(2, "0");
    doc.text(step, x + cardW / 2, timelineY + 1.1 * factor, { align: "center" });

    let cy = y + 10 * factor;

    // Image or placeholder
    const imgPad = 2.2 * factor;
    if (frame.imageUrl) {
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(x + imgPad, cy, cardW - imgPad * 2, imgH, 1.2, 1.2, "F");
      drawContained(
        doc,
        frame.imageUrl,
        x + imgPad + 0.6,
        cy + 0.6,
        cardW - imgPad * 2 - 1.2,
        imgH - 1.2
      );
    } else {
      doc.setFillColor(
        isPatient ? 55 : 20,
        isPatient ? 35 : 50,
        isPatient ? 28 : 58
      );
      doc.roundedRect(x + imgPad, cy, cardW - imgPad * 2, imgH, 1.2, 1.2, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5 * factor);
      doc.setTextColor(148, 163, 184);
      doc.text("—", x + cardW / 2, cy + imgH / 2 + 1, { align: "center" });
    }
    cy += imgH + 4.5 * factor;

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.8 * factor);
    doc.setTextColor(soft[0], soft[1], soft[2]);
    const titleLines = doc
      .splitTextToSize(title, cardW - 5 * factor)
      .slice(0, 2);
    doc.text(titleLines, x + 2.5 * factor, cy);
    cy += titleLines.length * 3.4 * factor + 2 * factor;

    // Body
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8 * factor);
    doc.setTextColor(203, 213, 225);
    const maxBodyLines = Math.max(
      3,
      Math.floor((y + cardH - cy - 4 * factor) / (2.9 * factor))
    );
    const bodyLines = doc
      .splitTextToSize(body, cardW - 5 * factor)
      .slice(0, maxBodyLines);
    doc.text(bodyLines, x + 2.5 * factor, cy);
  });

  // Footer caption
  const footY = pageHeight - 11 * factor;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5 * factor);
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text(
    sanitizePdfText(
      isPatient
        ? "Anexo narrativo · lenguaje para el paciente"
        : "Anexo narrativo · correlacion clinica"
    ),
    marginX,
    footY
  );
  if (data.studyRegion) {
    doc.setTextColor(148, 163, 184);
    doc.text(sanitizePdfText(data.studyRegion), pageWidth - marginX, footY, {
      align: "right",
    });
  }
}

/** Render clinician and/or patient pages according to flags. */
export function renderCaseStoryboardAnnexesToPDF(
  doc: any,
  data: CaseStoryboardData | null,
  options: {
    marginX: number;
    pageWidth: number;
    pageHeight: number;
    contentWidth: number;
    factor: number;
  }
) {
  if (!caseStoryboardIsRenderable(data) || !data) return;
  const audiences: CaseStoryboardAudience[] = [];
  if (data.includeClinicianInPdf !== false) audiences.push("clinician");
  if (data.includePatientInPdf !== false) audiences.push("patient");
  if (!audiences.length) audiences.push("clinician");
  for (const audience of audiences) {
    renderCaseStoryboardAnnexToPDF(doc, data, { ...options, audience });
  }
}
