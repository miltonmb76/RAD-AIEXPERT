const BOX_LINE = "═════════════════════";

const EMOJI_STRIP_RE =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E6}-\u{1F1FF}\u{1F191}-\u{1F251}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{3030}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{3297}\u{3299}\u{303D}\u{00A9}\u{00AE}\u{2122}\u{2139}\u{24C2}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{1F000}-\u{1F9FF}]/gu;

export type WhatsAppPreviewInput = {
  patientName: string;
  patientAge: string;
  patientGender: string;
  patientId: string;
  studyType: string;
  reportDate: string;
  doctorName: string;
  formatDateToDMY: (d: string) => string;
  whatsappIncludeOperationalSummary: boolean;
  operationalSummaryText: string;
  whatsappIncludePatientSummary: boolean;
  patientSummary: any;
};

export function buildWhatsAppTextPreview(input: WhatsAppPreviewInput): string {
  let text = `*REPORTE RADIOLÓGICO DIGITAL*\n`;
  text += `*${BOX_LINE}*\n\n`;

  if (input.patientName) text += `*Paciente:* ${input.patientName}\n`;
  if (input.patientAge) text += `*Edad:* ${input.patientAge}\n`;
  if (input.patientGender) text += `*Género:* ${input.patientGender}\n`;
  if (input.patientId) text += `*ID/Cédula:* ${input.patientId}\n`;
  if (input.studyType) text += `*Estudio:* ${input.studyType}\n`;
  if (input.reportDate) text += `*Fecha:* ${input.formatDateToDMY(input.reportDate)}\n`;
  if (input.doctorName) text += `*Especialista:* ${input.doctorName}\n`;
  text += `\n`;

  if (input.whatsappIncludeOperationalSummary && input.operationalSummaryText) {
    const cleanOperationalSummary = input.operationalSummaryText
      .replace(EMOJI_STRIP_RE, "")
      .replace(/\p{Emoji_Presentation}/gu, "")
      .replace(
        /[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g,
        ""
      )
      .replace(/  +/g, " ")
      .trim();

    text += `*RESUMEN CLÍNICO OPERATIVO*\n`;
    text += `*${BOX_LINE}*\n`;
    text += `${cleanOperationalSummary}\n\n`;
  }

  if (input.whatsappIncludePatientSummary && input.patientSummary) {
    text += `*EXPLICACIÓN PARA EL PACIENTE*\n`;
    text += `_Traducción de hallazgos médicos a un lenguaje claro_\n`;
    text += `*${BOX_LINE}*\n\n`;

    if (input.patientSummary.summary) {
      text += `*Resumen de su estado:*\n${input.patientSummary.summary.trim()}\n\n`;
    }

    if (input.patientSummary.keyFindings && input.patientSummary.keyFindings.length > 0) {
      text += `*Hallazgos Principales:*\n`;
      input.patientSummary.keyFindings.forEach((finding: any, idx: number) => {
        const title = finding.finding || finding.title || "";
        const desc = finding.explanation || finding.description || "";
        text += `${idx + 1}. *${title}:* ${desc}\n`;
      });
      text += `\n`;
    }

    if (Array.isArray(input.patientSummary.glossary) && input.patientSummary.glossary.length > 0) {
      text += `*Glosario de términos:*\n`;
      input.patientSummary.glossary.forEach((entry: any, idx: number) => {
        const term = entry.term || "";
        const def = entry.plainDefinition || entry.definition || "";
        text += `${idx + 1}. *${term}:* ${def}\n`;
      });
      text += `\n`;
    }
  }

  text += `*${BOX_LINE}*\n`;
  text += `_Por favor, descargue y conserve los documentos PDF oficiales adjuntos para presentarlos en su próxima consulta de seguimiento._`;
  return text;
}

export function buildWhatsAppSendUrl(phone: string, text: string): string {
  const cleanPhone = phone ? phone.replace(/\D/g, "") : "";
  const urlEncoded = encodeURIComponent(text);
  return cleanPhone
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${urlEncoded}`
    : `https://api.whatsapp.com/send?text=${urlEncoded}`;
}
