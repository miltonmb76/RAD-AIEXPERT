/** MIME / Gmail send helpers and factory for the report email action. */

export function chunkBase64WithCRLF(base64Str: string): string {
  const chunks: string[] = [];
  for (let i = 0; i < base64Str.length; i += 76) {
    chunks.push(base64Str.substring(i, i + 76));
  }
  return chunks.join("\n");
}

/** Strip accents and restrict to safe ASCII characters for MIME headers. */
export function sanitizeMimeFilename(nameStr: string): string {
  return nameStr
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/gi, "n")
    .replace(/[^a-zA-Z0-9_\.-]/g, "_")
    .replace(/\s+/g, "_");
}

export async function resolveInfographicBase64(
  infographicUrl: string
): Promise<{ contentType: string; base64Chunked: string }> {
  let infographicContentType = "image/png";
  let plainInfographicBase64 = "";

  if (infographicUrl.startsWith("data:")) {
    const match = infographicUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      infographicContentType = match[1];
      plainInfographicBase64 = match[2];
    } else {
      throw new Error("Formato de URL de datos de infografía no reconocido.");
    }
  } else {
    const res = await fetch(infographicUrl);
    const blob = await res.blob();
    infographicContentType = blob.type || "image/png";

    const arrayBuf = await blob.arrayBuffer();
    const bytesList = new Uint8Array(arrayBuf);
    let binaryStr = "";
    for (let i = 0; i < bytesList.length; i++) {
      binaryStr += String.fromCharCode(bytesList[i]);
    }
    plainInfographicBase64 = window.btoa(binaryStr);
  }

  return {
    contentType: infographicContentType,
    base64Chunked: chunkBase64WithCRLF(plainInfographicBase64),
  };
}

export function buildGmailMimeRaw(opts: {
  to: string;
  subject: string;
  bodyHtml: string;
  patientName?: string;
  reportPDFBase64?: string;
  explanationPDFBase64?: string;
  infographicBase64?: string;
  infographicContentType?: string;
  attachReport?: boolean;
  attachSummary?: boolean;
  attachInfographic?: boolean;
}): string {
  const boundary = "boundary_part_medico_reporte_" + Math.random().toString(36).substring(2);
  const cleanPatientName = opts.patientName
    ? sanitizeMimeFilename(opts.patientName)
    : "paciente";
  const filenameSummary = `Explicacion_${cleanPatientName}.pdf`;
  const filenameReport = `Reporte_${cleanPatientName}.pdf`;
  const fileExt = opts.infographicContentType === "image/jpeg" ? "jpg" : "png";
  const filenameInfographic = `Infografia_${cleanPatientName}.${fileExt}`;

  const formattedBody = opts.bodyHtml.replace(/\n/g, "<br/>");
  const htmlBodyContent = `<div style="font-family: sans-serif; font-size: 14px; color: #1e293b; line-height: 1.6;">${formattedBody}</div>`;
  const htmlBodyBase64Raw = window.btoa(unescape(encodeURIComponent(htmlBodyContent)));
  const htmlBodyBase64 = chunkBase64WithCRLF(htmlBodyBase64Raw);
  const b64Subject = window.btoa(unescape(encodeURIComponent(opts.subject)));

  const parts: string[] = [];
  parts.push(`MIME-Version: 1.0`);
  parts.push(`To: ${opts.to}`);
  parts.push(`Subject: =?utf-8?B?${b64Subject}?=`);
  parts.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  parts.push(``);

  parts.push(`--${boundary}`);
  parts.push(`Content-Type: text/html; charset="UTF-8"`);
  parts.push(`Content-Transfer-Encoding: base64`);
  parts.push(``);
  parts.push(htmlBodyBase64);
  parts.push(``);

  if (opts.attachReport && opts.reportPDFBase64) {
    parts.push(`--${boundary}`);
    parts.push(`Content-Type: application/pdf; name="${filenameReport}"`);
    parts.push(`Content-Disposition: attachment; filename="${filenameReport}"`);
    parts.push(`Content-Transfer-Encoding: base64`);
    parts.push(``);
    parts.push(opts.reportPDFBase64);
    parts.push(``);
  }

  if (opts.attachSummary && opts.explanationPDFBase64) {
    parts.push(`--${boundary}`);
    parts.push(`Content-Type: application/pdf; name="${filenameSummary}"`);
    parts.push(`Content-Disposition: attachment; filename="${filenameSummary}"`);
    parts.push(`Content-Transfer-Encoding: base64`);
    parts.push(``);
    parts.push(opts.explanationPDFBase64);
    parts.push(``);
  }

  if (opts.attachInfographic && opts.infographicBase64) {
    parts.push(`--${boundary}`);
    parts.push(
      `Content-Type: ${opts.infographicContentType || "image/png"}; name="${filenameInfographic}"`
    );
    parts.push(`Content-Disposition: attachment; filename="${filenameInfographic}"`);
    parts.push(`Content-Transfer-Encoding: base64`);
    parts.push(``);
    parts.push(opts.infographicBase64);
    parts.push(``);
  }

  parts.push(`--${boundary}--`);
  return parts.join("\n");
}

