/** Sanity: clinical hour extraction + polar map (7≠5, ignore polluted 12 o'clock). */

function extractBreastClockHourFromText(text) {
  const t = String(text || "");
  if (!t.trim()) return null;
  if (
    /BREAST CLOCK GEOMETRY|ASCII DIAL|degreesFrom12|LESION CLOCK PIN|superior breast\s*\/\s*12|inferior breast\s*\/\s*6/i.test(
      t
    ) &&
    !/\beje\b|\bhora\b|\bradio\b|\b\d{1,2}\s*h\b/i.test(t)
  ) {
    return null;
  }
  const clinicalPatterns = [
    /\beje\s+(?:de\s+)?(?:las?\s+)?(1[0-2]|[1-9])\b/i,
    /\b(?:a\s+las|en\s+las|de\s+las)\s+(1[0-2]|[1-9])\b/i,
    /\bhora\s*[:\-]?\s*(1[0-2]|[1-9])\b/i,
    /\b(1[0-2]|[1-9])\s*h(?:oras?)?\b(?!\s*o['’]?clock)/i,
    /\bradio\s*(1[0-2]|[1-9])\b/i,
    /\b(?:en|a)\s+(1[0-2]|[1-9])\s*(?:h|horas?|:00)\b/i,
  ];
  for (const re of clinicalPatterns) {
    const m = t.match(re);
    if (m) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 12) return n;
    }
  }
  const en = t.match(
    /\b(?:lesion|finding|nodule|mass|target|at|placed?(?:\s+at)?)\s+[^\n.]{0,40}?\b(1[0-2]|[1-9])\s*o['’]?clock\b/i
  );
  if (en) {
    const n = Number(en[1]);
    if (n >= 1 && n <= 12) return n;
  }
  return null;
}
function extractBreastClockHour(...parts) {
  for (const p of parts) {
    const n = extractBreastClockHourFromText(String(p || ""));
    if (n != null) return n;
  }
  return null;
}
function mirrorBreastClockHour(hour) {
  if (hour === 12 || hour === 6) return null;
  return (12 - (hour % 12)) || 12;
}
function getBreastClockGeometry(hour) {
  const h = Math.min(12, Math.max(1, Math.round(hour)));
  const degreesFrom12 = (h % 12) * 30;
  const rad = (degreesFrom12 * Math.PI) / 180;
  return {
    hour: h,
    degreesFrom12,
    nx: Math.sin(rad),
    ny: -Math.cos(rad),
    mirrorHour: mirrorBreastClockHour(h),
  };
}
function clockHourDistance(a, b) {
  const d = Math.abs(((a % 12) + 12) % 12 - ((b % 12) + 12) % 12);
  return Math.min(d, 12 - d);
}

let fail = 0;
function assert(name, cond) {
  if (!cond) {
    console.error("FAIL", name);
    fail++;
  } else console.log("OK", name);
}

assert("eje 10", extractBreastClockHourFromText("eje 10 derecho") === 10);
assert(
  "eje de las 7",
  extractBreastClockHourFromText("nódulo en eje de las 7 de mama derecha") === 7
);
assert(
  "ignore landmark 12 o'clock",
  extractBreastClockHourFromText("superior breast / 12 o'clock landmark") === null
);
assert(
  "clinical beats polluted 12",
  extractBreastClockHour(
    "Lesión en eje de las 7 mama derecha",
    "superior breast / 12 o'clock. Focus at 12 o'clock."
  ) === 7
);
assert(
  "directive beats stale 2",
  extractBreastClockHour("Mama derecha eje 10 CSE", "Mama derecha, 2h") === 10
);
assert("mirror 10→2", mirrorBreastClockHour(10) === 2);
assert("mirror 7→5", mirrorBreastClockHour(7) === 5);
assert("7 is viewer-left", getBreastClockGeometry(7).nx < -0.3);
assert("5 is viewer-right", getBreastClockGeometry(5).nx > 0.3);
assert("distance 7-5 is 2", clockHourDistance(7, 5) === 2);

process.exit(fail ? 1 : 0);
