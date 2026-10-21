# Comparación opcional de infografías

La generación habitual continúa utilizando Gemini. Debajo de los controles de infografías generales aparece **Comparar infografías con OpenAI**. No se ejecuta automáticamente al generar un estudio.

## Uso

1. Generar el informe y, para tener una referencia, sus infografías habituales.
2. Solicitar una prueba de OpenAI para paciente, médico o ambos. La opción «ambas» procesa una imagen por vez.
3. Comparar la imagen original y la candidata en la pestaña del público correspondiente. Revisar texto, hallazgos, medidas, ubicación y lateralidad.
4. Elegir **Usar en PDF paciente** para incluir esa imagen en la explicación al paciente, o **Usar en PDF formal** para incluirla en el informe médico. Generar una candidata por sí solo no cambia el PDF.
5. Para volver a la original, elegirla en el mismo panel. La otra audiencia conserva su selección independiente.

La versión paciente solicita lenguaje sencillo y ninguna recomendación; la versión médico utiliza lenguaje técnico. Las pruebas generales de ambos proveedores mantienen `includeRecommendations: "none"`. Los controles de infografías dirigidas conservan su comportamiento anterior.

Las candidatas de comparación y las copias originales del panel viven en memoria y se descartan al cambiar de estudio, cambiar el contenido/contexto del informe o cerrar la sesión. Una imagen elegida para el PDF se guarda por los mecanismos existentes de la aplicación. El cambio de estudio cancela la espera e invalida respuestas tardías.

## Servidor

- Utiliza exclusivamente `OPENAI_API_KEY` del servidor; la clave no llega al navegador. No hace falta introducirla en los controles de Gemini.
- Modelo predeterminado: `gpt-image-1.5`; puede configurarse con `OPENAI_INFOGRAPHIC_MODEL`. La disponibilidad del modelo debe verificarse mediante una prueba real con la cuenta del servidor.
- Una imagen PNG vertical de 1024 × 1536, calidad `high`, por solicitud.
- Máximo de dos generaciones de imágenes OpenAI simultáneas por proceso, sin reintentos automáticos y con 180 segundos de espera del proveedor. El navegador limita su espera a 240 segundos.
- No hay sustitución silenciosa por Gemini cuando se solicita OpenAI. Los errores devueltos al navegador no incluyen respuestas crudas del proveedor.
- Se conservan las instrucciones de privacidad, ausencia de ecografías reales, lateralidad y ejes mamarios. Se utiliza el planificador de texto existente cuando está disponible; si falla, las instrucciones clínicas completas permanecen en el pedido de imagen.
- Se aplica la eliminación existente de encabezados identificativos; no equivale a garantizar que cualquier texto libre esté completamente anonimizado. No incorporar identificadores en las notas de diseño.
- La API se factura en la cuenta OpenAI del servidor y requiere acceso al modelo elegido. La suscripción de ChatGPT no demuestra acceso al modelo de la API.

## Verificación

```sh
node --experimental-strip-types --test scripts/session-stability.test.mjs scripts/performance-stability.test.mjs scripts/breast-laterality.test.mjs scripts/infographic-comparison.test.mjs
npm run build
npm run lint
```

Las pruebas de proveedores usan respuestas y claves ficticias: comprueban separación de públicos, destino explícito, cancelación, errores, límite de concurrencia y conservación de Gemini por defecto. No verifican calidad visual real ni acceso a la cuenta OpenAI. Antes de publicar, comprobar ambas imágenes con un caso ficticio y comparar los dos PDF exportados. La revisión visual sigue siendo necesaria para ambos proveedores.

Documentación de referencia: [generación de imágenes de OpenAI](https://developers.openai.com/api/docs/guides/image-generation).
