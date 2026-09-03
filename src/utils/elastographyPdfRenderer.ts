import jsPDF from "jspdf";

export interface ElastographyPdfData {
  stiffnessKpa: number;
  capDbM: number;
  fatFractionPercent: number;
  etiology?: string;
  fibrosisStage: "F0" | "F1" | "F2" | "F3" | "F4";
  steatosisGrade: "S0" | "S1" | "S2" | "S3";
  bavenoClassification: string;
  histologicalCorrelation: string;
  velocityMs: number;
  iqrKpa: number;
  iqrMedianRatioPercent: number;
  /** Original B-mode / elastogram photo (left panel) */
  originalImageBase64?: string | null;
  /** AI 3D reconstruction (right panel) */
  image3dBase64?: string | null;
}

function fibrosisMetavirLabel(stage: string, kpa: number): string {
  if (stage === "F0" || stage === "F1") return "F0-F1";
  return stage;
}

function valueColorForStiffness(kpa: number): [number, number, number] {
  if (kpa < 6.0) return [16, 185, 129]; // emerald
  if (kpa < 8.0) return [234, 179, 8]; // amber
  if (kpa < 12.5) return [249, 115, 22]; // orange
  return [239, 68, 68]; // red
}

function valueColorForFat(fat: number): [number, number, number] {
  if (fat < 5.0) return [16, 185, 129];
  if (fat <= 12.0) return [234, 179, 8];
  if (fat <= 20.0) return [249, 115, 22];
  return [239, 68, 68];
}

function drawRoundedRect(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  style: "S" | "F" | "FD" = "S"
) {
  doc.roundedRect(x, y, w, h, r, r, style);
}

function drawGradientBar(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  colors: Array<[number, number, number]>
) {
  const segW = w / colors.length;
  colors.forEach((c, i) => {
    doc.setFillColor(c[0], c[1], c[2]);
    doc.rect(x + i * segW, y, segW + 0.15, h, "F");
  });
}

