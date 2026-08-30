import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

// Lazy-loaded GenAI client to prevent crash on startup if API key is missing
let aiClient: GoogleGenAI | null = null;
let lastUsedKey: string | undefined = undefined;

function cleanGeminiKey(key: string): string {
  if (!key) return "";
  let clean = key.trim();
  clean = clean.replace(/[\u200B-\u200D\uFEFF]/g, "");
  clean = clean.replace(/\\"/g, '"').replace(/\\'/g, "'");

  if (clean.includes("=")) {
    const parts = clean.split("=");
    const prefix = parts[0].toLowerCase();
    if (prefix.includes("gemini") || prefix.includes("key") || prefix.includes("export") || prefix.includes("env")) {
      clean = parts.slice(1).join("=").trim();
    }
  }

  if (clean.toLowerCase().startsWith("key:") || clean.toLowerCase().startsWith("apikey:") || clean.toLowerCase().startsWith("api_key:")) {
    clean = clean.substring(clean.indexOf(":") + 1).trim();
  }
  
  const quoteChars = ['"', "'", '“', '”', '‘', '’', '„', '`', '\\'];
  let changed = true;
  while (changed) {
    changed = false;
    for (const char of quoteChars) {
      if (clean.startsWith(char)) {
        clean = clean.slice(1);
        changed = true;
      }
      if (clean.endsWith(char)) {
        clean = clean.slice(0, -1);
        changed = true;
      }
    }
    const beforeTrim = clean;
    clean = clean.trim();
    if (clean !== beforeTrim) {
      changed = true;
    }
  }
  return clean;
}

function getGeminiClient(): GoogleGenAI {
  try {
    dotenv.config({ override: true });
  } catch (e) {
    console.warn("No se pudo recargar el archivo .env:", e);
  }

  const rawKey = process.env.GEMINI_API_KEY || "";
  const apiKey = cleanGeminiKey(rawKey);
  
  if (!apiKey) {
    throw new Error("La variable de entorno GEMINI_API_KEY no está configurada, está vacía o solo contiene comillas. Por favor, añádela en la sección de Secretos de AI Studio.");
  }

  process.env.GEMINI_API_KEY = apiKey;
  
  if (!aiClient || lastUsedKey !== apiKey) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    lastUsedKey = apiKey;
  }
  return aiClient;
}

function getModelName(requestedModel?: string): string {
  if (requestedModel === "gemini-3.1-pro-preview" || requestedModel === "gemini-3.1-pro") {
    return "gemini-3.1-pro-preview";
  }
  return "gemini-3.7-flash";
}

function handleGeminiError(error: any): string {
  const errorMsg = error?.message || "";
  const fullErrorStr = `${errorMsg} ${String(error)}`.toLowerCase();
  
  if (
    fullErrorStr.includes("expired") ||
    fullErrorStr.includes("api_key_invalid") ||
    fullErrorStr.includes("api key not found") ||
    fullErrorStr.includes("key not found") ||
    fullErrorStr.includes("403") ||
    fullErrorStr.includes("unauthenticated")
  ) {
    return "Error de autenticación con la API de Gemini. Por favor verifica tu GEMINI_API_KEY en la configuración.";
  }
  return `Error en la generación con IA: ${errorMsg || "Comprueba la conexión y vuelve a intentar."}`;
}

