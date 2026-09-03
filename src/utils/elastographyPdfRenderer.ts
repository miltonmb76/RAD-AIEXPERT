import jsPDF from "jspdf";

export interface ElastographyPdfData {
  stiffnessKpa: number;
  capDbM: number;
  fatFractionPercent: number;
  etiology?: string;
  // Derived fields (computed in App.tsx before passing)
  fibrosisStage: "F0" | "F1" | "F2" | "F3" | "F4";
  steatosisGrade: "S0" | "S1" | "S2" | "S3";
  bavenoClassification: string;
  histologicalCorrelation: string;
  velocityMs: number;
  iqrKpa: number;
  iqrMedianRatioPercent: number;
  // Optional 3D render image
  image3dBase64?: string | null;
}

function fibrosisColor(stage: string): [number, number, number] {
  if (stage === "F0") return [16, 185, 129]; // emerald
  if (stage === "F1") return [6, 182, 212];  // cyan
  if (stage === "F2") return [234, 179, 8];  // amber
  if (stage === "F3") return [249, 115, 22]; // orange
  return [239, 68, 68]; // red – F4
}

function steatosisColor(grade: string): [number, number, number] {
  if (grade === "S0") return [16, 185, 129];
  if (grade === "S1") return [234, 179, 8];
  if (grade === "S2") return [249, 115, 22];
  return [239, 68, 68];
}

function bavenoAccentColor(stiffness: number): [number, number, number] {
  if (stiffness < 5.0) return [16, 185, 129];
  if (stiffness < 10.0) return [6, 182, 212];
  if (stiffness < 15.0) return [234, 179, 8];
  if (stiffness < 20.0) return [249, 115, 22];
  if (stiffness <= 25.0) return [239, 68, 68];
  return [168, 85, 247];
}

