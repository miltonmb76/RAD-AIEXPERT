/** Paragraph severity heuristics extracted from App.tsx */
export function resolveParagraphSeverity(
  text: string,
  manualSeverityOverrides: Record<string, "critical" | "altered" | "normal"> = {},
  aiSeverityCache: Record<string, "critical" | "altered" | "normal"> = {},
): "critical" | "altered" | "normal" {
  if (!text) return "normal";
  const trimmed = text.trim();
  const trimmedLower = trimmed.toLowerCase();

  // Check manual overrides first
  if (manualSeverityOverrides[trimmed]) {
    return manualSeverityOverrides[trimmed];
  }
  if (manualSeverityOverrides[trimmedLower]) {
    return manualSeverityOverrides[trimmedLower];
  }
  if (manualSeverityOverrides[text]) {
    return manualSeverityOverrides[text];
  }

  // Check AI semantic cache second
  if (aiSeverityCache[trimmed]) {
    return aiSeverityCache[trimmed];
  }
  if (aiSeverityCache[trimmedLower]) {
    return aiSeverityCache[trimmedLower];
  }
  if (aiSeverityCache[text]) {
    return aiSeverityCache[text];
  }

  const blockClean = text.toLowerCase();
  const sentences = blockClean.split(/[.:;]/);
  let severity: "critical" | "altered" | "normal" = "normal";

  for (const sentence of sentences) {
    const s = sentence.trim();
    if (!s) continue;
    
    const cleanText = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    const criticalKeywords = [
      "ruptura", "desgarro completo", "trombosis", "oclusion", "maligno", "malignidad",
      "birads 4", "birads 5", "birads 6", "birads_4", "birads_5", "birads_6", "aneurisma",
      "colecistitis", "apendicitis", "isquemia", "infarto", "critico", "critica", "criticos", "criticas",
      "trombosis venosa profunda", "tvp", "oclusion total"
    ];

    const alteredKeywords = [
      "desgarro parcial", "desgarro", "alteracion", "alterado", "alterada", "disminuid", "disminucion",
      "aumentad", "aumento", "engrosad", "engrosamiento", "bursitis", "sinovitis", "derrame",
      "quiste", "quistica", "quisticos", "quisticas", "quistes", "calcificacion", "calcificaciones",
      "ectasia", "bocio", "nodulo", "nodulos", "fibrosis", "esteatosis", "hepatomegalia",
      "esplenomegalia", "colelitiasis", "lodo biliar", "adenopatia", "adenopatias",
      "heterogeneo", "heterogenea", "moderado", "moderada", "leve", "litiasis", "lesion", "lesiones",
      "insuficiencia", "insuficiente", "insuficiencias", "reflujo", "reflujos", "incompetente", "incompetentes",
      "incompetencia", "retrogado", "retrógrado", "retrogrado", "dilatado", "dilatada", "dilataciones", "dilatacion",
      "ectasico", "ectasica", "tortuoso", "tortuosa"
    ];

    const hasActiveKeyword = (keywords: string[]) => {
      for (const kw of keywords) {
        const kwClean = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const idx = cleanText.indexOf(kwClean);
        if (idx !== -1) {
          // Context before key covers the whole sentence up to the keyword
          const contextBefore = cleanText.substring(0, idx);
          
          const negationPatterns = [
            /\bsin\b/,
            /\bno\s+se\b/,
            /\bno\s+aprec\w*/,
            /\bno\s+evid\w*/,
            /\bno\s+observa\w*/,
            /\bno\s+detecta\w*/,
            /\bno\s+visualiza\w*/,
            /\bno\s+hay\b/,
            /\bausencia\b/,
            /\blibre\s+de\b/,
            /\bnegativ\w*/,
            /\bnormal\b/,
            /\bconservad\w*/,
            /\bdescarta\w*/,
            /\bpermeable\b/,
            /\bcolapsable\b/,
            /\bcompresible\b/,
            /\bno\s+muestra\b/,
            /\bno\s+revela\b/
          ];

          const isNegated = negationPatterns.some(pattern => pattern.test(contextBefore));
          if (!isNegated) {
            return true;
          }
        }
      }
      return false;
    };

    if (hasActiveKeyword(criticalKeywords)) {
      severity = "critical";
      break;
    } else if (hasActiveKeyword(alteredKeywords)) {
      severity = "altered";
    }
  }

  return severity;
};
