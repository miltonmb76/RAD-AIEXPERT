export interface Presets {
  id: string;
  name: string;
  studyType: string;
  defaultHistory: string;
  customPrompt: string;
}

export interface ClassificationSystem {
  id: string;
  name: string;
  area: string;
  description: string;
  steps: {
    question: string;
    options: { label: string; value: string; next?: string; result?: string; category?: string }[];
  }[];
}

export const STUDY_PRESETS: Presets[] = [
  {
    id: "torax-rx",
    name: "Radiografía de Tórax AP/Lat",
    studyType: "Radiografía de Tórax (Proyecciones AP y Lateral)",
    defaultHistory: "Paciente con tos productiva de 5 días de evolución y fiebre de 38.3°C. Descartar proceso consolidativo.",
    customPrompt: "Evalúa con especial atención los campos pulmonares buscando consolidaciones, broncogramas aéreos o derrames pleurales. Describe el índice cardiotorácico y los ángulos costofrénicos."
  },
  {
    id: "cerebro-tc",
    name: "TC de Cerebro Simple",
    studyType: "Tomografía Computada de Cerebro Simple",
    defaultHistory: "Paciente con cefalea holocraneana de inicio súbito tipo 'trueno'. Descartar hemorragia subaracnoidea o evento isquémico hiperagudo.",
    customPrompt: "Examina con cuidado los espacios subaracnoideos, cisternas de la base, el sistema ventricular y la diferenciación sustancia gris-sustancia blanca. Menciona la línea media y si hay desviaciones."
  },
  {
    id: "rodilla-rm",
    name: "RM de Rodilla Simple",
    studyType: "Resonancia Magnética de Rodilla",
    defaultHistory: "Paciente deportista con trauma por hiperextensión y rotación de rodilla izquierda durante práctica de fútbol. Refiere chasquido audible y dolor interno intenso.",
    customPrompt: "Analiza el ligamento cruzado anterior (LCA), ligamento cruzado posterior (LCP), meniscos medial y lateral, cartílago articular y presencia de líquido libre o edema óseo trabecular."
  },
  {
    id: "abdomen-eco",
    name: "Ecografía Abdominal Completa",
    studyType: "Ecografía de Abdomen Completo (Vías Biliares, Hígado, Páncreas, Bazo y Riñones)",
    defaultHistory: "Paciente femenina de 38 años con dolor tipo cólico en hipocondrio derecho irradiado a región escapular posterior tras ingesta de grasas.",
    customPrompt: "Detalla el tamaño y ecogenicidad del parénquima hepático, el grosor de la pared de la vesícula biliar, presencia de litiasis biliar, diámetro del colédoco y características de ambos riñones."
  },
  {
    id: "abdomen-tc",
    name: "TC de Abdomen y Pelvis C/C",
    studyType: "Tomografía Computada de Abdomen y Pelvis con Contraste Endovenoso",
    defaultHistory: "Dolor abdominal agudo focalizado en fosa ilíaca derecha de 24 horas, asociado a náuseas y McBurney positivo.",
    customPrompt: "Evalúa meticulosamente la región apendicular buscando aumento del diámetro apendicular (>6mm), realce de la pared, alteración de la grasa adyacente o colecciones / apendicolito."
  }
];

export const PROMPT_SHORTCUTS = [
  { label: "Informe Completamente Normal", text: "Redacta un informe radiológico de características normales, ideal para el descarte patológico oficial, donde se detallen las estructuras habituales conservadas." },
  { label: "Buscar Patología de Urgencia", text: "Haz un análisis enfocado en descartar patologías críticas emergentes que pongan en peligro la vida (ej. sangrado agudo, perforaciones, colecciones libres o isquemia severa)." },
  { label: "Describir Hallazgos con Medidas", text: "Asegúrate de estimar las dimensiones de cualquier masa, nódulo o colección encontrada en milímetros o centímetros, así como su densidad relativa o aspecto." },
  { label: "Enfocado en Neumopatía/COVID", text: "Busca patrones específicos de infiltrados bilobulares, opacidades en vidrio deslustrado, consolidación subpleural o engrosamiento septal." }
];

