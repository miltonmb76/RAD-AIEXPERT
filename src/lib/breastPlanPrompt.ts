export function buildBreastPlanPrompt(args: {
  reportText: string;
  breastType?: string;
  laterality?: string;
  customDirectives?: string;
  clockRules: string;
}): string {
  const { reportText, breastType, laterality, customDirectives, clockRules } = args;
  return `Eres especialista en imagen mamaria y director de ilustración médica mamaria 3D.
Tu tarea es estructurar la SUITE MAMA 3D Y CORRELACIÓN BI-RADS a partir del informe.

TIPO DE ESTUDIO: ${breastType || "Detectar del informe"}
LATERALIDAD DEL ESTUDIO: ${laterality || "Detectar del informe; no inventar"}
DIRECTIVAS CLÍNICAS: ${customDirectives || "Ninguna"}
INFORME:
"""
${reportText}
"""

- El lado del estudio no sustituye el lado de cada lesión en estudios bilaterales.
- Copia por separado el lado y el eje/hora documentados de cada lesión. Nunca reutilices una hora global para lesiones distintas.
- La derecha/izquierda anatómica del paciente y la derecha/izquierda del observador son referencias distintas.
- No inventes medidas, distancias al pezón, lesiones ni categorías BI-RADS.
- Categorías admitidas: mama_b_mode (modo B), mama_doppler (Doppler mamario), mama_nodos (ganglios axilares) o general_breast (estudio mamario general).
- Describe parénquima mamario, pezón, lesión y axila según el informe; no añadas anatomía de otros órganos.
- El ejemplo de estructura no contiene datos de este paciente. Rellena solo con información del informe y deja vacíos los campos no documentados.

REGLAS ESPECÍFICAS MAMA / BI-RADS:
- 2–3 paneles: (A) ambas mamas vista frontal con pezones y cuadrantes/reloj; (B) corte macro del nódulo dominante; (C opcional) axila ipsilateral.
- Contrato de reloj OBLIGATORIO: manos idénticas en ambas mamas; las 3 = derecha del pezón en la imagen (derecha del observador); las 9 = izquierda del pezón. Nunca invertir por estética.
- ${clockRules}
- clockPositionOrSite y location DEBEN copiar el eje/hora EXACTO del informe/directiva (si dice eje 10 derecho, NUNCA escribir 2h ni espejar).
- laterality por panel = lado anatómico del paciente (Derecha|Izquierda|Bilateral).
- lesionTable filas con: location (reloj + distancia al pezón), composition (quística/sólida/mixta), size (mm/cm), shape, margins, echogenicity, orientation, vascularity, biradsCategory, clinicalImpact.
- NUNCA intercambiar composition y size. size solo medidas (ej. "8 × 5 mm"); composition solo morfología (ej. "Composición documentada").
- Cada panel DEBE tener panelTitle y anatomicalFocus en español, coherentes con su panelLetter. anatomicalFocus no debe quedar vacío: describe solo lo documentado o indica que faltan datos.
- FICHA CLÍNICA MAMARIA — OBLIGATORIA: incluir SIEMPRE breastSummary, morphologyNotes, axillaryStatus y keyPoints[]. Resume los hallazgos documentados sin añadir diagnósticos. Si no hay datos de morfología o axilas, indícalo explícitamente; nunca deduzcas normalidad de la ausencia de datos.
- No inventar lesiones ni categorías BI-RADS ausentes del informe/directiva.
- Prompts de imagen en inglés, fotorrealismo anatómico femenino clínico, sin texto en la imagen.

RESPONDE ESTRICTAMENTE EN FORMATO JSON VÁLIDO CON ESTA ESTRUCTURA:
{
  "studyTypeCategory": "mama_b_mode" | "mama_doppler" | "mama_nodos" | "general_breast",
  "territoryLabel": "ECOGRAFÍA DE MAMAS" | "ECOGRAFÍA MAMA + DOPPLER" | "ECOGRAFÍA MAMA + GANGLIOS",
  "laterality": "Bilateral" | "Derecha" | "Izquierda" | "Línea media",
  "figureTitle": "FIGURA 1. ATLAS 3D MAMARIO Y CORRELACIÓN BI-RADS",
  "tableTitle": "TABLA ECOGRÁFICA Y CARACTERIZACIÓN DE LESIONES MAMARIAS:",
  "tableHeaders": {
    "col1": "LOCALIZACIÓN",
    "col2": "COMPOSICIÓN",
    "col3": "TAMAÑO",
    "col4": "ECOGENICIDAD",
    "col5": "MÁRGENES",
    "col6": "ORIENTACIÓN",
    "col7": "VASCULARIDAD",
    "col8": "BI-RADS",
    "col9": "IMPACTO"
  },
  "panels": [
    {
      "panelLetter": "A",
      "panelTitle": "Panel A: Ambas mamas — vista frontal con pezones y reloj",
      "clockPositionOrSite": "Ambas mamas",
      "anatomicalFocus": "Parénquima mamario bilateral con pezones y cuadrantes...",
      "laterality": "Bilateral",
      "panelRole": "both_breasts",
      "imagePrompt": "Ultra-realistic 3D medical breast gland render..."
    },
    {
      "panelLetter": "B",
      "panelTitle": "Panel B: Corte del nódulo dominante",
      "clockPositionOrSite": "Lado y hora documentados",
      "anatomicalFocus": "Lesión dominante con márgenes y composición...",
      "laterality": "",
      "panelRole": "lesion",
      "imagePrompt": "Ultra-realistic 3D medical breast gland render..."
    }
  ],
  "lesionTable": [
    {
      "location": "Lado, hora y distancia documentados",
      "composition": "Composición documentada",
      "size": "Medidas documentadas",
      "shape": "Oval",
      "margins": "Circunscritos, regulares",
      "echogenicity": "Anecoica con refuerzo posterior",
      "orientation": "Paralela",
      "vascularity": "Ausente",
      "biradsCategory": "Categoría documentada, o cadena vacía",
      "clinicalImpact": "Impacto documentado"
    }
  ],
  "breastSummary": "Resumen de los hallazgos mamarios documentados",
  "morphologyNotes": "Morfología documentada o indicación explícita de datos no disponibles",
  "axillaryStatus": "Estado axilar documentado o indicación explícita de datos no disponibles",
  "keyPoints": ["Punto clave sustentado en el informe"],
  "synthesisTitle": "SÍNTESIS MORFOLÓGICA Y CATEGORIZACIÓN BI-RADS:",
  "morphologicalSynthesis": "El estudio ecográfico mamario bilateral evidencia..."
}`;
}
