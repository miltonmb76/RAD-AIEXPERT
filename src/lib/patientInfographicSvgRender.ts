/**
 * Deterministic SVG→PNG renderer for patient infographics.
 * AI chooses content/layout; we draw real fonts so Spanish never gibbers.
 */

import fs from "fs";
import path from "path";
import sharp from "sharp";
import type { InfographicCard, InfographicTone, PatientInfographicBrief } from "./patientInfographicBrief";

const W = 1080;
const H = 1620;
const SIGNATURE_BAND = 170;

/** Bundled fonts ship with the repo so Cloud Run does not depend on OS packages. */
function resolveFontsDir(): string {
  const guesses: string[] = [
    path.join(process.cwd(), "assets", "fonts"),
    path.join(process.cwd(), "..", "assets", "fonts"),
  ];
  try {
    // CJS bundle (server.cjs): __dirname is typically project root or dist/
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
    if (fs.existsSync(path.join(dir, "Inter-Regular.ttf"))) return dir;
  }
  return path.join(process.cwd(), "assets", "fonts");
}

function pickFontFamily(): { regular: string; bold: string } {
  const fontsDir = resolveFontsDir();
  const bundled = [
    {
      regular: path.join(fontsDir, "Inter-Regular.ttf"),
      bold: path.join(fontsDir, "Inter-SemiBold.ttf"),
    },
    {
      regular: path.join(fontsDir, "LiberationSans-Regular.ttf"),
      bold: path.join(fontsDir, "LiberationSans-Bold.ttf"),
    },
    {
      regular: path.join(fontsDir, "DejaVuSans.ttf"),
      bold: path.join(fontsDir, "DejaVuSans-Bold.ttf"),
    },
  ];
  const system = [
    {
      regular: "/usr/share/fonts/truetype/macos/Inter-Regular.ttf",
      bold: "/usr/share/fonts/truetype/macos/Inter-SemiBold.ttf",
    },
    {
      regular: "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
      bold: "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    },
    {
      regular: "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
      bold: "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    },
  ];
  for (const c of [...bundled, ...system]) {
    if (fs.existsSync(c.regular) && fs.existsSync(c.bold)) return c;
  }
  throw new Error(
    `No se encontraron fuentes para la infografía. Se esperaba assets/fonts/ (p. ej. LiberationSans-Regular.ttf). Buscado en: ${fontsDir}`
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

function toneColors(tone: InfographicTone | undefined): { bg: string; fg: string; border: string } {
  if (tone === "attention") return { bg: "#FEF3C7", fg: "#92400E", border: "#F59E0B" };
  if (tone === "reassuring") return { bg: "#D1FAE5", fg: "#065F46", border: "#34D399" };
  return { bg: "#DBEAFE", fg: "#1E3A8A", border: "#60A5FA" };
}

function badge(x: number, y: number, label: string, tone?: InfographicTone): string {
  if (!label) return "";
  const c = toneColors(tone);
  const w = Math.min(420, 28 + label.length * 9.2);
  return `
    <rect x="${x}" y="${y}" rx="16" ry="16" width="${w}" height="32" fill="${c.bg}" stroke="${c.border}" stroke-width="1.2"/>
    <text x="${x + 14}" y="${y + 21}" font-size="14" font-weight="700" fill="${c.fg}" font-family="InfographicSans">${esc(label)}</text>
  `;
}

function metricBlock(x: number, y: number, card: InfographicCard, width: number): { svg: string; height: number } {
  let h = 24;
  let svg = `<text x="${x}" y="${y}" font-size="18" font-weight="700" fill="#0F172A" font-family="InfographicSansBold">${esc(card.title)}</text>`;
  h += 8;
  if (card.metric) {
    svg += `<text x="${x}" y="${y + h + 28}" font-size="54" font-weight="800" fill="#1D4ED8" font-family="InfographicSansBold">${esc(card.metric)}</text>`;
    h += 56;
  }
  if (card.status) {
    svg += badge(x, y + h + 8, card.status, card.statusTone);
    h += 48;
  }
  const bodyLines = wrapText(card.body, Math.floor(width / 8.2));
  let by = y + h + 18;
  for (const line of bodyLines) {
    svg += `<text x="${x}" y="${by}" font-size="16" fill="#334155" font-family="InfographicSans">${esc(line)}</text>`;
    by += 22;
  }
  h = by - y + 4;
  if (card.detail) {
    svg += `
      <rect x="${x}" y="${by + 4}" width="${Math.min(width, 420)}" height="34" rx="10" fill="#F1F5F9"/>
      <text x="${x + 12}" y="${by + 26}" font-size="13" fill="#475569" font-family="InfographicSans">${esc(card.detail)}</text>
    `;
    h += 46;
  }
  return { svg, height: h };
}

function cardBox(x: number, y: number, w: number, card: InfographicCard): { svg: string; height: number } {
  const pad = 22;
  const inner = metricBlock(x + pad, y + pad + 8, card, w - pad * 2);
  const height = Math.max(150, inner.height + pad * 2 + 8);
  const svg = `
    <rect x="${x}" y="${y}" width="${w}" height="${height}" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
    ${inner.svg}
  `;
  return { svg, height };
}

export async function renderPatientInfographicPng(
  brief: PatientInfographicBrief
): Promise<{ pngBase64: string; layout: string }> {
  const fonts = pickFontFamily();
  const regularB64 = fs.readFileSync(fonts.regular).toString("base64");
  const boldB64 = fs.readFileSync(fonts.bold).toString("base64");

  const margin = 48;
  let y = 56;
  let body = "";

  // Soft modern background (teal/slate — not purple)
  body += `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#F8FAFC"/>
        <stop offset="55%" stop-color="#EFF6FF"/>
        <stop offset="100%" stop-color="#ECFDF5"/>
      </linearGradient>
      <linearGradient id="wave" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#0EA5E9"/>
        <stop offset="100%" stop-color="#14B8A6"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <circle cx="980" cy="120" r="160" fill="#BAE6FD" opacity="0.35"/>
    <circle cx="80" cy="1400" r="200" fill="#A7F3D0" opacity="0.28"/>
  `;

  // Title
  const titleLines = wrapText(brief.title, 28);
  for (const line of titleLines.slice(0, 2)) {
    body += `<text x="${margin}" y="${y}" font-size="42" font-weight="800" fill="#0F172A" font-family="InfographicSansBold">${esc(line)}</text>`;
    y += 50;
  }
  body += `<text x="${margin}" y="${y + 6}" font-size="18" fill="#64748B" font-family="InfographicSans">${esc(brief.subtitle)}</text>`;
  y += 48;

  const contentBottom = H - SIGNATURE_BAND - 36;
  const usableCards =
    brief.layout === "two_cards"
      ? (brief.cards.length ? brief.cards : brief.hero ? [brief.hero] : []).slice(0, 2)
      : brief.layout === "hero_metric"
        ? []
        : brief.cards.slice(0, 4);

  if (brief.layout === "hero_metric" && brief.hero) {
    const hero = cardBox(margin, y, W - margin * 2, brief.hero);
    body += hero.svg;
    y += hero.height + 22;
  } else if (brief.layout === "two_cards" && usableCards.length) {
    const gap = 18;
    const cardW = (W - margin * 2 - gap) / 2;
    let maxH = 0;
    usableCards.slice(0, 2).forEach((card, i) => {
      const bx = margin + i * (cardW + gap);
      const drawn = cardBox(bx, y, cardW, card);
      body += drawn.svg;
      maxH = Math.max(maxH, drawn.height);
    });
    y += maxH + 22;
  } else if (brief.layout === "split_focus") {
    const main = brief.hero || brief.cards[0];
    if (main) {
      const hero = cardBox(margin, y, W - margin * 2, main);
      body += hero.svg;
      y += hero.height + 20;
    }
  } else {
    for (const card of usableCards) {
      if (y > contentBottom - 160) break;
      const drawn = cardBox(margin, y, W - margin * 2, card);
      body += drawn.svg;
      y += drawn.height + 16;
    }
  }

  // Remaining cards for two_cards/hero already handled; for split_focus add secondary cards
  if (brief.layout === "split_focus") {
    const rest = brief.cards.filter((c) => c !== brief.hero).slice(0, 2);
    for (const card of rest) {
      if (y > contentBottom - 160) break;
      const drawn = cardBox(margin, y, W - margin * 2, card);
      body += drawn.svg;
      y += drawn.height + 16;
    }
  }

  if (brief.callout) {
    const lines = wrapText(brief.callout, 52);
    const boxH = 28 + lines.length * 22;
    body += `<rect x="${margin}" y="${y}" width="${W - margin * 2}" height="${boxH}" rx="18" fill="#E0F2FE" stroke="#38BDF8" stroke-width="1.2"/>`;
    let cy = y + 28;
    for (const line of lines) {
      body += `<text x="${margin + 20}" y="${cy}" font-size="17" font-weight="700" fill="#0C4A6E" font-family="InfographicSansBold">${esc(line)}</text>`;
      cy += 22;
    }
    y += boxH + 18;
  }

  if (brief.restNormal?.length) {
    body += `<rect x="${margin}" y="${y}" width="${W - margin * 2}" height="44" rx="14" fill="#0EA5E9"/>`;
    body += `<text x="${margin + 20}" y="${y + 28}" font-size="16" font-weight="700" fill="#FFFFFF" font-family="InfographicSansBold">Sin alteraciones relevantes descritas</text>`;
    y += 56;
    for (const item of brief.restNormal.slice(0, 5)) {
      if (y > contentBottom - 80) break;
      const lines = wrapText(`• ${item}`, 58);
      for (const line of lines.slice(0, 2)) {
        body += `<text x="${margin + 8}" y="${y}" font-size="16" fill="#334155" font-family="InfographicSans">${esc(line)}</text>`;
        y += 22;
      }
      y += 4;
    }
    y += 8;
  }

  if (brief.keyMessage) {
    const lines = wrapText(brief.keyMessage, 52);
    const boxH = 34 + lines.length * 22;
    if (y + boxH < contentBottom) {
      body += `<rect x="${margin}" y="${y}" width="${W - margin * 2}" height="${boxH}" rx="18" fill="#ECFDF5" stroke="#34D399" stroke-width="1.2"/>`;
      let cy = y + 30;
      for (const line of lines) {
        body += `<text x="${margin + 20}" y="${cy}" font-size="16" font-weight="700" fill="#065F46" font-family="InfographicSansBold">${esc(line)}</text>`;
        cy += 22;
      }
      y = cy + 10;
    }
  }

  // Disclaimer + signature band
  const discY = H - SIGNATURE_BAND + 28;
  const discLines = wrapText(brief.disclaimer, 70);
  let dy = discY;
  for (const line of discLines.slice(0, 3)) {
    body += `<text x="${margin}" y="${dy}" font-size="13" fill="#64748B" font-family="InfographicSans">${esc(line)}</text>`;
    dy += 18;
  }
  // Decorative wave above signature band, leave band empty for stamp
  body += `<path d="M0 ${H - SIGNATURE_BAND + 8} C 240 ${H - SIGNATURE_BAND - 18}, 480 ${H - SIGNATURE_BAND + 28}, 720 ${H - SIGNATURE_BAND + 4} S 960 ${H - SIGNATURE_BAND - 10}, ${W} ${H - SIGNATURE_BAND + 12} L ${W} ${H} L 0 ${H} Z" fill="url(#wave)" opacity="0.22"/>`;
  body += `<text x="${margin}" y="${H - 28}" font-size="12" fill="#94A3B8" font-family="InfographicSans">Espacio para firma / sello del médico</text>`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <style>
    @font-face {
      font-family: "InfographicSans";
      src: url("data:font/ttf;base64,${regularB64}") format("truetype");
      font-weight: 400;
    }
    @font-face {
      font-family: "InfographicSansBold";
      src: url("data:font/ttf;base64,${boldB64}") format("truetype");
      font-weight: 700;
    }
  </style>
  ${body}
</svg>`;

  const png = await sharp(Buffer.from(svg)).png({ quality: 95 }).toBuffer();
  return { pngBase64: png.toString("base64"), layout: brief.layout };
}
