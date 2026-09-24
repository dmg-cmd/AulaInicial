# Historial de Mejoras y Trazabilidad del Proyecto (AulaInicial)

Este documento es mantenido por el rol de **Documentador Técnico** para preservar el registro exhaustivo de todas las fases, planes de acción, versiones alcanzadas y estado de cada tarea realizada en el sistema.

---

## 📌 Estado de Planes Recientes

| Plan | Versión | Título / Objetivo | Estado | Fecha de Cierre |
| :--- | :---: | :--- | :---: | :---: |
| [Plan 60](file:///e:/Sandbox/AulaInicial/Docs/planes/60-publicacion-segura-github-v4101.md) | **v4.10.1** | Publicación segura a GitHub (Versión 4.10.1) con auditoría DLP | **En curso ⏳** | Pendiente |
| [Plan 59](file:///e:/Sandbox/AulaInicial/Docs/planes/59-solucion-definitiva-logo-base64.md) | **v4.10.1** | Solución definitiva de visualización de logotipo (embebido Data URI directo y recompilación) | **Finalizado ✅** | 2026-09-19 |
| [Plan 58](file:///e:/Sandbox/AulaInicial/Docs/planes/58-correccion-visualizacion-logo-version-blindaje.md) | **v4.10.0** | Corrección y blindaje definitivo de visualización de logotipo y versión del sistema | **Finalizado ✅** | 2026-09-19 |
| [Plan 57](file:///e:/Sandbox/AulaInicial/Docs/planes/57-correccion-presente-automatico-primer-alumna-aislamiento-tests.md) | **v4.9.4** | Corrección de falso presente automático en primer alumna y aislamiento total de pruebas automatizadas | **Finalizado ✅** | 2026-09-14 |
| [Plan 56](file:///e:/Sandbox/AulaInicial/Docs/planes/56-restauracion-campos-formulario-blindaje.md) | **v4.9.3** | Restauración de campos estándar y personalizados en formulario y blindaje contra desmarcado accidental | **Finalizado ✅** | 2026-09-14 |
| [Plan 55](file:///e:/Sandbox/AulaInicial/Docs/planes/55-speeches-descripciones-comentarios-redes.md) | **v4.9.2** | Speeches escritos para descripciones y primeros comentarios fijados por red social | **Finalizado ✅** | 2026-09-14 |
| [Plan 54](file:///e:/Sandbox/AulaInicial/Docs/planes/54-guia-maestra-publicacion-speeches-redes.md) | **v4.9.2** | Guía maestra de publicación, speeches de locución y optimización de algoritmos | **Finalizado ✅** | 2026-09-14 |
| [Plan 53](file:///e:/Sandbox/AulaInicial/Docs/planes/53-placa-cierre-video-outro-identidad.md) | **v4.9.2** | Diseño y renderizado de placas de cierre (outro cards) 16:9 y 9:16 para videos | **Finalizado ✅** | 2026-09-14 |
| [Plan 52](file:///e:/Sandbox/AulaInicial/Docs/planes/52-canales-oficiales-publicidad-iconos-redes.md) | **v4.9.2** | Configuración de canales oficiales en publicidad y barra de íconos de redes | **Finalizado ✅** | 2026-09-14 |
| [Plan 51](file:///e:/Sandbox/AulaInicial/Docs/planes/51-banner-apoyo-kofi-instagram.md) | **v4.9.1** | Banner no invasivo de apoyo comunitario (Ko-fi e Instagram) | **Finalizado ✅** | 2026-09-14 |
| [Plan 50](file:///e:/Sandbox/AulaInicial/Docs/planes/50-integracion-logotipo-oficial-aulainicial.md) | **v4.9.0** | Integración del logotipo oficial de AulaInicial en web (favicon, cabeceras, login y assets) | **Finalizado ✅** | 2026-09-14 |
| [Plan 44](file:///e:/Sandbox/AulaInicial/Docs/planes/44-fix-error-guardar-datos-excel-reading-add.md) | **v4.8.2** | Corrección de excepción TypeError al guardar datos en Excel (reading 'add') | **Finalizado ✅** | 2026-09-13 |
| [Plan 43](file:///e:/Sandbox/AulaInicial/Docs/planes/43-solucion-definitiva-alto-contraste-formulario.md) | **v4.8.1** | Solución definitiva de alto contraste, fondos sólidos opacos y blindaje contra fondos claros en formulario alumno | **Finalizado ✅** | 2026-09-13 |
| [Plan 42](file:///e:/Sandbox/AulaInicial/Docs/planes/42-ubicacion-grupos-alto-contraste-alumno.md) | **v4.8.0** | Reubicación de grupos bajo el título y optimización de alto contraste en vista alumno | **Finalizado ✅** | 2026-09-13 |
| [Plan 41](file:///e:/Sandbox/AulaInicial/Docs/planes/41-campo-seleccion-multiple-formulario.md) | **v4.7.0** | Selección múltiple (casillas de verificación) en formulario de alumnos y estadísticas desglosadas | **Finalizado ✅** | 2026-09-13 |
| [Plan 40](file:///e:/Sandbox/AulaInicial/Docs/planes/40-campos-personalizados-selector-estadisticas.md) | **v4.6.0** | Disponibilidad dinámica de campos personalizados y preguntas del docente en estadísticas | **Finalizado ✅** | 2026-09-13 |
| [Plan 39](file:///e:/Sandbox/AulaInicial/Docs/planes/39-barra-acciones-formulario-guardado-superior.md) | **v4.5.0** | Barra de acciones rápidas del formulario, botón superior de guardado y robustez en Excel | **Finalizado ✅** | 2026-09-13 |
| [Plan 38](file:///e:/Sandbox/AulaInicial/Docs/planes/38-estadisticas-campos-personalizados.md) | **v4.4.1** | Visualización y métricas de estadísticas para campos y preguntas personalizadas en Panel Docente | **Finalizado ✅** | 2026-09-13 |

---

## 📋 Detalle de Mejoras por Versión

### Versión 4.10.1 (2026-09-19)
- **Plan asociado:** [`Docs/planes/59-solucion-definitiva-logo-base64.md`](file:///e:/Sandbox/AulaInicial/Docs/planes/59-solucion-definitiva-logo-base64.md)
- **Solución Definitiva de Logotipo y Empaquetado:**
  1. **Fallback Inmediato Data URI Base64:** Incorporación de `assets/logo-base64.js` y conmutación automática en caso de interrupción de red.
  2. **Resolución Resiliente de Directorio de Assets:** Localización adaptativa de `assets/` en ejecutable empaquetado y entorno local.

### Versión 4.10.0 (2026-09-19)
- **Plan asociado:** [`Docs/planes/58-correccion-visualizacion-logo-version-blindaje.md`](file:///e:/Sandbox/AulaInicial/Docs/planes/58-correccion-visualizacion-logo-version-blindaje.md)
- **Precarga Estática de Versión y Blindaje de Badges:**
  1. **Pre-renderizado Inmediato:** Badges de versión pre-renderizados en el HTML eliminando demoras visuales.
  2. **Resolución de Versión en Backend:** Carga resiliente de `package.json` desde rutas ejecutables y de desarrollo.

### Versión 4.9.4 (2026-09-14)
- **Plan asociado:** [`Docs/planes/57-correccion-presente-automatico-primer-alumna-aislamiento-tests.md`](file:///e:/Sandbox/AulaInicial/Docs/planes/57-correccion-presente-automatico-primer-alumna-aislamiento-tests.md)
- **Aislamiento de Tests y Corrección de Falso Presente:**
  1. **Aislamiento de Pruebas:** Modificación de `src/config/paths.js` y `test/registro-guardar.test.js` para usar carpetas temporales y cursos mock desechables, garantizando que `npm test` no toque jamás las planillas reales de producción.
  2. **Restauración de Planilla Excel:** Purga de la fecha de hoy espuria en `registros/TED - PDS San Miguel mayo 2025.xlsx` y restauración de los datos limpios originales de la primera alumna (`Lucila Alende Noceti`), volviendo a su estado pendiente sin marcas en verde.

---

### Versión 4.8.2 (2026-09-13)
- **Plan asociado:** [`Docs/planes/44-fix-error-guardar-datos-excel-reading-add.md`](file:///e:/Sandbox/AulaInicial/Docs/planes/44-fix-error-guardar-datos-excel-reading-add.md)
- **Corrección de Excepción al Guardar Datos en Excel (`reading 'add'`):**
  1. **Exportación Correcta de `registeredIPs` en `state.js`**: Se subsanó la discrepancia donde `src/core/state.js` solo exportaba `{ state }`, provocando que la desestructuración `const { state, registeredIPs } = require('../core/state')` dejara `registeredIPs` como `undefined`.
  2. **Blindaje Defensivo en `registration.js`**: Invocaciones a `registeredIPs.add(clientIP)` y `registeredIPs.has(clientIP)` blindadas con validación defensiva de existencia (`state.registeredIPs`), eliminando el error `TypeError: Cannot read properties of undefined (reading 'add')`.
  3. **Prueba de Integración Real**: Adición del test `test/registro-guardar.test.js` a la suite principal `npm test`, asegurando el guardado íntegro en planillas Excel sin interrupciones.

### Versión 4.8.1 (2026-09-13)
- **Plan asociado:** [`Docs/planes/43-solucion-definitiva-alto-contraste-formulario.md`](file:///e:/Sandbox/AulaInicial/Docs/planes/43-solucion-definitiva-alto-contraste-formulario.md)
- **Solución Definitiva de Alto Contraste y Fondos Sólidos en el Formulario del Alumno:**
  1. **Fondo General y Tarjetas 100% Opacas:** Fondo de página fijado en `#090d16 !important;` y tarjetas en `#0f172a !important;` con bordes nítidos de `1.5px`, anulando transparencias y blobs difusos de fondo que causaban apariencia de fondo claro en pantallas de celulares.
  2. **Controles de Entrada en Negro Azabache Mate:** Todos los `input`, `select`, casillas multiselect y `textarea` establecidos en fondo sólido `#030712 !important;` con bordes `#475569 !important;` y letras blanco puro `#ffffff !important;` con `-webkit-text-fill-color: #ffffff !important;` (ratio de contraste 21:1, superando WCAG AAA).
  3. **Directivas `color-scheme: dark`**: Incorporación de `<meta name="color-scheme" content="dark">` y `html { color-scheme: dark; }` para evitar que navegadores móviles en modo claro inyecten fondo blanco en inputs.
  4. **Blindaje contra Autocompletado del Navegador (`-webkit-autofill`)**: Sombra interna forzada a `#030712` para neutralizar el fondo amarillo/claro que inyectan los navegadores en datos precargados.
  5. **Depuración de Estilos Inline en JavaScript y TypeScript:** Se actualizaron `AUTO_INPUT_STYLE` y `style.cssText` en `index.js` y `main.ts` para eliminar fondos translúcidos generados dinámicamente.
  6. **Cache-Busting Activo:** Parámetro de versión `style.css?v=4.8.1` para forzar la actualización inmediata en navegadores de los estudiantes.

### Versión 4.8.0 (2026-09-13)
- **Plan asociado:** [`Docs/planes/42-ubicacion-grupos-alto-contraste-alumno.md`](file:///e:/Sandbox/AulaInicial/Docs/planes/42-ubicacion-grupos-alto-contraste-alumno.md)
- **Reubicación de Grupos y Alto Contraste en Vista Alumno:**
  1. **Acción de Grupos en Cabecera:** Se eliminó la tarjeta inferior `.mig194` y se posicionó un botón ergonómico y compacto (`.btn-header-grupos`) debajo del subtítulo del curso activo.
  2. **Alto Contraste General (WCAG AAA):** Las tarjetas `.card.glass` pasaron de un fondo semitransparente difuso a un fondo oscuro de alta opacidad (`rgba(15, 23, 42, 0.92)`) con bordes nítidos.
  3. **Legibilidad de Letras y Textos:** Etiquetas de campos, cabeceras, placeholders y notas informativas configuradas con blancos nítidos (`#ffffff`) y contrastes directos.
  4. **Contenedor Multiselect y Modal de Grupos:** Opciones con contraste elevado, realce al seleccionarse y tarjetas del modal con fondo sólido `#1e293b`.

### Versión 4.7.0 (2026-09-13)
- **Plan asociado:** [`Docs/planes/41-campo-seleccion-multiple-formulario.md`](file:///e:/Sandbox/AulaInicial/Docs/planes/41-campo-seleccion-multiple-formulario.md)
- **Selección Múltiple (Casillas de Verificación) y Estadísticas Desglosadas:**
  1. **Nuevo Tipo de Campo en Formulario (`multiselect`):** Los docentes pueden crear y configurar campos de varias opciones mediante casillas de verificación (checkboxes) para relevamientos pedagógicos y tecnológicos (ej. *«¿Qué plataformas educativas has utilizado alguna vez?»*).
  2. **Interfaz del Alumno Interactiva y Adaptable:** Casillas estilizadas con borde suave, fondo reactivo de selección (`#6366f1`), accesibles con teclado y optimizadas para pantallas táctiles de celulares.
  3. **Almacenamiento Compatible en Excel:** Concatenación estándar separada por comas (`"Google Classroom, Moodle"`), permitiendo una lectura fluida tanto humana como por sistemas externos.
  4. **Desglose Analítico en Estadísticas:** El backend descompone las respuestas con múltiples valores para computar frecuencias unitarias por opción y porcentajes basados en la cantidad real de alumnos encuestados.
  5. **Sincronización Dual:** Implementación idéntica en JavaScript nativo (`index.js`, `admin.js`, `src/features/attendance.js`) y en TypeScript refactorizado (`main.ts`, `AttendanceService.ts`).

### Versión 4.6.0 (2026-09-13)
- **Plan asociado:** [`Docs/planes/40-campos-personalizados-selector-estadisticas.md`](file:///e:/Sandbox/AulaInicial/Docs/planes/40-campos-personalizados-selector-estadisticas.md)
- **Disponibilidad Total y Dinámica de Campos Personalizados en Estadísticas:**
  1. **Integración Completa de Preguntas del Docente (`customFields`):** Todos los campos y encuestas configurados por el docente se encuentran permanentemente disponibles para evaluar las respuestas de los estudiantes en gráficos y tablas de frecuencias, sin depender de que la casilla esté tildada ese mismo día en el formulario.
  2. **Detección Automática de Columnas en Excel:** Inspección directa del libro de cálculo (`TED - PDS San Miguel mayo 2025.xlsx`) para incorporar cualquier columna adicional con respuestas de alumnos.
  3. **Selector Estructurado con Grupos Semánticos (`optgroup`):** Categorización accesible en `📌 Campo a Analizar`:
     - `📌 Campos Estándar del Sistema`
     - `📚 Preguntas del Docente y Encuestas`
     - `📊 Otras Columnas del Curso (Excel)`
  4. **Precarga Proactiva y Sincronización en Vivo:** Carga inmediata de campos al arrancar el panel docente, al entrar a la pestaña estadísticas y sincronización instantánea al guardar cambios en el formulario.

### Versión 4.5.0 (2026-09-13)
- **Plan asociado:** [`Docs/planes/39-barra-acciones-formulario-guardado-superior.md`](file:///e:/Sandbox/AulaInicial/Docs/planes/39-barra-acciones-formulario-guardado-superior.md)
- **Mejoras en Usabilidad, Panel Docente y Robustez:**
  1. **Barra Superior de Acciones Rápidas del Formulario:** Incorporación de botones ergonómicos en la cabecera de configuración:
     - `🧹 Desmarcar Todo`: limpia todas las casillas de campos estándar y personalizados con un solo clic.
     - `👤 Marcar Estándar`: activa masivamente los campos base (DNI, Email, Título, Tecnología, Grupo, Teléfono, Foto).
     - `📚 Marcar Personalizados`: activa de forma masiva todas las preguntas y campos creados por el docente.
     - `⭐ Marcar Últimos Campos`: selecciona automáticamente los campos creados más recientemente.
     - `💾 Guardar Configuración`: botón superior en verde esmeralda con animación de pulso, accesible sin necesidad de desplazarse verticalmente y sincronizado con el botón inferior.
     - `👁️ Probar Vista Alumno`: acceso instantáneo a la previsualización del alumno.
  2. **Píldora Reactiva de Estado y Auto-guardado Silencioso:** Muestra el estado en vivo (`✓ Todo guardado` / `● Cambios pendientes...`) y guarda automáticamente los cambios al navegar entre pestañas evitando pérdidas accidentales de casillas marcadas.
  3. **Blindaje de Manejo de Tipos en Excel:** Coerción segura de datos numéricos a texto con `String(...).trim()` en DNI, Teléfono y campos personalizados al registrar asistencias o actualizar fichas en el Excel.

### Versión 4.4.1 (2026-09-13)
| [Plan 35](file:///e:/Sandbox/AulaInicial/Docs/planes/35-soporte-compilacion-macos-apple.md) | **v4.4.0** | Soporte y compilación para computadoras Apple (macOS Apple Silicon e Intel) | **Finalizado ✅** | 2026-09-12 |
| [Plan 34](file:///e:/Sandbox/AulaInicial/Docs/planes/34-actualizacion-readme-mejoras-github.md) | **v4.3.1** | Publicación y actualización de mejoras en el README de GitHub | **Finalizado ✅** | 2026-09-07 |
| [Plan 33](file:///e:/Sandbox/AulaInicial/Docs/planes/33-auditoria-compilacion-publicacion-github.md) | **v4.3.1** | Auditoría DLP, compilación de binarios y publicación a GitHub | **Finalizado ✅** | 2026-09-07 |
| [Plan 32](file:///e:/Sandbox/AulaInicial/Docs/planes/32-mejora-ux-desplegable-alumnos-espaciado.md) | **v4.3.1** | Elevación de capa en lista de alumnos, ampliación de altura visible y separación del botón de grupos | **Finalizado ✅** | 2026-09-07 |
| [Plan 31](file:///e:/Sandbox/AulaInicial/Docs/planes/31-reglas-alcance-permisos-archivos.md) | **v4.3.0** | Reglas estrictas de alcance y permisos de archivos dentro del repositorio | **Finalizado ✅** | 2026-09-06 |
| [Plan 30](file:///e:/Sandbox/AulaInicial/Docs/planes/30-formulario-dinamico-verificacion-modificacion-alumnos.md) | **v4.3.0** | Formulario dinámico en móvil, precarga de datos, verificación reactiva y bloqueo de doble presente diario | **Finalizado ✅** | 2026-09-06 |
| [Plan 29](file:///e:/Sandbox/AulaInicial/Docs/planes/29-mejora-visibilidad-version-nomina-alumnos.md) | **v4.2.0** | Versión visible en UI, nombres completos sin recortes, buscador en vivo y vista tabla/cuadrícula | **Finalizado ✅** | 2026-09-06 |
| Planes 01 a 28 | v1.x - v4.1 | Notificaciones, mensajes, tardanzas, analítica, encuestas, reportes y seguridad | Histórico | Previo |

---

## 📋 Detalle de Mejoras por Versión

### Versión 4.4.1 (2026-09-13)
- **Plan asociado:** [`Docs/planes/38-estadisticas-campos-personalizados.md`](file:///e:/Sandbox/AulaInicial/Docs/planes/38-estadisticas-campos-personalizados.md)
- **Correcciones y Mejoras Funcionales en Estadísticas:**
  1. **Solución a fallo en `/api/stats`:** Corrección de la referencia no definida `formConfig` en `src/features/attendance.js` que causaba error HTTP 500.
  2. **Población dinámica de preguntas del docente (`customFields`):** Integración de todos los campos personalizados habilitados en el selector `Campo a Analizar` del panel docente.
  3. **Extracción inteligente de columnas en Excel:** Mapeo de identificadores y etiquetas de preguntas para computar frecuencias, totales y porcentajes en gráficos (barras, torta, dona, radar) y tablas dinámicas.
  4. **Preservación total de campos estándar:** Todos los campos estándar (Título, Tecnología, Grupo, Asistencia, DNI, Email, Teléfono) permanecen siempre disponibles para nuevas consultas o análisis de planillas históricas, integrándose armónicamente con los campos personalizados.

### Versión 4.4.0 (2026-09-12)
- **Plan asociado:** [`Docs/planes/35-soporte-compilacion-macos-apple.md`](file:///e:/Sandbox/AulaInicial/Docs/planes/35-soporte-compilacion-macos-apple.md)
- **Novedades de plataforma y portabilidad:**
  1. **Compatibilidad con computadoras Apple (macOS):** Soporte oficial para arquitecturas Apple Silicon (chips M1, M2, M3, M4 con `arm64`) y procesadores Intel Mac (`x86_64`).
  2. **Scripts de compilación dedicados:** Inclusión de `build:macos-arm64`, `build:macos-x64` y `build:macos` en `package.json`.
  3. **Script de inicio universal (`start.sh`):** Detección dinámica de macOS (`Darwin`), identificación de arquitectura de CPU, asignación automática de permisos de ejecución (`chmod +x`), arranque con Node.js y descarga automática desde GitHub Releases.
  4. **Automatización en GitHub Actions:** Actualización de `release.yml` para compilar y generar los binarios de macOS en runners oficiales de Apple.

### Versión 4.3.1 (2026-09-07)
- **Plan asociado:** [`Docs/planes/32-mejora-ux-desplegable-alumnos-espaciado.md`](file:///e:/Sandbox/AulaInicial/Docs/planes/32-mejora-ux-desplegable-alumnos-espaciado.md)
- **Cambios funcionales y de diseño:**
  1. **Elevación de capa (*Stacking Context*):** Se fijó `position: relative; z-index: 50;` en `#search-section` y `z-index: 1000` en `.results-list`, impidiendo que tarjetas inferiores con `backdrop-filter` tapen la lista de nombres.
  2. **Ampliación de altura desplegable:** Aumento de `200px` a `320px` de altura máxima, mostrando entre 6 y 8 alumnos simultáneamente con scroll suave y bordes nítidos.
  3. **Espaciado y jerarquía ergonómica:** Separación de `2.5rem` y `z-index: 1` para la tarjeta del botón *"Ver Grupos del Curso y Miembros"*, evitando proximidad invasiva al selector de nombres.

### Versión 4.3.0 (2026-09-06)
- **Plan asociado:** [`Docs/planes/30-formulario-dinamico-verificacion-modificacion-alumnos.md`](file:///media/delm/SanDExt-2TB2/TTE%202026%202do%20Semestre/AulaInicial/Docs/planes/30-formulario-dinamico-verificacion-modificacion-alumnos.md)
- **Cambios funcionales:**
  1. **Fin del bloqueo ciego:** Se eliminó la pantalla estática `#registered-section` que ocultaba el formulario. El alumno siempre tiene acceso a su ficha interactiva.
  2. **Endpoint seguro `/api/alumno/mi-ficha`:** Precarga instantánea de los datos del alumno (DNI, email, teléfono, especialidad, tecnología, grupo, campos personalizados) desde la planilla Excel.
  3. **Verificación visual:** Badges `✓ Guardado` para datos preexistentes y `⭐ Nuevo` para campos vacíos o nuevas preguntas solicitadas por el docente para la clase.
  4. **Bloqueo estricto de doble presente diario:** Si el alumno ya dio el presente hoy, puede seguir actualizando sus datos, pero el sistema bloquea cualquier duplicación o cambio en su hora de asistencia original.
  5. **Actualización reactiva:** El formulario se actualiza en tiempo real sin recargar la página (`location.reload()`).

### Versión 4.2.0 (2026-09-06)
- **Plan asociado:** [`Docs/planes/29-mejora-visibilidad-version-nomina-alumnos.md`](file:///media/delm/SanDExt-2TB2/TTE%202026%202do%20Semestre/AulaInicial/Docs/planes/29-mejora-visibilidad-version-nomina-alumnos.md)
- **Cambios funcionales:**
  1. **Badge de versión:** Indicador visible `v4.2.0` en `index.html` (portal del alumno) y `admin.html` (login y panel docente) consumido dinámicamente desde `/api/version`.
  2. **Nombres completos legibles:** Ampliación de tarjetas de alumnos a 280px con texto multilínea sin cortes con elipsis.
  3. **Buscador en tiempo real:** Barra de búsqueda en nómina de alumnos que filtra instantáneamente por nombre, apellido, DNI o grupo.
  4. **Modo Tabla / Cuadrícula:** Alternador de vista con persistencia en `localStorage`.

---

## 🔒 Política de Preservación de Planes
De acuerdo con las reglas de gobernanza del proyecto (`AGENTS.md`), **ningún archivo de plan en `Docs/planes/` se elimina al terminar una tarea**. Todos permanecen archivados y actualizados con:
- Estado explícito (`Estado: Finalizado ✅`).
- Versión exacta alcanzada.
- Fecha de cierre.
- Resumen de archivos modificados y resultados de pruebas.