function safeAddImage(
  doc: jsPDF,
  base64: string,
  x: number,
  y: number,
  w: number,
  h: number
): boolean {
  try {
    const format = base64.includes("image/jpeg") || base64.includes("/9j/") ? "JPEG" : "PNG";
    const data = base64.startsWith("data:") ? base64 : `data:image/${format.toLowerCase()};base64,${base64}`;
    doc.addImage(data, format, x, y, w, h, undefined, "FAST");
    return true;
  } catch {
    try {
      doc.addImage(base64, "JPEG", x, y, w, h, undefined, "FAST");
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Renders the dedicated elastography & QUS annex page matching the clinical
 * workstation layout used in prior studies:
 *  - Title + italic subtitle
 *  - Dark dual-panel workstation (B-mode + 3D AI)
 *  - Visual METAVIR / QUS stratification scales
 *  - 4 metric cards (rigidez, grasa, CAP, confiabilidad)
 *  - Medical interpretation box
 *  - Technical specifications footer box
 */
export function renderElastographyAnnexToPdf(
  doc: jsPDF,
  data: ElastographyPdfData,
  pageSize: "letter" | "a4" = "letter"
): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;
  const factor = pageSize === "a4" ? 1.0 : 0.98;

  doc.addPage();
  let y = 20 * factor;

  // ── TITLE ────────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text(
    "ANEXO: EVALUACIÓN MULTIPARAMÉTRICA Y FUSIÓN 3D (ELASTOGRAFÍA & QUS)",
    marginX,
    y
  );
  y += 3.8 * factor;

  doc.setDrawColor(56, 189, 248); // sky-400
  doc.setLineWidth(0.55);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 5 * factor;

  // ── SUBTITLE ─────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.2 * factor);
  doc.setTextColor(100, 116, 139);
  const subtitle =
    "Mapeo multiparamétrico no invasivo de rigidez acústica tisular y fracción grasa cuantitativa, con renderización 3D híbrida predictiva del estado macroscópico del parénquima hepático.";
  const subLines = doc.splitTextToSize(subtitle, contentWidth);
  doc.text(subLines, marginX, y);
  y += subLines.length * 3.4 * factor + 4 * factor;

  // ── WORKSTATION DUAL PANEL (DARK) ────────────────────────────────────────
  const hasOriginal = !!data.originalImageBase64;
  const has3d = !!data.image3dBase64;
  const workstationH = 68 * factor;
  const headerBarH = 6.5 * factor;
  const imgPad = 3 * factor;
  const imgGap = 4 * factor;
  const labelH = 5 * factor;

  doc.setFillColor(30, 41, 59); // slate-800
  drawRoundedRect(doc, marginX, y, contentWidth, workstationH, 2.5, "F");

  // Teal header bar
  doc.setFillColor(8, 145, 178); // cyan-600
  doc.roundedRect(marginX, y, contentWidth, headerBarH, 2.5, 2.5, "F");
  // Cover bottom rounded corners of header
  doc.rect(marginX, y + headerBarH - 2.5, contentWidth, 2.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5 * factor);
  doc.setTextColor(255, 255, 255);
  doc.text(
    "WORKSTATION BIOMETRÍA TISULAR 2D/3D  •  MAPEO CROMÁTICO DE IMPEDANCIA Y ATENUACIÓN ACÚSTICA",
    marginX + 3 * factor,
    y + 4.3 * factor
  );

  const panelTop = y + headerBarH + imgPad;
  const panelW = (contentWidth - imgPad * 2 - imgGap) / 2;
  const panelImgH = workstationH - headerBarH - imgPad * 2 - labelH - 1;

  // Left panel label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6 * factor);
  doc.setTextColor(125, 211, 252); // sky-300
  doc.text("ORIGINAL (MODO B / ELASTOGRAMA)", marginX + imgPad, panelTop + 3.5 * factor);

  // Right panel label
  doc.text(
    "RECONSTRUCCIÓN 3D (IA)",
    marginX + imgPad + panelW + imgGap,
    panelTop + 3.5 * factor
  );

  const imgY = panelTop + labelH;
  const leftX = marginX + imgPad;
  const rightX = marginX + imgPad + panelW + imgGap;

  // Image backgrounds
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(leftX, imgY, panelW, panelImgH, 1.5, 1.5, "F");
  doc.roundedRect(rightX, imgY, panelW, panelImgH, 1.5, 1.5, "F");

  if (hasOriginal) {
    safeAddImage(doc, data.originalImageBase64!, leftX + 1, imgY + 1, panelW - 2, panelImgH - 2);
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7 * factor);
    doc.setTextColor(148, 163, 184);
    doc.text("Sin imagen original cargada", leftX + panelW / 2, imgY + panelImgH / 2, {
      align: "center",
    });
  }

  if (has3d) {
    safeAddImage(doc, data.image3dBase64!, rightX + 1, imgY + 1, panelW - 2, panelImgH - 2);
    // Badge overlay on 3D
    doc.setFillColor(8, 145, 178);
    doc.roundedRect(rightX + 2, imgY + 2, 38 * factor, 5 * factor, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5 * factor);
    doc.setTextColor(255, 255, 255);
    doc.text("RECONSTRUCCIÓN 3D (IA)", rightX + 3.5 * factor, imgY + 5.2 * factor);
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7 * factor);
    doc.setTextColor(148, 163, 184);
    doc.text("Sin reconstrucción 3D generada", rightX + panelW / 2, imgY + panelImgH / 2, {
      align: "center",
    });
  }

  y += workstationH + 5 * factor;

  // ── VISUAL STRATIFICATION SCALES ─────────────────────────────────────────
  const scalesH = 22 * factor;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.35);
  drawRoundedRect(doc, marginX, y, contentWidth, scalesH, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text(
    "ESCALAS VISUALES DE ESTRATIFICACIÓN DIAGNÓSTICA (CONSENSO EFSUMB / SRU):",
    marginX + 3 * factor,
    y + 4.5 * factor
  );

  const barX = marginX + 48 * factor;
  const barW = contentWidth - 55 * factor;
  const barH = 3.2 * factor;
  const metavirLabel = fibrosisMetavirLabel(data.fibrosisStage, data.stiffnessKpa);

  // Rigidez scale
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5 * factor);
  doc.setTextColor(51, 65, 85);
  doc.text(`Rigidez (METAVIR): ${metavirLabel}`, marginX + 3 * factor, y + 10.5 * factor);

  drawGradientBar(doc, barX, y + 8.2 * factor, barW, barH, [
    [16, 185, 129],
    [234, 179, 8],
    [249, 115, 22],
    [239, 68, 68],
  ]);

  // Scale tick labels
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5 * factor);
  doc.setTextColor(100, 116, 139);
  const tickLabels = ["F0-F1 (<6.0)", "F2 (6.0-7.9)", "F3 (8.0-12.4)", "F4 (≥12.5 kPa)"];
  tickLabels.forEach((t, i) => {
    doc.text(t, barX + (i + 0.5) * (barW / 4), y + 13.8 * factor, { align: "center" });
  });

  // Esteatosis scale
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5 * factor);
  doc.setTextColor(51, 65, 85);
  doc.text(`Esteatosis (QUS): ${data.steatosisGrade}`, marginX + 3 * factor, y + 18.5 * factor);

  drawGradientBar(doc, barX, y + 16.2 * factor, barW, barH, [
    [16, 185, 129],
    [132, 204, 22],
    [234, 179, 8],
    [249, 115, 22],
  ]);

  const fatTicks = ["S0 (<5.0%)", "S1 (5-12%)", "S2 (12-20%)", "S3 (>20.0%)"];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5 * factor);
  doc.setTextColor(100, 116, 139);
  fatTicks.forEach((t, i) => {
    doc.text(t, barX + (i + 0.5) * (barW / 4), y + 20.8 * factor, { align: "center" });
  });

  y += scalesH + 4 * factor;

  // ── 4 METRIC CARDS ───────────────────────────────────────────────────────
  const cardGap = 3 * factor;
  const cardW = (contentWidth - cardGap * 3) / 4;
  const cardH = 28 * factor;
  const stiffColor = valueColorForStiffness(data.stiffnessKpa);
  const fatColor = valueColorForFat(data.fatFractionPercent);
  const iqrGood = data.iqrMedianRatioPercent <= 30;
  const iqrColor: [number, number, number] = iqrGood ? [139, 92, 246] : [249, 115, 22]; // violet / orange
  const capCoeff = (data.capDbM / 100 / 3.5).toFixed(2); // approximate dB/cm/MHz display

  const cards: Array<{
    title: string;
    value: string;
    sub: string;
    footer: string;
    border: [number, number, number];
    valueColor: [number, number, number];
  }> = [
    {
      title: "RIGIDEZ HEPÁTICA",
      value: `${data.stiffnessKpa.toFixed(1)} kPa`,
      sub: `METAVIR: ${metavirLabel}`,
      footer: "V.N. < 6.0 kPa  •  Corte F2: ≥ 7.0",
      border: stiffColor,
      valueColor: stiffColor,
    },
    {
      title: "FRACCIÓN GRASA (QUS)",
      value: `${data.fatFractionPercent.toFixed(1)} %`,
      sub: `Esteatosis: ${data.steatosisGrade}`,
      footer: "V.N. < 5.0% (Consenso SRU)",
      border: fatColor,
      valueColor: fatColor,
    },
    {
      title: "ATENUACIÓN ACÚSTICA (CAP)",
      value: `${Math.round(data.capDbM)} dB/m`,
      sub: `Coeficiente: ${capCoeff} dB/cm/MHz`,
      footer: "Ref: S0 < 238  •  S3 ≥ 290 dB/m",
      border: [56, 189, 248],
      valueColor: [14, 165, 233],
    },
    {
      title: "CONFIABILIDAD TÉCNICA",
      value: `IQR/med ${iqrGood ? "<" : ">"} ${Math.max(15, Math.round(data.iqrMedianRatioPercent))}%`,
      sub: "10/10 Adquisiciones Válidas",
      footer: "Criterio EFSUMB/WFUMB: < 30%",
      border: iqrColor,
      valueColor: iqrColor,
    },
  ];

  cards.forEach((card, i) => {
    const cx = marginX + i * (cardW + cardGap);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(card.border[0], card.border[1], card.border[2]);
    doc.setLineWidth(0.7);
    drawRoundedRect(doc, cx, y, cardW, cardH, 2, "FD");

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.8 * factor);
    doc.setTextColor(71, 85, 105);
    doc.text(card.title, cx + cardW / 2, y + 5 * factor, { align: "center" });

    // Value
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13 * factor);
    doc.setTextColor(card.valueColor[0], card.valueColor[1], card.valueColor[2]);
    doc.text(card.value, cx + cardW / 2, y + 13.5 * factor, { align: "center" });

    // Sub
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5 * factor);
    doc.setTextColor(30, 41, 59);
    doc.text(card.sub, cx + cardW / 2, y + 18.5 * factor, { align: "center" });

    // Footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.2 * factor);
    doc.setTextColor(100, 116, 139);
    const footLines = doc.splitTextToSize(card.footer, cardW - 4 * factor);
    doc.text(footLines, cx + cardW / 2, y + 23 * factor, { align: "center" });
  });

  y += cardH + 4.5 * factor;

  // ── MEDICAL INTERPRETATION ───────────────────────────────────────────────
  const fibDesc =
    data.fibrosisStage === "F0" || data.fibrosisStage === "F1"
      ? `compatible con parénquima hepático normal / sin fibrosis significativa (estadio ${metavirLabel}) según consenso EFSUMB/WFUMB`
      : data.fibrosisStage === "F2"
        ? "compatible con fibrosis significativa (F2); se sugiere correlación clínica y seguimiento"
        : data.fibrosisStage === "F3"
          ? "compatible con fibrosis avanzada (F3 / bridging); alto riesgo de progresión a cACLD"
          : "compatible con cirrosis establecida (F4 / cACLD); valorar hipertensión portal según Baveno VII";

  const steatDesc =
    data.steatosisGrade === "S0"
      ? "compatible con contenido graso normal (S0, < 5%)"
      : data.steatosisGrade === "S1"
        ? "compatible con esteatosis leve (S1)"
        : data.steatosisGrade === "S2"
          ? "compatible con esteatosis moderada (S2)"
          : "compatible con esteatosis severa (S3)";

  const bullets = [
    `Rigidez Tisular: El valor de ${data.stiffnessKpa.toFixed(1)} kPa es ${fibDesc}.`,
    `Fracción Grasa: El valor de ${data.fatFractionPercent.toFixed(1)}% / CAP ${Math.round(data.capDbM)} dB/m es ${steatDesc}.`,
    `Correlación Clínica: Se sugiere correlación con biomarcadores séricos (ALT/AST, FIB-4, APRI) y seguimiento clínico periódico según el perfil metabólico del paciente.`,
  ];

  // Estimate box height from wrapped lines
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7 * factor);
  let interpInnerH = 8 * factor;
  const wrappedBullets: string[][] = bullets.map((b) => {
    const lines = doc.splitTextToSize(`•  ${b}`, contentWidth - 10 * factor);
    interpInnerH += lines.length * 3.6 * factor + 1.5 * factor;
    return lines;
  });
  interpInnerH += 2 * factor;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  drawRoundedRect(doc, marginX, y, contentWidth, interpInnerH, 2, "FD");

  // Cyan left accent
  doc.setFillColor(56, 189, 248);
  doc.rect(marginX, y + 1, 1.8 * factor, interpInnerH - 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text(
    "INTERPRETACIÓN MÉDICA INTEGRADA Y CORRELACIÓN HISTOTISULAR:",
    marginX + 5 * factor,
    y + 5.5 * factor
  );

  let by = y + 10.5 * factor;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7 * factor);
  doc.setTextColor(51, 65, 85);
  wrappedBullets.forEach((lines) => {
    doc.text(lines, marginX + 5 * factor, by);
    by += lines.length * 3.6 * factor + 1.5 * factor;
  });

  y += interpInnerH + 4 * factor;

  // ── TECHNICAL SPECIFICATIONS ─────────────────────────────────────────────
  const techBullets = [
    "Transductor: Sonda Abdominal Convex multifrecuencia (1.5–5.0 MHz).",
    "Modo: Point Shear Wave Elastography (pSWE / 2D-SWE).",
    "Muestreo: Profundidad ROI 2.0–5.0 cm de la cápsula hepática. Mapeo 3D: Reconstrucción volumétrica asistida por IA.",
    "Estándar de Calidad: Calibración según Phantom NEMA y Estándares de Ultrasonografía Cuantitativa (QIBA / SRU / EFSUMB).",
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5 * factor);
  let techH = 8 * factor;
  const wrappedTech = techBullets.map((b) => {
    const lines = doc.splitTextToSize(`•  ${b}`, contentWidth - 8 * factor);
    techH += lines.length * 3.3 * factor + 0.8 * factor;
    return lines;
  });
  techH += 2 * factor;

  // Keep on page if possible
  if (y + techH > pageHeight - 12 * factor) {
    // shrink slightly by reducing spacing is already tight; skip addPage to keep single annex page
    techH = Math.min(techH, pageHeight - y - 10 * factor);
  }

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.35);
  drawRoundedRect(doc, marginX, y, contentWidth, techH, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text(
    "ESPECIFICACIONES TÉCNICAS DEL EQUIPO Y PROTOCOLO DE ADQUISICIÓN:",
    marginX + 3 * factor,
    y + 5 * factor
  );

  let ty = y + 9.5 * factor;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5 * factor);
  doc.setTextColor(71, 85, 105);
  wrappedTech.forEach((lines) => {
    if (ty + lines.length * 3.3 * factor < y + techH - 1) {
      doc.text(lines, marginX + 3 * factor, ty);
      ty += lines.length * 3.3 * factor + 0.8 * factor;
    }
  });
}
