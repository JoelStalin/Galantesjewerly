# Galantes Jewelry - Casos de Uso y Matriz de Pruebas Funcionales
## Automatización de Inventario vía WhatsApp & Orquestación ORCA

Este documento establece la especificación milimétrica de casos de uso y la matriz de validación funcional para el agente de inventario integrado con WhatsApp y los modelos de ORCA.

---

## 📌 1. Mapeo de Casos de Uso (Functional Scenarios)

### **Caso de Uso 1: Verificación de Sesión y Persistencia Activa (UC-01)**
- **Descripción:** Validar que el nodo de WhatsApp en GCP VM (`galantes_whatsapp_browser`) mantenga la sesión activa (`state: "logged_in"`), almacene tokens en el volumen persistente y transmita el frame en vivo sin desconexiones.
- **Entrada:** Petición HTTP a `/status` y `/frame`.
- **Criterio de Aceptación:** Estado `logged_in`, `hasFrame: true`, tokens en `/app/data/whatsapp-session`.

---

### **Caso de Uso 2: Ingesta con Alta Similitud Visual $\ge 95\%$ (Auto-Match) (UC-02)**
- **Descripción:** Recepción de fotografía de joya coincidente con un producto existente en el catálogo ($\ge 95\%$ similitud por vector de características).
- **Entrada:** 
  - Fotografía enviada desde `+1 786-246-2664`.
  - Caption informal en español: *"cadena cubana de oro 14k 22 pulgadas, precio $1850, stock 5"*.
- **Procesamiento:**
  1. Comparador visual (`compare_whatsapp_image.py`) calcula similitud $\ge 0.95$.
  2. Parser NLP de ORCA (`orca_nlp_metadata_parser.mjs`) extrae:
     - `price`: 1850
     - `stock`: 5
     - `category`: Chains
     - `karat`: 14K
  3. Genera título 100% en inglés: *"14K Yellow Gold Cuban Link Chain 22 Inch"*.
  4. Corrección estricta gramatical y ortográfica (cero palabras en español).
- **Salida:**
  - Actualización de inventario en Odoo/catálogo.
  - Mensaje de confirmación enviado a `+1 786-246-2664`.

---

### **Caso de Uso 3: Ingesta con Similitud Ambigua ($70\% - 94\%$) con Tarjeta Comparativa (UC-03)**
- **Descripción:** La imagen recibida tiene parecido visual con 1 o más productos del catálogo, pero no alcanza la certeza del $95\%$.
- **Procesamiento:**
  1. Generador de imágenes (`generate_labeled_comparison.py`) produce un collage con etiquetas claras:
     - Panel 0: **[ORIGINAL (WHATSAPP)]** (Badge verde).
     - Panel 1: **[CANDIDATE 1: SKU GAL-1044 (84%)]** (Badge ámbar/oro).
     - Panel 2: **[CANDIDATE 2: SKU GAL-1089 (73%)]** (Badge pizarra).
  2. Envío del collage al operador `+1 786-246-2664` con la instrucción:
     *"Encontramos productos similares. Responde '1' para Candidato 1, '2' para Candidato 2, o 'NO' para descartar."*
  3. Operador responde: `"1"`.
  4. Sistema confirma Candidato 1 y dispara el aprendizaje activo de ORCA.
- **Salida:**
  - Registro de decisión en `learning-feedback.jsonl`.
  - Inyección del vector de la imagen entrante en `image-vectors.json` mediante `add_vector_exemplar.py`.

---

### **Caso de Uso 4: Descarte de Ambigüedad por el Operador (UC-04)**
- **Descripción:** Ante una tarjeta de candidatos ambiguos, el operador determina que ninguno corresponde al producto.
- **Entrada:** Respuesta del operador: `"NO"`.
- **Procesamiento:**
  1. El coordinador intercepta el descarte.
  2. Registra la retroalimentación negativa en ORCA.
  3. Redirige automáticamente la imagen con la propuesta de metadatos al grupo de WhatsApp `galantesbacklog`.
- **Criterio de Aceptación:** Desvío exitoso al grupo backlog.

---

### **Caso de Uso 5: Sin Coincidencia Visual ($< 70\%$) - Producto Nuevo a Backlog (UC-05)**
- **Descripción:** La fotografía no coincide con ninguna pieza del catálogo existente ($< 70\%$).
- **Procesamiento:**
  1. Clasificación `status: "no_match"`.
  2. ORCA genera una propuesta de nuevo producto (título en inglés, categoría inferida, precio y stock del caption).
  3. Se envía la foto + ficha técnica al grupo de WhatsApp `galantesbacklog`.
  4. Prompt al equipo:
     *"[NUEVA JOYA DETECTADA] Sin coincidencia en catálogo. Responde 'CREATE' para dar de alta en Odoo o 'DISCARD' para ignorar."*
- **Criterio de Aceptación:** Propuesta enviada al grupo `galantesbacklog`.

---

### **Caso de Uso 6: Active Learning & Actualización Continua de Vectores (UC-06)**
- **Descripción:** Garantizar que cada decisión humana aumente la inteligencia del modelo.
- **Procesamiento:**
  1. Escritura duradera en `data/orca/tenants/galantesjewelry/learning-feedback.jsonl`.
  2. Actualización del índice vectorial `image-vectors.json` con el vector de 58 dimensiones de la nueva imagen confirmada.
  3. En consultas posteriores de imágenes con ángulos similares, la similitud calculada es significativamente superior.
