/** Sanity: breast clock polar map + hour priority (7≠5, 10≠2). */

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
  "directive beats stale 2",
  extractBreastClockHour("Mama derecha eje 10 CSE", "Mama derecha, 2h") === 10
);
assert("mirror 10→2", mirrorBreastClockHour(10) === 2);
assert("mirror 7→5", mirrorBreastClockHour(7) === 5);
assert("mirror 5→7", mirrorBreastClockHour(5) === 7);

const g7 = getBreastClockGeometry(7);
const g5 = getBreastClockGeometry(5);
assert("7 is viewer-left (nx<0)", g7.nx < -0.3);
assert("5 is viewer-right (nx>0)", g5.nx > 0.3);
assert("7 and 5 both inferior (ny>0)", g7.ny > 0.3 && g5.ny > 0.3);
assert("distance 7-5 is 2", clockHourDistance(7, 5) === 2);
assert("12 up ny<0", getBreastClockGeometry(12).ny < -0.9);
assert("3 right nx>0.9", getBreastClockGeometry(3).nx > 0.9);
assert("9 left nx<-0.9", getBreastClockGeometry(9).nx < -0.9);

process.exit(fail ? 1 : 0);