/**
 * Renders a dedicated full-page Annex for Elastografía & QUS 3D into the jsPDF document.
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

  let y = 22 * factor;

  // ── HEADER ───────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text("ANEXO: EVALUACIÓN MULTIPARAMÉTRICA HEPÁTICA — ELASTOGRAFÍA & QUS", marginX, y);
  y += 4.5 * factor;

  doc.setDrawColor(79, 70, 229);
  doc.setLineWidth(0.8);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 6 * factor;

  // ── SUBTITLE ──────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5 * factor);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Elastografía de Onda de Corte (SWE) · Parámetro de Atenuación Controlada (CAP) · Fracción Grasa Cuantitativa (QUS/PDFF)",
    marginX, y
  );
  y += 7 * factor;

  // ── 3-COLUMN KPI BOXES ────────────────────────────────────────────────────
  const boxW = (contentWidth - 8 * factor) / 3;
  const boxH = 22 * factor;
  const boxGap = 4 * factor;

  const kpis = [
    {
      label: "RIGIDEZ HEPÁTICA (SWE)",
      value: `${data.stiffnessKpa.toFixed(1)} kPa`,
      sub: `v = ${data.velocityMs.toFixed(2)} m/s`,
      color: fibrosisColor(data.fibrosisStage),
      badge: `METAVIR ${data.fibrosisStage}`,
    },
    {
      label: "PARÁMETRO ATENUACIÓN (CAP)",
      value: `${Math.round(data.capDbM)} dB/m`,
      sub: "Parámetro de Fibroscan",
      color: steatosisColor(data.steatosisGrade),
      badge: `Esteatosis ${data.steatosisGrade}`,
    },
    {
      label: "FRACCIÓN GRASA QUS/PDFF",
      value: `${data.fatFractionPercent.toFixed(1)} %`,
      sub: "Cuantificación ultrasonora",
      color: steatosisColor(data.steatosisGrade),
      badge: data.fatFractionPercent < 5 ? "Normal" : data.fatFractionPercent <= 12 ? "Leve" : data.fatFractionPercent <= 20 ? "Moderada" : "Severa",
    },
  ];

  kpis.forEach((kpi, i) => {
    const bx = marginX + i * (boxW + boxGap);
    const [r, g, b] = kpi.color;

    // Box background (very light tint)
    doc.setFillColor(r, g, b);
    doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
    doc.roundedRect(bx, y, boxW, boxH, 2, 2, "F");
    doc.setGState(new (doc as any).GState({ opacity: 1.0 }));

    // Left accent bar
    doc.setFillColor(r, g, b);
    doc.rect(bx, y, 1.5 * factor, boxH, "F");

    // Label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5 * factor);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, bx + 4 * factor, y + 5 * factor);

    // Value
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14 * factor);
    doc.setTextColor(r, g, b);
    doc.text(kpi.value, bx + 4 * factor, y + 12 * factor);

    // Sub
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5 * factor);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.sub, bx + 4 * factor, y + 16 * factor);

    // Badge
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8 * factor);
    doc.setTextColor(r, g, b);
    doc.text(kpi.badge, bx + 4 * factor, y + 20 * factor);
  });

  y += boxH + 8 * factor;

  // ── OPTIONAL 3D IMAGE ─────────────────────────────────────────────────────
  if (data.image3dBase64) {
    const imgMaxW = contentWidth * 0.42;
    const imgMaxH = 55 * factor;
    const imgW = imgMaxW;
    const imgH = imgMaxW * 0.75;
    const finalH = Math.min(imgH, imgMaxH);
    const finalW = finalH / 0.75;
    const imgX = marginX + (contentWidth - finalW) / 2;

    try {
      doc.addImage(data.image3dBase64, "PNG", imgX, y, finalW, finalH);
      y += finalH + 4 * factor;

      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5 * factor);
      doc.setTextColor(100, 116, 139);
      doc.text(
        "Figura A. Representación 3D macroscópica hepática. Rigidez hepática y esteatosis cuantitativa por Elastografía SWE y QUS.",
        pageWidth / 2,
        y,
        { align: "center" }
      );
      y += 7 * factor;
    } catch (_e) {
      // Skip image if error
    }
  }

  // ── BAVENO VII CLASSIFICATION ──────────────────────────────────────────────
  const [br, bg, bb] = bavenoAccentColor(data.stiffnessKpa);

  doc.setFillColor(br, bg, bb);
  doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
  doc.roundedRect(marginX, y, contentWidth, 12 * factor, 2, 2, "F");
  doc.setGState(new (doc as any).GState({ opacity: 1.0 }));

  doc.setFillColor(br, bg, bb);
  doc.rect(marginX, y, 1.5 * factor, 12 * factor, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text("CLASIFICACIÓN BAVENO VII:", marginX + 4 * factor, y + 4.5 * factor);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7 * factor);
  const bavenoLines = doc.splitTextToSize(data.bavenoClassification, contentWidth - 8 * factor);
  doc.text(bavenoLines, marginX + 4 * factor, y + 9 * factor);
  y += 12 * factor + (bavenoLines.length > 1 ? (bavenoLines.length - 1) * 4 * factor : 0) + 5 * factor;

  // ── IQR QUALITY METRICS ────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text("MÉTRICAS DE CALIDAD DE ADQUISICIÓN", marginX, y);
  y += 5 * factor;

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 4 * factor;

  const iqrGood = data.iqrMedianRatioPercent <= 30;
  const iqrColor = iqrGood ? ([16, 185, 129] as [number, number, number]) : ([249, 115, 22] as [number, number, number]);

  const qualityRows = [
    { label: "IQR (Rango Intercuartílico)", value: `${data.iqrKpa.toFixed(1)} kPa` },
    { label: "IQR/Mediana (Ratio de Calidad)", value: `${data.iqrMedianRatioPercent.toFixed(1)}% ${iqrGood ? "✓ Óptima" : "⚠ Subóptima"}` },
    { label: "Velocidad Onda de Corte", value: `${data.velocityMs.toFixed(2)} m/s` },
  ];

  const colL = contentWidth * 0.6;
  qualityRows.forEach((row) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5 * factor);
    doc.setTextColor(51, 65, 85);
    doc.text(row.label, marginX, y);
    doc.setFont("helvetica", "bold");
    if (row.label.includes("IQR/Mediana")) {
      doc.setTextColor(...iqrColor);
    } else {
      doc.setTextColor(15, 23, 42);
    }
    doc.text(row.value, marginX + colL, y, { align: "left" });
    y += 5 * factor;
  });

  y += 4 * factor;

  // ── HISTOLOGICAL CORRELATION ───────────────────────────────────────────────
  if (data.histologicalCorrelation) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8 * factor);
    doc.setTextColor(15, 23, 42);
    doc.text("CORRELACIÓN HISTOLÓGICA ESTIMADA", marginX, y);
    y += 5 * factor;

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 4 * factor;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5 * factor);
    doc.setTextColor(51, 65, 85);
    const histoLines = doc.splitTextToSize(data.histologicalCorrelation, contentWidth);
    doc.text(histoLines, marginX, y);
    y += histoLines.length * 4.5 * factor + 5 * factor;
  }

  // ── ETIOLOGY LABEL ────────────────────────────────────────────────────────
  if (data.etiology) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7 * factor);
    doc.setTextColor(100, 116, 139);
    doc.text(`Etiología evaluada: ${data.etiology}`, marginX, y);
    y += 5 * factor;
  }

  // ── DISCLAIMER ────────────────────────────────────────────────────────────
  if (y < pageHeight - 20 * factor) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5 * factor);
    doc.setTextColor(148, 163, 184);
    const disclaimer = "Este módulo presenta valores de elastografía de onda de corte (SWE) e índices QUS/PDFF de manera orientativa. Los resultados deben interpretarse en el contexto clínico completo del paciente y no reemplazan la biopsia hepática cuando esté clínicamente indicada.";
    const disclaimerLines = doc.splitTextToSize(disclaimer, contentWidth);
    doc.text(disclaimerLines, marginX, pageHeight - 14 * factor);
  }
}