export function encodeMimeToBase64Url(emailRaw: string): string {
  const utf8Encoder = new TextEncoder();
  const bytes = utf8Encoder.encode(emailRaw);
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = window.btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sendGmailRawMessage(
  accessToken: string,
  base64Url: string
): Promise<Response> {
  return fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: base64Url }),
  });
}

export type GmailSendDeps = {
  gmailAccessToken: string | null;
  gmailTo: string;
  gmailBody: string;
  gmailSubject: string;
  gmailAttachReport: boolean;
  gmailAttachSummary: boolean;
  gmailAttachInfographic: boolean;
  patientName: string;
  patientSummary: any;
  generatedReport: string;
  infographicUrl: string;
  handleDownloadPatientSummaryPDF: (...args: any[]) => Promise<any>;
  handleDownloadNativePDF: (...args: any[]) => Promise<any>;
  setIsSendingGmail: (v: boolean) => void;
  setGmailSuccessMessage: (v: string | null) => void;
  setGmailErrorMessage: (v: string | null) => void;
  setGmailAccessToken: (v: string | null) => void;
};

export function createGmailSendAction(d: GmailSendDeps) {
  return async () => {
    if (!d.gmailAccessToken) {
      d.setGmailErrorMessage("Debes iniciar sesión con Google antes de realizar el envío.");
      return;
    }
    if (!d.gmailTo) {
      d.setGmailErrorMessage("Por favor, especifica el correo electrónico del destinatario.");
      return;
    }
    if (!d.gmailAttachReport && !d.gmailAttachSummary && !d.gmailAttachInfographic) {
      d.setGmailErrorMessage("Por favor, selecciona al menos un archivo para adjuntar.");
      return;
    }

    d.setIsSendingGmail(true);
    d.setGmailSuccessMessage(null);
    d.setGmailErrorMessage(null);

    try {
      let explanationPDFBase64 = "";
      let reportPDFBase64 = "";
      let infographicBase64 = "";
      let infographicContentType = "image/png";

      if (d.gmailAttachSummary) {
        if (!d.patientSummary) {
          throw new Error(
            "Debe generar primero la 'Traducción Empática y Explicación' para poder adjuntarla."
          );
        }
        const rawSummaryB64 =
          (await d.handleDownloadPatientSummaryPDF(false, false, true)) || "";
        explanationPDFBase64 = chunkBase64WithCRLF(rawSummaryB64);
      }

      if (d.gmailAttachReport) {
        if (!d.generatedReport) {
          throw new Error("Debe generar primero el 'Reporte de Estudio' para poder adjuntarlo.");
        }
        const rawReportB64 = (await d.handleDownloadNativePDF(false, false, true)) || "";
        reportPDFBase64 = chunkBase64WithCRLF(rawReportB64);
      }

      if (d.gmailAttachInfographic) {
        if (!d.infographicUrl) {
          throw new Error("Debe generar primero la 'Infografía' para poder adjuntarla.");
        }
        try {
          const resolved = await resolveInfographicBase64(d.infographicUrl);
          infographicContentType = resolved.contentType;
          infographicBase64 = resolved.base64Chunked;
        } catch (imageErr: any) {
          throw new Error(
            "Error al preparar la imagen de la infografía: " +
              (imageErr.message || String(imageErr))
          );
        }
      }

      const emailRaw = buildGmailMimeRaw({
        to: d.gmailTo,
        subject: d.gmailSubject,
        bodyHtml: d.gmailBody,
        patientName: d.patientName,
        reportPDFBase64,
        explanationPDFBase64,
        infographicBase64,
        infographicContentType,
        attachReport: d.gmailAttachReport,
        attachSummary: d.gmailAttachSummary,
        attachInfographic: d.gmailAttachInfographic,
      });
      const base64Url = encodeMimeToBase64Url(emailRaw);

      const response = await sendGmailRawMessage(d.gmailAccessToken, base64Url);

      if (!response.ok) {
        if (response.status === 401) {
          d.setGmailAccessToken(null);
          localStorage.removeItem("rad_gmail_access_token");
          throw new Error(
            "Su sesión de Gmail ha expirado por seguridad (las sesiones de Google duran 1 hora). Como hemos habilitado el acceso rápido, simplemente haga clic en 'Autorizar Gmail' para renovarla en 1 segundo sin tener que volver a elegir su cuenta ni ingresar sus datos."
          );
        }
        const errorText = await response.text();
        throw new Error(`Gmail API reportó un error de envío: ${errorText}`);
      }

      d.setGmailSuccessMessage("¡Correo electrónico enviado con éxito vía Gmail!");
    } catch (err: any) {
      console.error("Failed to send email via Gmail:", err);
      d.setGmailErrorMessage("Error al enviar el correo: " + (err.message || String(err)));
    } finally {
      d.setIsSendingGmail(false);
    }
  };
}
