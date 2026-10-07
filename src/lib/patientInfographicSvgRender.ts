/**
 * Deterministic SVG→PNG renderer for patient infographics.
 * AI chooses content/layout; resvg draws real fonts so Spanish stays legible.
 */

import fs from "fs";
import path from "path";
import { Resvg } from "@resvg/resvg-js";
import type { InfographicCard, InfographicTone, PatientInfographicBrief } from "./patientInfographicBrief";

const W = 1080;
const SIGNATURE_BAND = 120;

/** Bundled fonts ship with the repo so Cloud Run does not depend on OS packages. */
function resolveFontsDir(): string {
  const guesses: string[] = [
    path.join(process.cwd(), "assets", "fonts"),
    path.join(process.cwd(), "..", "assets", "fonts"),
  ];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dirname = typeof __dirname !== "undefined" ? __dirname : "";
    if (dirname) {
      guesses.push(path.join(dirname, "assets", "fonts"));
      guesses.push(path.join(dirname, "..", "assets", "fonts"));
    }
  } catch (_) {}
  for (const dir of guesses) {
    if (fs.existsSync(path.join(dir, "LiberationSans-Regular.ttf"))) return dir;
    if (fs.existsSync(path.join(dir, "DejaVuSans.ttf"))) return dir;
  }
  return path.join(process.cwd(), "assets", "fonts");
}

function pickFontFiles(): { regular: string; bold: string } {
  const fontsDir = resolveFontsDir();
  const pairs = [
    {
      regular: path.join(fontsDir, "LiberationSans-Regular.ttf"),
      bold: path.join(fontsDir, "LiberationSans-Bold.ttf"),
    },
    {
      regular: path.join(fontsDir, "DejaVuSans.ttf"),
      bold: path.join(fontsDir, "DejaVuSans-Bold.ttf"),
    },
    {
      regular: "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
      bold: "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    },
  ];
  for (const c of pairs) {
    if (fs.existsSync(c.regular) && fs.existsSync(c.bold)) return c;
  }
  throw new Error(
    `No se encontraron fuentes para la infografía. Se esperaba assets/fonts/LiberationSans-*.ttf. Buscado en: ${fontsDir}`
  );
}

function esc(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text: string, maxChars: number): string[] {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 6);
}

function toneColors(tone: InfographicTone | undefined): {
  bg: string;
  fg: string;
  border: string;
  icon: string;
} {
  if (tone === "attention")
    return { bg: "#FEF3C7", fg: "#92400E", border: "#F59E0B", icon: "#D97706" };
  if (tone === "reassuring")
    return { bg: "#D1FAE5", fg: "#065F46", border: "#34D399", icon: "#059669" };
  return { bg: "#DBEAFE", fg: "#1E3A8A", border: "#60A5FA", icon: "#2563EB" };
}