export const GENERAL_SYSTEM_INSTRUCTION = 
  `Eres un médico radiólogo subespecialista experto con más de 20 años de experiencia clínica. Tu nivel de detalle es impecable, sigues estrictos estándares médicos (como BI-RADS, Bosniak, Fleischner, etc.) y formulas reportes de máxima precisión. ATENCIÓN CRÍTICA: Debes reconocer de forma consistente, inequívoca y exacta cualquier alteración o cambio de estructura obvio o conspicuo en el estudio (como la marcada disminución del espacio articular femorotibial, osteofitos marginales groseros, esclerosis subcondral, deformidades, luxaciones o líneas de fractura claras). Nunca minimices, omitas o califiques como 'dudosas' estas alteraciones anatómicas evidentes; regístralas directamente con la severidad que corresponde y ordénalas prioritariamente en tu reporte, el cual debe estar listo para Word (secciones y párrafos separados por doble espacio, títulos en negrita en lugar de encabezados Markdown, e impresión diagnóstica completamente en negrita y línea por línea).`;

export const CHAT_SYSTEM_INSTRUCTION =
  `Eres un consultor radiológico de élite de nivel académico. Ayudas a otros radiólogos y médicos a resolver casos difíciles, proponer diagnósticos diferenciales detallados basados en signos radiográficos, sugerir estudios de imagen complementarios idóneos para resolver el dilema diagnóstico y explicar la fisiopatología detrás de los hallazgos de imagen. Responde siempre con rigor científico y de forma estructurada.`;

export const CLASSIFICATION_SYSTEM_INSTRUCTION =
  `Eres una enciclopedia viva de clasificaciones, escalas y criterios radiológicos (ej. BI-RADS, Bosniak, LI-RADS, PI-RADS, Fleischner, Stanford/DeBakey, Duke, Balthazar, Child-Pugh, etc.). Tu tarea es proveer información estructurada, precisa y actualizada sobre la escala consultada, detallando los estadios/grados, criterios de imagen clave para cada uno y las recomendaciones correspondientes de seguimiento clínico o quirúrgico. Presenta todo con tablas detalladas y listas claras de lectura rápida.`;