export function registerAtlas3DRoutes(app: express.Express) {
  // Helper to generate a medical image using gemini-3.1-flash-image-preview or imagen-3.0
  async function generateMedicalImage(ai: any, prompt: string): Promise<string> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image-preview",
        contents: prompt,
        config: {
          imageConfig: { aspectRatio: "4:3", imageSize: "1K" }
        }
      });

      let base64Image = "";
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            base64Image = part.inlineData.data;
            break;
          }
        }
      }

      if (!base64Image) {
        throw new Error("No inlineData image returned from gemini-3.1-flash-image-preview");
      }
      return `data:image/jpeg;base64,${base64Image}`;
    } catch (err: any) {
      console.warn("Error con gemini-3.1-flash-image-preview en generateMedicalImage, reintentando con fallback:", err?.message || err);
      // Fallback
      const response = await ai.models.generateImages({
        model: "imagen-3.0-generate-002",
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: "image/jpeg",
          aspectRatio: "4:3"
        }
      });
      const b64 = response.generatedImages?.[0]?.image?.imageBytes;
      if (!b64) throw new Error("Fallback imagen-3.0 no devolvió imagen.");
      return `data:image/jpeg;base64,${b64}`;
    }
  }

  // 1. Full 3D Atlas Generation (2 to 3 panels + Synoptic Correlation + Biomechanical Synthesis)
  app.post("/api/generate-3d-atlas", async (req: express.Request, res: express.Response) => {
    try {
      const { reportText, organOrStudy, laterality, requestedModel, customDirectives } = req.body;

      if (!reportText || !reportText.trim()) {
        return res.status(400).json({ success: false, error: "Se requiere el texto del informe radiológico." });
      }

      const ai = getGeminiClient();
      const model = getModelName(requestedModel || "gemini-3.7-flash");

      const promptPlan = `Eres un Médico Radiólogo Especialista en Diagnóstico por Imágenes, Catedrático de Anatomía Humana Quirúrgica y Director de Arte Médico 3D.
Tu labor es analizar minuciosamente el siguiente informe radiológico/ecográfico para concebir y diseñar un ATLAS ANATÓMICO TRIDIMENSIONAL FOTORREALISTA de calidad médica superior (Journal/Atlas Quality).

========================================================================
INFORMACIÓN DEL ESTUDIO CLÍNICO:
========================================================================
- Región / Protocolo: "${organOrStudy || "Estudio General"}"
- Lateralidad Solicitada/Forzada: "${laterality || "Detectar del texto"}"
- Directiva / Matiz Personalizado: "${customDirectives || "Ninguno"}"
- INFORME RADIOLÓGICO:
"""
${reportText}
"""

========================================================================
TAREA Y ESPECIFICACIÓN:
========================================================================
1. Identifica la región anatómica evaluada (ej: "Hombro Derecho", "Mama Izquierda", "Rodilla Izquierda", "Abdomen Superior / Hígado y Vía Biliar", "Testículo Izquierdo", etc.).
2. Determina con exactitud la lateralidad del paciente (Derecha / Izquierda / Bilateral) y las relaciones de corte anatómico (Anterior AP, Posterior PA, Sagital o Coronal).
3. Diseña de 2 a 3 PANELES VISUALES complementarios (Panel A, Panel B y opcionalmente Panel C) que ilustren tridimensionalmente la anatomía normal relevante y la alteración patológica descrita:
   - Panel A: Visión focal o coronal/sagital de la estructura principal con su alteración tisular o hallazgo más relevante.
   - Panel B: Visión complementaria (corte transversal, profundidad articular, relación topográfica vecina o visión ampliada).
   - Panel C (opcional, si el caso lo amerita): Visión biomecánica adicional o comparativa.
4. Redacta para cada panel un PROMPT EN INGLÉS ultradetallado para generar una imagen médica 3D fotorrealista:
   - Formato de estilo: "Clean 3D medical volumetric cross-section render, cinema 4D octane render style, organic translucent parenchyma cutaway, glowing chromatic bioluminescent accents highlighting the specific pathology/finding, ultra-high fidelity medical visualization, soft studio rim lighting, pure clean background, strictly NO written words, NO text, NO numbers, NO arrows, NO letters inside the image."
   - Incluye referencias anatómicas espaciales concretas acordes a la lateralidad del paciente.
5. Construye la TABLA DE CORRELACIÓN SEMIOLÓGICA ("synopticExplanation") con 2 a 4 filas asociadas a cada panel.
6. Redacta la SÍNTESIS BIOMECÁNICA, FUNCIONAL Y DIAGNÓSTICA ("biomechanicalSynthesis") integrando los hallazgos.

RESPONDE ESTRICTAMENTE EN FORMATO JSON VÁLIDO CON LA SIGUIENTE ESTRUCTURA:
{
  "studyRegion": "Nombre de la región (ej. Rodilla Izquierda, Abdomen Completo, Hombro Derecho)",
  "figureTitle": "FIGURA 1. RECONSTRUCCIÓN ANATÓMICA 3D Y CORRELACIÓN ULTRASONOGRÁFICA DE [REGIÓN]",
  "detectedLaterality": "Izquierda" | "Derecha" | "Bilateral" | "Línea media",
  "panels": [
    {
      "panelLetter": "A",
      "panelTitle": "Título corto y preciso del Panel A (ej. Corte Coronal - Compartimento Femorotibial Medial)",
      "anatomicalFocus": "Foco: Breve descripción de 1 línea del hallazgo anatómico (ej. Desgarro del cuerno posterior del menisco medial)",
      "laterality": "Izquierda" | "Derecha",
      "imagePrompt": "Detailed English prompt for generating panel A 3D render..."
    },
    {
      "panelLetter": "B",
      "panelTitle": "Título corto y preciso del Panel B (ej. Visión Volumétrica Sagital y Relación Articular)",
      "anatomicalFocus": "Foco: Breve descripción de 1 línea del hallazgo en Panel B",
      "laterality": "Izquierda" | "Derecha",
      "imagePrompt": "Detailed English prompt for generating panel B 3D render..."
    }
  ],
  "synopticExplanation": [
    {
      "structure": "Estructura o complejo evaluado (ej. Menisco Medial (Cuerno Posterior))",
      "panelRef": "(Panel A)",
      "findingDetail": "Descripción detallada del hallazgo patológico y correlación tridimensional..."
    },
    {
      "structure": "Estructura complementaria (ej. Cartílago Hialino y Espacio Articular)",
      "panelRef": "(Panel B)",
      "findingDetail": "Descripción de la correlación con la imagen..."
    }
  ],
  "biomechanicalSynthesis": "Texto de 2 a 3 líneas integrando la repercusión funcional, biomecánica o diagnóstica del cuadro..."
}`;

      const planResponse = await ai.models.generateContent({
        model: model,
        contents: [{ text: promptPlan }],
        config: {
          responseMimeType: "application/json"
        }
      });

      let planJson: any = {};
      try {
        planJson = JSON.parse(planResponse.text || "{}");
      } catch (parseErr) {
        console.error("Error parseando plan JSON de Atlas 3D:", parseErr);
        planJson = {
          studyRegion: organOrStudy || "Región Anatómica Evaluada",
          figureTitle: `FIGURA 1. RECONSTRUCCIÓN ANATÓMICA 3D Y CORRELACIÓN DE ${organOrStudy?.toUpperCase() || "HALLAZGOS"}`,
          detectedLaterality: laterality || "No especificada",
          panels: [
            {
              panelLetter: "A",
              panelTitle: "Reconstrucción Volumétrica Principal",
              anatomicalFocus: "Foco: Hallazgo anatómico correlacionado",
              laterality: laterality || "No especificada",
              imagePrompt: `Clean 3D medical volumetric cross-section render of ${organOrStudy || "human anatomy finding"}, octane render style, glowing chromatic highlights, ultra-high resolution medical illustration, no text.`
            },
            {
              panelLetter: "B",
              panelTitle: "Perspectiva Regional y Relación Tisular",
              anatomicalFocus: "Foco: Relación topográfica y estructuras adyacentes",
              laterality: laterality || "No especificada",
              imagePrompt: `Wide 3D medical volumetric render showing neighboring organs and tissues of ${organOrStudy || "human anatomy finding"}, cinematic studio lighting, translucent glass cutaway, high detail, no text.`
            }
          ],
          synopticExplanation: [
            {
              structure: "Estructura Principal",
              panelRef: "(Panel A)",
              findingDetail: "Reconstrucción anatómica tridimensional con visualización de los hallazgos semiológicos descritos en el informe."
            },
            {
              structure: "Estructuras Vecinas",
              panelRef: "(Panel B)",
              findingDetail: "Relación tisular y topográfica regional con preservación de la arquitectura adyacente."
            }
          ],
          biomechanicalSynthesis: "La correlación de los planos volumétricos confirma la localización anatómica y la repercusión de los hallazgos descriptos en el estudio."
        };
      }

      // Generate images in parallel for each panel
      const panelsWithImages = await Promise.all(
        (planJson.panels || []).map(async (panel: any, idx: number) => {
          let promptToUse = panel.imagePrompt || `3D medical volumetric render of ${panel.panelTitle || organOrStudy}, organic cutaway, studio lighting, no text.`;
          if (customDirectives && customDirectives.trim()) {
            promptToUse = `${promptToUse} [MANDATORY CLINICAL DIRECTIVE: ${customDirectives.trim()}].`;
          }
          if (laterality && laterality !== "auto") {
            promptToUse = `[MANDATORY PATIENT LATERALITY: ${laterality.toUpperCase()}]. ${promptToUse}`;
          }

          try {
            const imageUrl = await generateMedicalImage(ai, promptToUse);
            return {
              id: `panel-${idx}-${Date.now()}`,
              panelLetter: panel.panelLetter || String.fromCharCode(65 + idx),
              panelTitle: panel.panelTitle || `Panel ${String.fromCharCode(65 + idx)}`,
              anatomicalFocus: panel.anatomicalFocus || "Foco anatómico correlacionado",
              laterality: panel.laterality || planJson.detectedLaterality || laterality || "",
              imageUrl: imageUrl,
              promptUsed: promptToUse,
              isCustomFlipped: false
            };
          } catch (imgErr) {
            console.error(`Error generando imagen para panel ${panel.panelLetter}:`, imgErr);
            return {
              id: `panel-${idx}-${Date.now()}`,
              panelLetter: panel.panelLetter || String.fromCharCode(65 + idx),
              panelTitle: panel.panelTitle || `Panel ${String.fromCharCode(65 + idx)}`,
              anatomicalFocus: panel.anatomicalFocus || "Foco anatómico correlacionado",
              laterality: panel.laterality || planJson.detectedLaterality || laterality || "",
              imageUrl: "",
              promptUsed: promptToUse,
              isCustomFlipped: false
            };
          }
        })
      );

      const finalAtlasData = {
        studyRegion: planJson.studyRegion || organOrStudy || "Estudio Actual",
        figureTitle: planJson.figureTitle || `FIGURA 1. RECONSTRUCCIÓN ANATÓMICA 3D Y CORRELACIÓN DE ${organOrStudy?.toUpperCase() || "HALLAZGOS"}`,
        detectedLaterality: planJson.detectedLaterality || laterality || "",
        panels: panelsWithImages,
        synopticExplanation: planJson.synopticExplanation || [],
        synopticTable: planJson.synopticExplanation || [],
        biomechanicalSynthesis: planJson.biomechanicalSynthesis || "",
        synthesis: planJson.biomechanicalSynthesis || ""
      };

      res.json({
        success: true,
        data: finalAtlasData
      });

    } catch (error: any) {
      console.error("Error en /api/generate-3d-atlas:", error);
      res.status(500).json({ success: false, error: handleGeminiError(error) });
    }
  });

  // 2. Single Panel Regeneration with prompt tweak and laterality control
  app.post("/api/regenerate-3d-panel", async (req: express.Request, res: express.Response) => {
    try {
      const { reportText, studyRegion, panel, laterality, userDirective, requestedModel } = req.body;

      if (!panel) {
        return res.status(400).json({ success: false, error: "Se requiere el objeto de panel a regenerar." });
      }

      const ai = getGeminiClient();
      const model = getModelName(requestedModel || "gemini-3.7-flash");

      // Refine prompt for this specific panel
      const refinementPrompt = `Eres un Director de Arte Médico 3D y Radiólogo.
Diseña un prompt en inglés superdetallado para re-generar una única imagen 3D fotorrealista correspondiente al PANEL ${panel.panelLetter}.

DATOS DEL CASO:
- Región: "${studyRegion || "Anatomía médica"}"
- Título actual del Panel: "${panel.panelTitle || ""}"
- Foco actual: "${panel.anatomicalFocus || ""}"
- Lateralidad requerida: "${laterality || panel.laterality || ""}"
- Instrucción / Corrección del médico: "${userDirective || "Mejorar realismo y precisión anatómica"}"
- Contexto del informe: """${(reportText || "").slice(0, 800)}"""

REGLAS DE ESTILO:
- Clean 3D medical volumetric cross-section render, cinema 4D octane render style, organic translucent parenchyma cutaway, glowing chromatic highlights for pathology, soft studio rim lighting, pure clean background.
- STRICTLY NO text, NO numbers, NO letters, NO arrows inside the image.

RESPONDE EN JSON:
{
  "panelTitle": "Título actualizado o confirmado para el panel",
  "anatomicalFocus": "Foco: Breve descripción de 1 línea del hallazgo en este panel",
  "imagePrompt": "Detailed English image generation prompt..."
}`;

      const refineResponse = await ai.models.generateContent({
        model: model,
        contents: [{ text: refinementPrompt }],
        config: { responseMimeType: "application/json" }
      });

      let refineJson: any = {};
      try {
        refineJson = JSON.parse(refineResponse.text || "{}");
      } catch (e) {
        refineJson = {
          panelTitle: panel.panelTitle,
          anatomicalFocus: panel.anatomicalFocus,
          imagePrompt: `Medical 3D volumetric render of ${panel.panelTitle || studyRegion}, organic cross section, octane render, soft studio lighting, no text.`
        };
      }

      let finalPrompt = refineJson.imagePrompt || panel.promptUsed || `3D volumetric medical render of ${studyRegion}, no text.`;
      if (userDirective && userDirective.trim()) {
        finalPrompt = `${finalPrompt} [MANDATORY SURGICAL CORRECTION: ${userDirective.trim()}].`;
      }
      if (laterality && laterality !== "auto") {
        finalPrompt = `[MANDATORY PATIENT LATERALITY: ${laterality.toUpperCase()}]. ${finalPrompt}`;
      }

      const imageUrl = await generateMedicalImage(ai, finalPrompt);

      const updatedPanel = {
        ...panel,
        panelTitle: refineJson.panelTitle || panel.panelTitle,
        anatomicalFocus: refineJson.anatomicalFocus || panel.anatomicalFocus,
        laterality: laterality || panel.laterality,
        imageUrl: imageUrl,
        promptUsed: finalPrompt,
        isCustomFlipped: false
      };

      res.json({
        success: true,
        panel: updatedPanel
      });

    } catch (error: any) {
      console.error("Error en /api/regenerate-3d-panel:", error);
      res.status(500).json({ success: false, error: handleGeminiError(error) });
    }
  });
}
