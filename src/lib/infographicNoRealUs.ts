/**
 * Classic infographics are freeform Gemini posters. Models often invent
 * photoreal B-mode / Doppler / elastography insets that do not match the case.
 * Ban those frames; keep anatomy CGI + text callouts + simple data charts.
 */

export const INFOGRAPHIC_NO_REAL_US_PROMPT_BLOCK = `
SIN IMÁGENES DE ULTRASONIDO REALES (OBLIGATORIO — si se incumple la imagen no sirve):
- PROHIBIDO incluir capturas, recortes o recuadros que imiten ecografía real: B-mode en escala de grises, Color Doppler, Power Doppler, Doppler espectral/trazo, elastografía shear-wave con mapa de color sobre eco, QUS, o cualquier fotograma tipo consola.
- PROHIBIDO etiquetas tipo "Imagen 1", "Imagen 2", "Fig. US", "corte eco", "frame", "captura" que sugieran fotos del estudio.
- PROHIBIDO chrome de equipo: escala de profundidad, TGC, gain, logo de fabricante, tipografía de pantalla de ultrasonido, cursor de medición de máquina.
- SÍ permitido: ilustración anatómica / CGI médico, diagramas, callouts con texto, iconos esquemáticos y gráficos de datos simples (barras/números de kPa, %, mm) SIN fondo de ecografía.
- Si el informe es de ultrasonido, EXPLICA los hallazgos con anatomía dibujada + texto; no inventes fotogramas que "parezcan" del caso — suelen no coincidir.
`.trim();