// Pre-programmed interactive classification flow wizards
export const CLASSIFICATIONS_DATA: ClassificationSystem[] = [
  {
    id: "bosniak",
    name: "Clasificación de Bosniak (Quistes Renales)",
    area: "Uroradiología",
    description: "Evaluación ecográfica y tomográfica de quistes renales para determinar si requieren cirugía o monitoreo.",
    steps: [
      {
        question: "¿Cómo es el quiste en la tomografía?",
        options: [
          { label: "Quiste simple: pared delgada, sin septos, sin calcificaciones, densidad de agua (<20 UH), sin realce con contraste", value: "simple", category: "Bosniak I" },
          { label: "Quiste con mínima complicación: escasos septos delgados (<1 mm), calcificaciones finas u homogéneo de alta densidad (>70 UH) <3cm", value: "minimally_complicated", category: "Bosniak II" },
          { label: "Quiste con características dudosas: múltiples septos o calcificaciones gruesas, o quiste hiperdenso >3cm sin realce", value: "f_complicated", category: "Bosniak IIF" },
          { label: "Cualquiera con septos engrosados con realce medible o nódulos blandos", value: "complex" }
        ]
      }
    ]
  },
  {
    id: "birads",
    name: "BI-RADS (Imagen Mamaria)",
    area: "Senología / Mama",
    description: "Estandarización internacional para reportar mamografía, ultrasonido y resonancia de mama.",
    steps: [
      {
        question: "¿Cuál es el hallazgo principal en el estudio?",
        options: [
          { label: "Estudio incompleto, se requieren proyecciones adicionales o ultrasonido", value: "inconclusive", category: "BI-RADS 0" },
          { label: "Mama completamente normal, simétrica y sin hallazgos", value: "normal", category: "BI-RADS 1" },
          { label: "Hallazgo puramente benigno confirmado (ej. quiste simple, fibroadenoma calcificado antiguo)", value: "benign", category: "BI-RADS 2" },
          { label: "Probablemente benigno (seguimiento a corto plazo, riesgo de malignidad < 2%)", value: "probably_benign", category: "BI-RADS 3" },
          { label: "Sospecha de malignidad (ej. masa espiculada, microcalcificaciones agrupadas, distorsión, realce)", value: "suspicious" },
          { label: "Cáncer previamente confirmado por biopsia histológica", value: "confirmed", category: "BI-RADS 6" }
        ]
      },
      {
        question: "¿Qué grado de sospecha tiene el hallazgo?",
        options: [
          { label: "Sospecha baja (Riesgo >2% a ≤10%)", value: "4a", category: "BI-RADS 4A" },
          { label: "Sospecha moderada (Riesgo >10% a ≤50%)", value: "4b", category: "BI-RADS 4B" },
          { label: "Sospecha alta (Riesgo >50% a <95%)", value: "4c", category: "BI-RADS 4C" },
          { label: "Altamente sugestivo de malignidad (Riesgo de malignidad ≥95%)", value: "5", category: "BI-RADS 5" }
        ]
      }
    ]
  },
  {
    id: "fleischner",
    name: "Criterios de Fleischner (Nódulos Pulmonares Solitarios Incidentales)",
    area: "Tórax",
    description: "Sociedad Fleischner: Guías para el seguimiento incidental de nódulos pulmonares en adultos (>35 años) no oncológicos.",
    steps: [
      {
        question: "¿Cuál es el tipo y tamaño del nódulo?",
        options: [
          { label: "Nódulo sólido único < 6 mm", value: "solid_6_less" },
          { label: "Nódulo sólido único de 6 a 8 mm", value: "solid_6_8" },
          { label: "Nódulo sólido único > 8 mm", value: "solid_8_more" },
          { label: "Nódulo subsólido (vidrio deslustrado) < 6 mm", value: "sub_6_less", category: "No requiere seguimiento de rutina" },
          { label: "Nódulo subsólido (vidrio deslustrado) ≥ 6 mm", value: "sub_6_more", category: "Fleischner: Repetir TC a los 6-12 meses para confirmar persistencia o resolución" }
        ]
      },
      {
        question: "¿Qué nivel de riesgo clínico de cáncer tiene el paciente (ej. tabaquismo, exposición laboral)?",
        options: [
          { label: "Bajo riesgo clínico", value: "low_risk" },
          { label: "Alto riesgo clínico (fumador activo o antecedentes familiares relevantes)", value: "high_risk" }
        ]
      }
    ]
  }
];

