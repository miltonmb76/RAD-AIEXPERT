import { MeasurementGaugeData, MeasurementGaugeItem } from "../types";

function sanitizePdfText(input: string): string {
  return (input || "")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/–|—/g, "-")
    .replace(/[^\x00-\x7F]/g, (ch) => {
      try {
        return ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      } catch {
        return "?";
      }
    });
}

function statusRgb(status: MeasurementGaugeItem["status"]): [number, number, number] {
  switch (status) {
    case "altered":
      return [225, 29, 72];
    case "borderline":
      return [217, 119, 6];
    case "normal":
      return [5, 150, 105];
    default:
      return [100, 116, 139];
  }
}

function statusLabel(status: MeasurementGaugeItem["status"]): string {
  switch (status) {
    case "altered":
      return "Alterado";
    case "borderline":
      return "Limite";
    case "normal":
      return "Normal";
    default:
      return "N/D";
  }
}

/**
 * PDF annex: quantitative measurements as bars vs reference range.
 * When includeNormals is false, only altered/borderline rows are drawn.
 */
export function renderMeasurementsGaugeAnnexToPDF(
  doc: any,
  data: MeasurementGaugeData | null,
  options: {
    marginX: number;
    pageWidth: number;
    pageHeight: number;
    contentWidth: number;
    factor: number;
    includeNormals?: boolean;
  }
) {
  if (!data?.measurements?.length) return;

  const { marginX, pageWidth, pageHeight, contentWidth, factor } = options;
  const includeNormals = options.includeNormals === true;
  const rows = data.measurements.filter((m) => {
    if (m.status === "not_found") return false;
    if (!includeNormals && m.status === "normal") return false;
    return m.valueNumeric != null || !!(m.measuredValue && m.measuredValue.trim());
  });
  if (!rows.length) return;

  const pageBottom = pageHeight - 14 * factor;
  doc.addPage();
  let y = 18 * factor;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text("ANEXO: MEDICIONES CUANTITATIVAS vs RANGO", marginX, y);
  y += 4.2 * factor;

  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.8);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 5.5 * factor;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9 * factor);
  doc.setTextColor(30, 64, 175);
  doc.text(sanitizePdfText(data.studyType || "Estudio detectado"), marginX, y);
  y += 4 * factor;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5 * factor);
  doc.setTextColor(71, 85, 105);
  const ref = sanitizePdfText(
    `Referencia: ${data.referenceSource || "Rangos clinicos estandar"}. ` +
      (includeNormals
        ? "Se incluyen medidas normales y alteradas."
        : "Solo medidas alteradas o en limite.")
  );
  const refLines = doc.splitTextToSize(ref, contentWidth);
  refLines.forEach((line: string) => {
    doc.text(line, marginX, y);
    y += 3.3 * factor;
  });
  y += 2.5 * factor;

  const barH = 4.2 * factor;
  const rowGap = 3.2 * factor;

  for (const m of rows) {
    const rowBlockH = 16 * factor;
    if (y + rowBlockH > pageBottom) {
      doc.addPage();
      y = 18 * factor;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10 * factor);
      doc.setTextColor(15, 23, 42);
      doc.text("ANEXO: MEDICIONES (continuacion)", marginX, y);
      y += 6 * factor;
    }

    const [sr, sg, sb] = statusRgb(m.status);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2 * factor);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(m.name), marginX, y);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.4 * factor);
    doc.setTextColor(sr, sg, sb);
    const rightLabel = sanitizePdfText(
      `${m.measuredValue || "-"}${
        m.unit && !String(m.measuredValue).includes(m.unit) ? ` ${m.unit}` : ""
      }`
    );
    doc.text(rightLabel, pageWidth - marginX, y, { align: "right" });
    y += 3.6 * factor;

    const barX = marginX;
    const barW = contentWidth;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(barX, y, barW, barH, 0.8, 0.8, "F");

    const scaleMin = Number.isFinite(m.scaleMin) ? m.scaleMin : 0;
    const scaleMax =
      Number.isFinite(m.scaleMax) && m.scaleMax > scaleMin ? m.scaleMax : scaleMin + 1;
    const span = scaleMax - scaleMin;

    const bandL = m.rangeMin == null ? scaleMin : Math.max(scaleMin, m.rangeMin);
    const bandR = m.rangeMax == null ? scaleMax : Math.min(scaleMax, m.rangeMax);
    const bandX = barX + ((bandL - scaleMin) / span) * barW;
    const bandW = Math.max(1.2 * factor, ((bandR - bandL) / span) * barW);
    doc.setFillColor(209, 250, 229);
    doc.roundedRect(bandX, y, bandW, barH, 0.6, 0.6, "F");

    if (m.valueNumeric != null && Number.isFinite(m.valueNumeric)) {
      const t = Math.min(1, Math.max(0, (m.valueNumeric - scaleMin) / span));
      const mx = barX + t * barW;
      doc.setFillColor(sr, sg, sb);
      doc.circle(mx, y + barH / 2, 1.7 * factor, "F");
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.35);
      doc.circle(mx, y + barH / 2, 1.7 * factor, "S");
    }

    y += barH + 2.2 * factor;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8 * factor);
    doc.setTextColor(100, 116, 139);
    doc.text(
      sanitizePdfText(`Rango: ${m.normalRangeLabel}   |   ${statusLabel(m.status)}`),
      marginX,
      y
    );
    if (m.interpretation) {
      const interp = doc.splitTextToSize(sanitizePdfText(m.interpretation), contentWidth * 0.55);
      doc.text(interp[0], pageWidth - marginX, y, { align: "right" });
    }
    y += rowGap + 2.5 * factor;
  }

  if (y + 10 * factor > pageBottom) {
    doc.addPage();
    y = 18 * factor;
  }
  y += 1 * factor;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5 * factor);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Leyenda: banda verde = rango de referencia; marcador = valor del informe (verde normal / ambar limite / rojo alterado).",
    marginX,
    y
  );
}
