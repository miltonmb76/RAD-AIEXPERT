import { cleanRawClinicalText } from "./reportTextHelpers";

export async function copyReportToClipboard(
  text: string,
  opts: {
    isReport?: boolean;
    presetId?: string;
    onReportCopied?: () => void;
    onPresetCopied?: (presetId: string) => void;
  } = {},
) {
  const isReport = Boolean(opts.isReport);
  const presetId = opts.presetId;

  // 1. Clean the text using our robust clinical parsing (clears LaTeX & math unicode gaps)
  const cleanText = cleanRawClinicalText(text);

  if (isReport) {
    // 2. Generate clean plain text (absolutely free of markdown '**' characters and heading hash signs)
    const cleanPlainText = cleanText
      .replace(/^(#+\s+)/gm, "")
      .replace(/\*\*(.*?)\*\*/g, "$1") // Strip and clean asterisks
      .replace(/\n\n+/g, "\n\n\n"); // Ensure triple returns between sections

    // 3. Generate rich HTML snippet for direct, styled pasting in MS Word / Word processors
    const paragraphs = cleanText.split(/\n\n+/);
    const htmlSnippet = paragraphs
      .map((p, pIdx) => {
        // Escape HTML characters before formatting bolding so MS Word doesn't swallow <5mm etc as tags
        let formattedPara = p
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        
        // Detect headings in paragraph
        let isHeading = false;
        let headingLevel = 0;
        if (formattedPara.startsWith("# ")) {
          isHeading = true;
          headingLevel = 1;
          formattedPara = formattedPara.replace(/^#\s+/, "");
        } else if (formattedPara.startsWith("## ")) {
          isHeading = true;
          headingLevel = 2;
          formattedPara = formattedPara.replace(/^##\s+/, "");
        } else if (formattedPara.startsWith("### ")) {
          isHeading = true;
          headingLevel = 3;
          formattedPara = formattedPara.replace(/^###\s+/, "");
        } else if (formattedPara.startsWith("#### ")) {
          isHeading = true;
          headingLevel = 4;
          formattedPara = formattedPara.replace(/^####\s+/, "");
        }

        formattedPara = formattedPara.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
        formattedPara = formattedPara.replace(/\n/g, "<br />");
        
        // Center main title or h1 headings
        const isMainTitle = pIdx === 0 || headingLevel === 1 || (/REPORTE DE ESTUDIO|REPORTE|INFORME/i.test(p) && pIdx <= 1);
        
        let alignmentStyle = "";
        let fontSizeStyle = "font-size: 11.5pt;";
        let fontWeightStyle = "font-weight: normal;";
        let marginTopStyle = "margin-top: 0pt;";

        if (isMainTitle) {
          alignmentStyle = "text-align: center;";
          fontSizeStyle = "font-size: 14pt;";
          fontWeightStyle = "font-weight: bold;";
        } else if (isHeading) {
          fontWeightStyle = "font-weight: bold;";
          marginTopStyle = "margin-top: 15pt;";
          if (headingLevel === 2) {
            fontSizeStyle = "font-size: 13pt;";
          } else {
            fontSizeStyle = "font-size: 12pt;";
          }
        }

        const spacer = pIdx < paragraphs.length - 1 
          ? `<p style="margin: 0; line-height: 1.5; font-size: 11.5pt; font-family: 'Arial', sans-serif;">&nbsp;</p>` 
          : '';

        // Use standard spacing styled with a margin-bottom of 14pt for standard Arial font
        return `<p style="margin: 0; margin-bottom: 14pt; ${marginTopStyle} font-family: 'Arial', sans-serif; ${fontSizeStyle} ${fontWeightStyle} line-height: 1.5; color: #000000; ${alignmentStyle}">${formattedPara}</p>${spacer}`;
      })
      .join("");

    const fullHtml = `<html><head><meta charset="utf-8"></head><body>${htmlSnippet}</body></html>`;

    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const item = new ClipboardItem({
          "text/plain": new Blob([cleanPlainText], { type: "text/plain" }),
          "text/html": new Blob([fullHtml], { type: "text/html" }),
        });
        await navigator.clipboard.write([item]);
      } else {
        await navigator.clipboard.writeText(cleanPlainText);
      }
      opts.onReportCopied?.();
    } catch (err) {
      console.warn("Fallback to basic clipboard write due to:", err);
      try {
        await navigator.clipboard.writeText(cleanPlainText);
        opts.onReportCopied?.();
      } catch (fallbackErr) {
        console.error("Clipboard copy failed entirely:", fallbackErr);
      }
    }
  } else if (presetId) {
    try {
      await navigator.clipboard.writeText(cleanText);
    } catch (err) {
      await navigator.clipboard.writeText(cleanText);
    }
    opts.onPresetCopied?.(presetId);
  } else {
    try {
      await navigator.clipboard.writeText(cleanText);
    } catch (err) {
      await navigator.clipboard.writeText(cleanText);
    }
    alert("Copiado al portapapeles exitosamente");
  }
}
