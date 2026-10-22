import type { MskImageContract } from "./mskImageLaterality";

/** A code-generated orientation map, never an anatomical atlas or a patient image.
 * Coordinates are fixed by side/view; no LLM decides which side is highlighted. */
export function mskOrientationMap(contract: Pick<MskImageContract, "organ" | "side" | "view">) {
  const sides = contract.side === "bilateral" ? ["right", "left"] as const : [contract.side];
  return sides.map(side => {
    const lateralLeft = (side === "right") === (contract.view === "AP");
    return { side, lateral: lateralLeft ? "left" : "right", medial: lateralLeft ? "right" : "left",
      bodyX: lateralLeft ? 100 : 220, lateralX: lateralLeft ? 425 : 695, medialX: lateralLeft ? 695 : 425 };
  });
}

export const MSK_ORIENTATION_REFERENCE_GUIDE = `The first attached image is a CODE-GENERATED ORIENTATION MAP, not a patient image, not a lesion reference and not an atlas to reproduce. It locks the patient's side and anterior/posterior camera. Follow its spatial arrangement of medial (toward body midline) and lateral (away from midline). In the knee, the fibula/perone is always lateral; the external/lateral meniscus is on that side, the internal/medial meniscus on the opposite side. Keep anterior/body/posterior distinct. In the shoulder, preserve the highlighted patient side and the arm-versus-trunk direction. Use realistic anatomy from your knowledge, not the map's simplified shapes. Do not print the map, its colors, English instructions or coordinate labels in the final illustration. Do not mirror the final poster. A subsequent attached image, if any, is a rejected candidate to correct, never the orientation authority.`;

export function buildMskOrientationSvg(contract: Pick<MskImageContract, "organ" | "side" | "view">): string {
  const rows = mskOrientationMap(contract);
  const row = (map: typeof rows[number], index: number) => {
    const side = map.side === "left" ? "IZQUIERDO" : "DERECHO";
    const jointY = contract.organ === "shoulder" ? 130 : 330;
    const detail = contract.organ === "knee"
      ? `<path d="M490 95V150Q375 145 385 195Q425 215 480 195H640Q695 215 735 195Q745 145 630 150V95 M390 245Q560 225 730 245L600 345H520Z" fill="#f1f5f9" stroke="#334155" stroke-width="7"/>
         <ellipse cx="${map.lateralX}" cy="215" rx="55" ry="14" fill="#0284c7"/><ellipse cx="${map.medialX}" cy="215" rx="55" ry="14" fill="#c2410c"/>
         <path d="M${map.lateralX} 260V345" stroke="#0284c7" stroke-width="18"/><circle cx="${map.lateralX}" cy="255" r="16" fill="#0284c7"/>
         <text x="${map.lateralX}" y="385" text-anchor="middle">PERONE / FIBULA</text>
         <text x="${map.lateralX}" y="185" text-anchor="middle">EXTERNO</text><text x="${map.medialX}" y="185" text-anchor="middle">INTERNO</text>`
      : `<circle cx="${map.lateralX}" cy="215" r="36" fill="#e0f2fe" stroke="#0284c7" stroke-width="6"/>
         <path d="M${map.lateralX} 250V340" stroke="#0284c7" stroke-width="22"/>
         <path d="M${map.lateralX} 163L${map.medialX} 163" stroke="#c2410c" stroke-width="14"/>
         <text x="${map.lateralX}" y="385" text-anchor="middle">BRAZO / HUMERO</text><text x="${map.medialX}" y="130" text-anchor="middle">HACIA ESTERNON</text>`;
    return `<g transform="translate(0 ${index * 440})">
      <text x="30" y="40" font-size="25" font-weight="bold">${contract.organ === "knee" ? "RODILLA" : "HOMBRO"} ${contract.organ === "knee" ? side.replace(/O$/, "A") : side} DEL PACIENTE - ${contract.view === "AP" ? "DE FRENTE (AP)" : "DE ESPALDAS (PA)"}</text>
      <circle cx="160" cy="85" r="24" fill="#e2e8f0" stroke="#334155" stroke-width="4"/>
      ${contract.view === "AP" ? '<circle cx="152" cy="82" r="2"/><circle cx="168" cy="82" r="2"/>' : ''}
      <path d="M110 120Q160 105 210 120L220 230L195 230L195 395H165L160 260L155 395H125V230H100Z" fill="#e2e8f0" stroke="#334155" stroke-width="4"/>
      <path d="M160 118V400" stroke="#c2410c" stroke-dasharray="7 6" stroke-width="3"/>
      <circle cx="${map.bodyX === 100 ? (contract.organ === "knee" ? 138 : 108) : (contract.organ === "knee" ? 182 : 212)}" cy="${jointY}" r="20" fill="#0284c7" fill-opacity="0.5" stroke="#0284c7" stroke-width="4"/>
      <text x="160" y="430" text-anchor="middle">Línea media del cuerpo</text>
      <text x="${map.lateralX}" y="85" fill="#0284c7" text-anchor="middle" font-weight="bold">LATERAL</text>
      <text x="${map.medialX}" y="85" fill="#c2410c" text-anchor="middle" font-weight="bold">MEDIAL</text>
      ${detail}
    </g>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="${rows.length * 440}" viewBox="0 0 840 ${rows.length * 440}"><rect width="100%" height="100%" fill="white"/><g font-family="Liberation Sans, sans-serif" font-size="17" fill="#0f172a">${rows.map(row).join("")}</g></svg>`;
}

// Only 12 public organ/side/view combinations. Never cache clinical source text.
const references = new Map<string, Promise<string>>();
export function getMskOrientationReference(contract: Pick<MskImageContract, "organ" | "side" | "view">): Promise<string> {
  const key = `${contract.organ}:${contract.side}:${contract.view}`;
  if (!references.has(key)) {
    references.set(key, import("sharp").then(({ default: sharp }) => sharp(Buffer.from(buildMskOrientationSvg(contract))).png().toBuffer())
      .then(data => `data:image/png;base64,${data.toString("base64")}`)
      .catch(error => { references.delete(key); throw error; }));
  }
  return references.get(key)!;
}