/** Simple medical glyph inside a soft circle (probe / check / alert / organ). */
function iconCircle(
  cx: number,
  cy: number,
  tone: InfographicTone | undefined,
  kind: "probe" | "check" | "alert" | "info" = "info"
): string {
  const c = toneColors(tone);
  let glyph = "";
  if (kind === "check") {
    glyph = `<path d="M${cx - 12} ${cy} L${cx - 3} ${cy + 10} L${cx + 14} ${cy - 12}" fill="none" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else if (kind === "alert") {
    glyph = `<path d="M${cx} ${cy - 14} L${cx + 14} ${cy + 12} L${cx - 14} ${cy + 12} Z" fill="none" stroke="#FFFFFF" stroke-width="3.2" stroke-linejoin="round"/>
      <circle cx="${cx}" cy="${cy + 6}" r="2.2" fill="#FFFFFF"/>
      <line x1="${cx}" y1="${cy - 4}" x2="${cx}" y2="${cy + 2}" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>`;
  } else if (kind === "probe") {
    glyph = `
      <rect x="${cx - 7}" y="${cy - 16}" width="14" height="22" rx="4" fill="#FFFFFF"/>
      <circle cx="${cx}" cy="${cy + 12}" r="8" fill="none" stroke="#FFFFFF" stroke-width="3"/>
      <line x1="${cx}" y1="${cy + 4}" x2="${cx}" y2="${cy + 12}" stroke="#FFFFFF" stroke-width="3"/>`;
  } else {
    glyph = `
      <circle cx="${cx}" cy="${cy - 8}" r="3.5" fill="#FFFFFF"/>
      <rect x="${cx - 2.5}" y="${cy - 2}" width="5" height="16" rx="2.5" fill="#FFFFFF"/>`;
  }
  return `
    <circle cx="${cx}" cy="${cy}" r="34" fill="${c.icon}" opacity="0.14"/>
    <circle cx="${cx}" cy="${cy}" r="26" fill="${c.icon}"/>
    ${glyph}
  `;
}

function badge(x: number, y: number, label: string, tone?: InfographicTone): string {
  if (!label) return "";
  const c = toneColors(tone);
  const w = Math.min(400, 28 + label.length * 9.5);
  return `
    <rect x="${x}" y="${y}" rx="14" ry="14" width="${w}" height="30" fill="${c.bg}" stroke="${c.border}" stroke-width="1.2"/>
    <text x="${x + 12}" y="${y + 20}" font-size="13" font-weight="700" fill="${c.fg}" font-family="Liberation Sans">${esc(label)}</text>
  `;
}

function pickIconKind(card: InfographicCard, index: number): "probe" | "check" | "alert" | "info" {
  const blob = `${card.title} ${card.status || ""} ${card.body}`.toLowerCase();
  if (card.statusTone === "attention" || /urgenc|riesgo|alerta|sospecha|malign/.test(blob)) return "alert";
  if (card.statusTone === "reassuring" || /benign|normal|sin alter|estable|leve/.test(blob)) return "check";
  if (index === 0 || /hallazgo|diagn|lipoma|esteatos|quiste/.test(blob)) return "probe";
  return "info";
}

function cardBox(
  x: number,
  y: number,
  w: number,
  card: InfographicCard,
  index = 0
): { svg: string; height: number } {
  const pad = 22;
  const iconX = x + pad + 26;
  const textX = x + pad + 72;
  const textW = w - pad * 2 - 72;
  const kind = pickIconKind(card, index);
  const tone = card.statusTone || "calm";

  let h = 0;
  let svg = "";
  svg += `<text x="${textX}" y="${y + pad + 22}" font-size="15" font-weight="700" fill="#64748B" font-family="Liberation Sans">${esc(card.title)}</text>`;
  h = 34;

  if (card.metric) {
    const metricSize = card.metric.length > 14 ? 36 : 48;
    svg += `<text x="${textX}" y="${y + pad + h + metricSize - 8}" font-size="${metricSize}" font-family="Liberation Sans" font-weight="700" fill="#1D4ED8">${esc(card.metric)}</text>`;
    h += metricSize + 4;
  }

  if (card.status) {
    svg += badge(textX, y + pad + h + 6, card.status, tone);
    h += 42;
  }

  const bodyLines = wrapText(card.body, Math.floor(textW / 8.4));
  let by = y + pad + h + 18;
  for (const line of bodyLines) {
    svg += `<text x="${textX}" y="${by}" font-size="16" fill="#334155" font-family="Liberation Sans">${esc(line)}</text>`;
    by += 22;
  }
  h = by - (y + pad) + 2;

  if (card.detail) {
    const dw = Math.min(textW, 520);
    svg += `
      <rect x="${textX}" y="${by + 6}" width="${dw}" height="32" rx="10" fill="#F1F5F9"/>
      <text x="${textX + 12}" y="${by + 26}" font-size="13" fill="#475569" font-family="Liberation Sans">${esc(card.detail)}</text>
    `;
    h += 44;
  }

  const height = Math.max(128, h + pad * 2);
  const iconY = y + Math.min(height / 2, pad + 48);
  const out = `
    <rect x="${x}" y="${y}" width="${w}" height="${height}" rx="20" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.4"/>
    ${iconCircle(iconX, iconY, tone, kind)}
    ${svg}
  `;
  return { svg: out, height };
}

function sectionLabel(x: number, y: number, label: string): string {
  return `<text x="${x}" y="${y}" font-size="12" font-weight="700" fill="#94A3B8" font-family="Liberation Sans" letter-spacing="1.2">${esc(label.toUpperCase())}</text>`;
}

export async function renderPatientInfographicPng(
  brief: PatientInfographicBrief
): Promise<{ pngBase64: string; layout: string }> {
  const fonts = pickFontFiles();
  const margin = 44;
  let y = 44;
  let body = "";

  // Build content first, then size canvas to content (avoids huge empty void)
  const chunks: string[] = [];

  chunks.push(sectionLabel(margin, y, "Infografía para el paciente"));
  y += 28;

  const titleLines = wrapText(brief.title, 30);
  for (const line of titleLines.slice(0, 2)) {
    chunks.push(
      `<text x="${margin}" y="${y}" font-size="40" font-family="Liberation Sans" font-weight="700" fill="#0F172A">${esc(line)}</text>`
    );
    y += 46;
  }
  chunks.push(
    `<text x="${margin}" y="${y + 4}" font-size="17" fill="#64748B" font-family="Liberation Sans">${esc(brief.subtitle)}</text>`
  );
  y += 40;

  const usableCards =
    brief.layout === "two_cards"
      ? (brief.cards.length ? brief.cards : brief.hero ? [brief.hero] : []).slice(0, 2)
      : brief.layout === "hero_metric"
        ? []
        : brief.cards.slice(0, 4);

  if (brief.layout === "hero_metric" && brief.hero) {
    const hero = cardBox(margin, y, W - margin * 2, brief.hero, 0);
    chunks.push(hero.svg);
    y += hero.height + 16;
  } else if (brief.layout === "two_cards" && usableCards.length) {
    const gap = 16;
    const cardW = (W - margin * 2 - gap) / 2;
    let maxH = 0;
    usableCards.slice(0, 2).forEach((card, i) => {
      const bx = margin + i * (cardW + gap);
      const drawn = cardBox(bx, y, cardW, card, i);
      chunks.push(drawn.svg);
      maxH = Math.max(maxH, drawn.height);
    });
    y += maxH + 16;
  } else if (brief.layout === "split_focus") {
    const main = brief.hero || brief.cards[0];
    if (main) {
      const hero = cardBox(margin, y, W - margin * 2, main, 0);
      chunks.push(hero.svg);
      y += hero.height + 14;
    }
    const rest = brief.cards.filter((c) => c !== brief.hero).slice(0, 2);
    for (let i = 0; i < rest.length; i++) {
      const drawn = cardBox(margin, y, W - margin * 2, rest[i], i + 1);
      chunks.push(drawn.svg);
      y += drawn.height + 12;
    }
  } else {
    for (let i = 0; i < usableCards.length; i++) {
      const drawn = cardBox(margin, y, W - margin * 2, usableCards[i], i);
      chunks.push(drawn.svg);
      y += drawn.height + 12;
    }
  }

  // For hero_metric also show remaining cards if present
  if (brief.layout === "hero_metric" && brief.cards?.length) {
    for (let i = 0; i < Math.min(2, brief.cards.length); i++) {
      const drawn = cardBox(margin, y, W - margin * 2, brief.cards[i], i + 1);
      chunks.push(drawn.svg);
      y += drawn.height + 12;
    }
  }

  if (brief.callout) {
    const lines = wrapText(brief.callout, 54);
    const boxH = 26 + lines.length * 22;
    chunks.push(
      `<rect x="${margin}" y="${y}" width="${W - margin * 2}" height="${boxH}" rx="16" fill="#E0F2FE" stroke="#38BDF8" stroke-width="1.2"/>`
    );
    let cy = y + 26;
    for (const line of lines) {
      chunks.push(
        `<text x="${margin + 18}" y="${cy}" font-size="16" font-weight="700" fill="#0C4A6E" font-family="Liberation Sans">${esc(line)}</text>`
      );
      cy += 22;
    }
    y += boxH + 14;
  }

  if (brief.restNormal?.length) {
    const items = brief.restNormal.slice(0, 5);
    const boxH = 48 + items.length * 26;
    chunks.push(
      `<rect x="${margin}" y="${y}" width="${W - margin * 2}" height="${boxH}" rx="16" fill="#FFFFFF" stroke="#BAE6FD" stroke-width="1.4"/>`
    );
    chunks.push(`<rect x="${margin}" y="${y}" width="${W - margin * 2}" height="40" rx="16" fill="#0EA5E9"/>`);
    chunks.push(
      `<rect x="${margin}" y="${y + 24}" width="${W - margin * 2}" height="16" fill="#0EA5E9"/>`
    );
    chunks.push(
      `<text x="${margin + 18}" y="${y + 27}" font-size="15" font-weight="700" fill="#FFFFFF" font-family="Liberation Sans">Sin alteraciones relevantes descritas</text>`
    );
    let iy = y + 58;
    for (const item of items) {
      chunks.push(`<circle cx="${margin + 22}" cy="${iy - 4}" r="5" fill="#34D399"/>`);
      chunks.push(
        `<text x="${margin + 36}" y="${iy}" font-size="15" fill="#334155" font-family="Liberation Sans">${esc(item)}</text>`
      );
      iy += 26;
    }
    y += boxH + 14;
  }

  if (brief.keyMessage) {
    const lines = wrapText(brief.keyMessage, 54);
    const boxH = 30 + lines.length * 22;
    chunks.push(
      `<rect x="${margin}" y="${y}" width="${W - margin * 2}" height="${boxH}" rx="16" fill="#ECFDF5" stroke="#34D399" stroke-width="1.2"/>`
    );
    let cy = y + 28;
    for (const line of lines) {
      chunks.push(
        `<text x="${margin + 18}" y="${cy}" font-size="16" font-weight="700" fill="#065F46" font-family="Liberation Sans">${esc(line)}</text>`
      );
      cy += 22;
    }
    y += boxH + 10;
  }

  const contentBottom = y + 20;
  const H = Math.max(1280, Math.min(1680, contentBottom + SIGNATURE_BAND));

  body += `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#F8FAFC"/>
        <stop offset="50%" stop-color="#EFF6FF"/>
        <stop offset="100%" stop-color="#ECFDF5"/>
      </linearGradient>
      <linearGradient id="wave" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#0EA5E9"/>
        <stop offset="100%" stop-color="#14B8A6"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <circle cx="980" cy="100" r="150" fill="#BAE6FD" opacity="0.32"/>
    <circle cx="60" cy="${H - 180}" r="170" fill="#A7F3D0" opacity="0.22"/>
    ${chunks.join("\n")}
  `;

  const discY = H - SIGNATURE_BAND + 22;
  const discLines = wrapText(brief.disclaimer, 70);
  let dy = discY;
  for (const line of discLines.slice(0, 2)) {
    body += `<text x="${margin}" y="${dy}" font-size="12" fill="#64748B" font-family="Liberation Sans">${esc(line)}</text>`;
    dy += 16;
  }
  body += `<path d="M0 ${H - SIGNATURE_BAND + 4} C 240 ${H - SIGNATURE_BAND - 16}, 480 ${H - SIGNATURE_BAND + 22}, 720 ${H - SIGNATURE_BAND + 2} S 960 ${H - SIGNATURE_BAND - 8}, ${W} ${H - SIGNATURE_BAND + 10} L ${W} ${H} L 0 ${H} Z" fill="url(#wave)" opacity="0.2"/>`;
  body += `<text x="${margin}" y="${H - 22}" font-size="12" fill="#94A3B8" font-family="Liberation Sans">Espacio para firma / sello del médico</text>`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${body}
</svg>`;

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: W },
    font: {
      fontFiles: [fonts.regular, fonts.bold],
      loadSystemFonts: true,
      defaultFontFamily: "Liberation Sans",
      defaultFontWeight: 400,
    },
  });
  const png = Buffer.from(resvg.render().asPng());
  return { pngBase64: png.toString("base64"), layout: brief.layout };
}
