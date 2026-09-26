/** Quick sanity for breast clock hour priority (10 vs 2 mirror). */
function extractBreastClockHourFromText(text) {
  const t = String(text || "");
  const patterns = [
    /\b(?:eje|hora|hours?|o['’]?clock|h)\s*[:\-]?\s*(1[0-2]|[1-9])\b/i,
    /\b(?:a\s+las|en\s+las|las)\s+(1[0-2]|[1-9])\b/i,
    /\b(1[0-2]|[1-9])\s*(?:h|hrs?|horas?|o['’]?clock|:00)\b/i,
    /\bradio\s*(1[0-2]|[1-9])\b/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 12) return n;
    }
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
const mirror = (hour) => (hour === 12 || hour === 6 ? null : 12 - (hour % 12) || 12);

let fail = 0;
function assert(name, cond) {
  if (!cond) {
    console.error("FAIL", name);
    fail++;
  } else console.log("OK", name);
}

assert("eje 10", extractBreastClockHourFromText("eje 10 derecho") === 10);
assert("10h", extractBreastClockHourFromText("Mama derecha, 10h") === 10);
assert(
  "directive beats stale 2",
  extractBreastClockHour("Mama derecha eje 10 CSE", "Mama derecha, 2h") === 10
);
assert("mirror 10→2", mirror(10) === 2);
assert("mirror 2→10", mirror(2) === 10);

process.exit(fail ? 1 : 0);
