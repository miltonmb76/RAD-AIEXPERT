/** Sanity: menisco interno/externo detection (no bare "lateralidad" false positives). */

function detectKneeMeniscusCompartment(...parts) {
  for (const p of parts) {
    const t = String(p || "").toLowerCase();
    if (!t.trim()) continue;
    const lat =
      /\bmenisco\s+(?:externo|lateral)\b/.test(t) ||
      /\b(?:externo|lateral)\s+(?:del\s+)?menisco\b/.test(t) ||
      /\b(?:external|lateral)\s+meniscus\b/.test(t) ||
      /\bcompartimento\s+lateral\b/.test(t) ||
      /\blado\s+(?:del\s+)?peron/.test(t);
    const med =
      /\bmenisco\s+(?:interno|medial)\b/.test(t) ||
      /\b(?:interno|medial)\s+(?:del\s+)?menisco\b/.test(t) ||
      /\b(?:internal|medial)\s+meniscus\b/.test(t) ||
      /\bcompartimento\s+medial\b/.test(t) ||
      /\blado\s+tibial\b/.test(t);
    if (lat && !med) return "lateral";
    if (med && !lat) return "medial";
  }
  return "unknown";
}

let fail = 0;
function assert(name, cond) {
  if (!cond) {
    console.error("FAIL", name);
    fail++;
  } else console.log("OK", name);
}

assert("externo", detectKneeMeniscusCompartment("menisco externo cuerno posterior") === "lateral");
assert("interno", detectKneeMeniscusCompartment("rotura menisco interno") === "medial");
assert("lateral meniscus", detectKneeMeniscusCompartment("lateral meniscus tear") === "lateral");
assert(
  "no false from lateralidad",
  detectKneeMeniscusCompartment("Lateralidad: Derecha. Tendón patelar.") === "unknown"
);
assert(
  "directive beats stale medial",
  detectKneeMeniscusCompartment("Menisco EXTERNO (peroné)", "Menisco medial") === "lateral"
);
assert("peroné", detectKneeMeniscusCompartment("lado del peroné") === "lateral");
assert("tibial", detectKneeMeniscusCompartment("lado tibial") === "medial");

process.exit(fail ? 1 : 0);