export const INTERACTIVE_RESULTS: Record<string, string> = {
  "Bosniak I": "**Resultado: Bosniak I (Quiste Simple)**\n\n*   **Conducta:** 100% benigno. No requiere seguimiento ni estudios adicionales de imagen.\n*   **Sugerencia de reporte:** 'Lesión quística renal simple categorizada como Bosniak I, de comportamiento benigno.'",
  "Bosniak II": "**Resultado: Bosniak II (Quiste Mínimamente Complicado)**\n\n*   **Conducta:** Benigno. No requiere seguimiento rutinario en la mayoría de guías, aunque algunos sugieren un control ecográfico anual.\n*   **Sugerencia de reporte:** 'Quiste renal mínimamente complicado Bosniak II, benigno.'",
  "Bosniak IIF": "**Resultado: Bosniak IIF (Quiste Probablemente Benigno que Requiere Monitoreo - 'F' de Follow-up)**\n\n*   **Conducta:** Requiere seguimiento imagenológico periódico con TC o RM con contraste a los 6 meses, 12 meses y luego anualmente por al menos 5 años.\n*   **Sugerencia de reporte:** 'Lesión quística renal compleja Bosniak IIF. Se aconseja seguimiento con TC/RM con contraste según guías oficiales.'",
  "Bosniak III": "**Resultado: Bosniak III (Quiste Renal Complejo / SOSPECHOSO)**\n\n*   **Conducta:** Tumor quístico indeterminado. El 40-50% resultan ser malignos (carcinoma renal quístico). Se recomienda con frecuencia exploración quirúrgica (nefrectomía parcial o ablación) o manejo multidisciplinar.\n*   **Sugerencia de reporte:** 'Lesión quística compleja sospechosa clasificada como Bosniak III. Se sugiere valoración por Urología clínica.'",
  "Bosniak IV": "**Resultado: Bosniak IV (Lesión Renal Quística Claramente Maligna)**\n\n*   **Conducta:** El 85-90% son carcinomas de células renales. Tratamiento quirúrgico indicado salvo contraindicación formal.\n*   **Sugerencia de reporte:** 'Masa renal quística sólida clasificada como Bosniak IV, altamente sugestiva de proceso neoplásico primario renal.'",
  
  "BI-RADS 0": "**Resultado: BI-RADS 0 (Estudios incompletos o adicionales requeridos)**\n\n*   **Conducta:** Comparar con estudios anteriores es crítico; complementación diagnóstica con ecografía, proyecciones especiales de mamografía o resonancia.\n*   **Recomendación:** 'Estudio incompleto (BI-RADS 0). Se sugiere evaluación complementaria con ecografía mamaria de alta resolución e intercalación con mamografías previas.'",
  "BI-RADS 1": "**Resultado: BI-RADS 1 (Estudio Negativo - Normal)**\n\n*   **Conducta:** Continuar tamizaje habitual (mamografía de control anual para mayores de 40 años).\n*   **Recomendación:** 'Estudio de imagenología mamaria negativo para malignidad estructural. Categorizado como BI-RADS 1. Se aconseja control de tamizaje anual estándar.'",
  "BI-RADS 2": "**Resultado: BI-RADS 2 (Hallazgos Benignos)**\n\n*   **Conducta:** Tamizaje habitual anual para mamografía. Continuar con el control de rutina según edad del paciente.\n*   **Recomendación:** 'Hallazgos benignos estables catalogados como BI-RADS 2. Sin sospecha de malignidad. Continuar tamizaje rutinario.'",
  "BI-RADS 3": "**Resultado: BI-RADS 3 (Probablemente Benigno)**\n\n*   **Conducta:** Seguimiento a corto plazo (unilateral a los 6 meses, bilateral a los 12 meses, luego 24 meses). Riesgo de malignidad <2%.\n*   **Recomendación:** 'Lesión nodular probablemente benigna clasificada como BI-RADS 3. Se sugiere estricto seguimiento ecográfico focalizado en 6 meses.'",
  "BI-RADS 4A": "**Resultado: BI-RADS 4A (Sospecha baja)**\n\n*   **Conducta:** Se requiere correlación histopatológica mediante biopsia de aguja gruesa (trucut) o biopsia guiada por ultrasonido/estereotaxia.\n*   **Recomendación:** 'Alteración estructural de sospecha baja (BI-RADS 4A). Se recomienda biopsia guiada por imágenes para corroboración anatomopatológica.'",
  "BI-RADS 4B": "**Resultado: BI-RADS 4B (Sospecha moderada)**\n\n*   **Conducta:** Requiere de manera indiscutible biopsia tisular.\n*   **Recomendación:** 'Criterios de sospecha moderada BI-RADS 4B. Es indispensable realizar toma de biopsia para normar conducta.'",
  "BI-RADS 4C": "**Resultado: BI-RADS 4C (Sospecha alta)**\n\n*   **Conducta:** Requiere biopsia urgente. Alta probabilidad de neoplasia mamaria.\n*   **Recomendación:** 'Sospecha alta de malignidad clasificada como BI-RADS 4C. Se sugiere programar biopsia histológica de manera prioritaria.'",
  "BI-RADS 5": "**Resultado: BI-RADS 5 (Altamente sugestivo de malignidad)**\n\n*   **Conducta:** Requiere biopsia percutánea de inmediato. Si resulta benigno en biopsia inicial, se considera discordante y requiere escisión quirúrgica.\n*   **Recomendación:** 'Lesión altamente sugestiva de carcinoma mamario primario clasificada como BI-RADS 5. Se requiere biopsia inmediata con caracterización inmunohistoquímica.'",
  "BI-RADS 6": "**Resultado: BI-RADS 6 (Malignidad conocida y confirmada por biopsia)**\n\n*   **Conducta:** Evaluación de respuesta a terapia tumoral (quimioterapia neoadyuvante o planeación quirúrgica).",
  
  "solid_6_less_low": "**Resultado: Nódulo Sólido Solitario < 6 mm en Paciente con Bajo Riesgo**\n\n*   **Conducta (Fleischner):** No se requiere seguimiento de rutina clínica.\n*   **Sugerencia:** 'Micronódulo pulmonar incidental menor a 6 mm de aspecto inespecífico. En paciente sin historia de tabaquismo ni factores de riesgo adicionales, no requiere estudios de imagen subsiguientes de rutina.'",
  "solid_6_less_high": "**Resultado: Nódulo Sólido Solitario < 6 mm en Paciente con Alto Riesgo**\n\n*   **Conducta (Fleischner):** Opcional: TC de seguimiento a los 12 meses si hay factores clínicos muy sospechosos; de lo contrario, no requiere.\n*   **Sugerencia:** 'Micronódulo incidental < 6 mm. Debido a los factores de riesgo clínico, se puede considerar un control opcional en 12 meses.'",
  "solid_6_8_low": "**Resultado: Nódulo Sólido Solitario de 6 a 8 mm en Paciente con Bajo Riesgo**\n\n*   **Conducta (Fleischner):** TC de tórax en 6 a 12 meses; luego opcional a los 18 a 24 meses si permanece estable.\n*   **Sugerencia:** 'Nódulo sólido de 6-8 mm. Se sugiere control de seguimiento mediante TC de tórax en 6 a 12 meses según criterios oficiales de la Sociedad Fleischner.'",
  "solid_6_8_high": "**Resultado: Nódulo Sólido Solitario de 6 a 8 mm en Paciente con Alto Riesgo**\n\n*   **Conducta (Fleischner):** TC de tórax en 3 a 6 meses; luego control adicional a los 9 a 12 meses y luego a los 24 meses si permanece estable.\n*   **Sugerencia:** 'Nódulo sólido de 6-8 mm en paciente de alto riesgo. Recomendado un estricto seguimiento por TC de tórax a los 3-6 meses.'",
  "solid_8_more_low": "**Resultado: Nódulo Sólido Solitario > 8 mm (Bajo o Alto Riesgo)**\n\n*   **Conducta (Fleischner):** Considerar TC en 3 meses, realizar PET/CT o efectuar de inmediato biopsia tisular / resección quirúrgica.\n*   **Sugerencia:** 'Nódulo pulmonar sólido mayor a 8 mm. Se aconseja correlación clínica estrecha, evaluación por neumología y considerar PET/CT o biopsia dirigida según sospecha morfológica.'",
  "solid_8_more_high": "**Resultado: Nódulo Sólido Solitario > 8 mm en Paciente de Alto Riesgo**\n\n*   **Conducta (Fleischner):** Muy alta sospecha. TC en 3 meses, PET/CT o biopsia tisular directa inmediata.\n*   **Sugerencia:** 'Nódulo pulmonar sólido significativo > 8 mm de alta sospecha. Se recomienda valoración urgente por Neumología/Cirugía de Tórax para considerar diagnóstico histológico prioritario.'"
};
