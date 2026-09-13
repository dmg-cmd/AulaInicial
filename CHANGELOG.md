# Historial de Cambios (CHANGELOG) - AulaInicial

Todos los cambios notables en este proyecto están documentados en este archivo.
El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/), y este proyecto se adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.8.2] - 2026-09-13
### Corregido
- **Corrección de Excepción al Guardar Datos en Excel (`reading 'add'`)**:
  - **Exportación de `registeredIPs` en `src/core/state.js`**: Se subsanó la falta de exportación de `registeredIPs` en el módulo de estado global, evitando que la desestructuración resultase en `undefined`.
  - **Blindaje Defensivo en `src/features/registration.js`**: Se protegieron las invocaciones a `registeredIPs.add(clientIP)` en `POST /api/registro` y `registeredIPs.has(clientIP)` en `GET /api/check-registration` con verificación defensiva de existencia (`state.registeredIPs`), eliminando por completo el error de ejecución `Cannot read properties of undefined (reading 'add')`.
  - **Prueba de Integración Automatizada**: Incorporación de `test/registro-guardar.test.js` en la suite de pruebas del proyecto (`npm test`) para garantizar la persistencia de datos real en el libro Excel y la correcta retención de IPs registradas.

---

## [4.8.1] - 2026-09-13
### Corregido
- **Solución Definitiva de Alto Contraste y Fondos Sólidos en el Formulario del Alumno**:
  - **Fondo Sólido y Opaco**: Se fijó `background-color: #090d16 !important;` en `html` y `body`, y `#0f172a !important;` en las tarjetas principales, erradicando fondos translúcidos que causaban percepción de fondo claro.
  - **Controles con Fondo Negro Mate**: Se unificó el fondo de todos los inputs, selects y casillas multiselect a `#030712 !important;` con bordes nítidos de `1.5px solid #475569 !important;` y texto en blanco puro `#ffffff !important;` (ratio de contraste 21:1).
  - **Directiva de Sistema `color-scheme: dark`**: Se añadió `<meta name="color-scheme" content="dark">` y `html { color-scheme: dark; }` para impedir que navegadores móviles en modo claro inyecten fondos blancos por omisión en controles de formulario.
  - **Blindaje de Autocompletado (`-webkit-autofill`)**: Se incorporó sombra inset opaca (`box-shadow: 0 0 0px 1000px #030712 inset !important;`) y `-webkit-text-fill-color: #ffffff !important;` para neutralizar el fondo amarillo/claro que los navegadores colocan en inputs con datos precargados.
  - **Eliminación de Residuos Semitransparentes en JS**: Se actualizaron `AUTO_INPUT_STYLE` y `style.cssText` en `index.js` y `main.ts` para que ningún campo inyecte fondos translúcidos en tiempo de ejecución.
  - **Cache-Busting en Estilos**: Se añadió versión de caché (`style.css?v=4.8.1`) para garantizar que los navegadores de estudiantes descarguen de inmediato la hoja de estilos actualizada.

---

## [4.8.0] - 2026-09-13
### Añadido
- **Reubicación de Grupos y Accesibilidad en Cabecera**:
  - Se eliminó la tarjeta inferior que ocupaba espacio prominente al final del flujo del alumno (`.mig194`).
  - Se integró el botón de consulta de grupos (`👥 Ver Grupos del Curso y Miembros`) directamente en la cabecera del portal (`header`), inmediatamente debajo del título del curso activo, en un formato compacto, accesible y táctil (`.btn-header-grupos`).
- **Rediseño Completo de Alto Contraste UI/UX en la Vista del Alumno**:
  - **Tarjetas Sólidas de Alto Contraste**: Se reforzó el fondo de las tarjetas de cristal (`rgba(15, 23, 42, 0.92)`) con borde claro (`rgba(255, 255, 255, 0.22)`), impidiendo que la contaminación lumínica de los fondos afecte la legibilidad.
  - **Legibilidad de Textos y Letras (WCAG AAA)**: Etiquetas (`label`), cabeceras y títulos elevados a blancos puros (`#ffffff` / `#f8fafc`) con 100% de opacidad y sombras sutiles.
  - **Entradas e Inputs Nítidos**: Campos de texto, menús desplegables y casillas multiselect con fondo `#090d16`, bordes claros de `1.5px` y placeholders contrastados (`#94a3b8`).
  - **Modal de Grupos de Alta Definición**: Tarjetas de grupos con fondo `#1e293b`, bordes de 1.5px, nombres de alumnos en blanco puro y especialidades nítidas en `#cbd5e1`.
  - **Banners y Badges de Asistencia**: Colores vivos con mayor saturación y contraste reforzado para estados de asistencia y nuevos requerimientos.

---

## [4.7.0] - 2026-09-13
### Añadido
- **Soporte Completo de Selección Múltiple (Casillas de Verificación) en Formularios**:
  - Nuevo tipo de campo `multiselect` ("☑️ Varias Opciones / Casillas de verificación") en el panel docente para crear encuestas o preguntas donde el alumno puede marcar más de una alternativa (ej. herramientas, plataformas educativas, habilidades previas).
  - Componente interactivo y accesible en la vista del alumno (`index.html` e interfaz automática) con casillas de verificación animadas, realce visual al marcarse y compatibilidad con pantallas táctiles.
  - Validación de campos requeridos adaptada a casillas de verificación (exige al menos una opción marcada).
  - Almacenamiento seguro y unificado en la planilla Excel separado por comas (ej. `"Google Classroom, Moodle"`), compatible hacia atrás con registros históricos.
  - Precarga automática de casillas seleccionadas a partir de los datos previamente registrados del alumno.
- **Desglose Analítico en el Motor de Estadísticas (`/api/stats`)**:
  - Reconocimiento automático de campos `multiselect` al procesar estadísticas.
  - Desglose de respuestas compuestas por separadores (`split(/[,;]/)`), computando frecuencias exactas para cada una de las opciones elegidas.
  - Cálculo de porcentajes sobre la base real de alumnos encuestados, garantizando métricas certeras en gráficos de barras, torta, dona y radar.

---

## [4.6.0] - 2026-09-13
### Añadido
- **Disponibilidad Total y Dinámica de Campos Personalizados en Estadísticas**:
  - Inclusión exhaustiva de todas las preguntas, relevamientos y encuestas configurados por el docente (`customFields`), permitiendo analizar estadísticas independientemente de su estado de habilitación diario en el formulario.
  - **Detección automática de columnas del Excel**: Inspección de las hojas de cálculo para incorporar automáticamente cualquier columna adicional que contenga respuestas de alumnos, evitando que queden relegadas de los reportes.
  - **Selector categorizado con `<optgroup>`**: Organización visual clara en el selector `📌 Campo a Analizar` con grupos semánticos:
    * `📌 Campos Estándar del Sistema`
    * `📚 Preguntas del Docente y Encuestas`
    * `📊 Otras Columnas del Curso (Excel)`
  - **Precarga y Sincronización Reactiva**: La lista de campos se precarga inmediatamente al iniciar el panel y se actualiza en vivo cada vez que el docente guarda cambios en la configuración del formulario.

---

## [4.5.0] - 2026-09-13
### Añadido
- **Barra de acciones rápidas superior en Configuración de Formulario**:
  - `🧹 Desmarcar Todo` (carmesí suave): Desmarca todas las casillas de campos estándar y personalizados con un solo clic.
  - `👤 Marcar Estándar` (azul cian): Selecciona de manera masiva todos los campos estándar del sistema (Email, DNI, Título, Tecnología, Grupo, Teléfono, Foto).
  - `📚 Marcar Personalizados` (violeta/púrpura): Selecciona todas las preguntas o campos creados por el docente.
  - `⭐ Marcar Últimos Campos` (dorado/ámbar): Selecciona automáticamente los campos agregados más recientes.
  - `💾 Guardar Configuración` (verde esmeralda superior): Botón principal visible en la cabecera sin necesidad de desplazamiento vertical, con animación de pulso y sincronizado con el botón inferior.
  - `👁️ Probar Vista Alumno`: Botón de acceso rápido a la vista previa del estudiante.
- **Píldora interactiva de estado de configuración (`#form-config-status-badge`)**: Muestra en tiempo real si la configuración está guardada (`✓ Guardado`) o pendiente de guardado (`● Cambios pendientes...`).
- **Auto-guardado silencioso al cambiar de pestaña**: Al navegar entre pestañas del panel docente, si existen modificaciones pendientes en el formulario, se persisten automáticamente para evitar pérdidas accidentales.

### Corregido
- **Blindaje y robustez en guardado de datos al Excel (`POST /api/registro`, `POST /api/mi-perfil/guardar`, `POST /api/mi-presente/remarcar`)**: Manejo seguro y coerción de tipos `String(...).trim()` en DNI, Teléfono, Grupo y campos personalizados, evitando excepciones de ejecución (`trim is not a function`) cuando el Excel almacena valores numéricos nativos en las celdas.

---

## [4.4.1] - 2026-09-13
### Corregido
- **Corrección de excepción en `/api/stats` (`ReferenceError: formConfig is not defined`)**: Se corrigió el acceso a la configuración de formularios en `src/features/attendance.js` mediante lectura segura de `state.formConfig` y fallback a `loadFormConfig()`, eliminando los errores HTTP 500 al consultar métricas.
- **Población dinámica de campos personalizados en el Panel Docente**: El selector `stats-field-select` ahora muestra todas las preguntas y campos configurados por el docente (`customFields`), permitiendo visualizar estadísticas de encuestas, modalidad y preguntas libres.
- **Extracción inteligente de columnas y conteo de respuestas en Excel**: Se implementó la correlación por ID, nombre y etiqueta de cada campo personalizado contra las columnas de la planilla Excel, calculando de manera exacta totales, frecuencias y porcentajes.
- **Disponibilidad permanente de campos estándar**: Se mantienen siempre disponibles en el selector todos los campos estándar (Título, Tecnología, Grupo, Asistencia, DNI, Email, Teléfono) para consultas históricas y nuevas, combinados con las preguntas personalizadas.
- **Sincronización en módulo TypeScript**: Se replicó la misma lógica en `refactorizado/src/services/AttendanceService.ts`.

---

## [4.4.0] - 2026-09-12
### Añadido
- **Soporte y compilación para computadoras Apple (macOS)**:
  - Soporte para arquitecturas **Apple Silicon** (`node22-macos-arm64` para chips M1, M2, M3, M4) e **Intel Mac** (`node22-macos-x64`).
  - Nuevos scripts de build en `package.json`: `npm run build:macos-arm64`, `npm run build:macos-x64`, `npm run build:macos` y `build` universal.
  - Actualización de `start.sh`: Detección automática de macOS (`Darwin`) y arquitectura de procesador (`arm64` / `x86_64`), ejecución directa de binarios con permisos `chmod +x`, modo Node.js de respaldo y descarga automática desde GitHub Releases.
  - Integración en GitHub Actions: Workflow `release.yml` actualizado con runners oficiales `macos-latest` (Apple Silicon) y `macos-13` (Intel) para compilar y adjuntar los binarios de macOS en cada Release.

---

## [4.3.1] - 2026-09-07
### Corregido
- **Elevación de capa y visibilidad en lista desplegable de alumnos (`.results-list`)**: Se configuró `#search-section` con `position: relative; z-index: 50;` y se elevó el apilamiento de `.results-list` a `z-index: 1000`, evitando que la tarjeta inferior de grupos con efecto cristalino (`backdrop-filter`) solape y tape los nombres desplegados.
- **Ampliación de altura visible de selección**: Se incrementó la altura máxima del contenedor de resultados de `200px` a `320px`, permitiendo visualizar fluidamente entre 6 y 8 alumnos simultáneamente.
- **Espaciado y jerarquía visual del botón de grupos**: Se ajustó la separación superior de la tarjeta de grupos (`.mig194`) a `2.5rem` con `position: relative; z-index: 1;`, evitando que quede pegada al campo de búsqueda del alumno.

---

## [4.3.0] - 2026-09-06
### Añadido
- **Endpoint seguro de consulta de ficha individual (`POST /api/alumno/mi-ficha`)**: Permite al dispositivo del estudiante consultar de forma protegida sus datos actuales (email, DNI, título, tecnología, grupo, teléfono, campos personalizados y estado de asistencia del día) para precargar el formulario sin exponer la nómina general a clientes no autorizados.
- **Badges de verificación reactiva de datos por campo**:
  - `✓ Guardado` (verde esmeralda sutil): Identifica visualmente los datos que ya están incorporados en la planilla Excel y permite editarlos en cualquier momento.
  - `⭐ Nuevo` (ámbar destacado con animación de pulso): Destaca campos vacíos o nuevas consignas y encuestas agregadas por el docente para la clase de hoy.
- **Banner dinámico de estado de asistencia (`#asistencia-status-banner`)**: Informa de forma prominente en el celular si el presente de hoy ya fue registrado (con indicación de estado y hora) o si la asistencia se encuentra pendiente de confirmación.
- **Suite de pruebas de integración (`test/mi-ficha-asistencia.test.js`)**: Pruebas automáticas para validar la entrega de fichas individuales, estado de asistencia y compatibilidad con el modo demo.

### Modificado
- **Flujo móvil sin pantallas ciegas de bloqueo**: Se eliminó la pantalla estática `#registered-section` que ocultaba el formulario con un mensaje rígido de *"¡Registro Exitoso!"*. Ahora el estudiante siempre accede directamente a su ficha interactiva y puede ver, verificar y modificar sus datos.
- **Precarga automática en búsqueda de alumnos (`selectAlumno`)**: Al seleccionar un alumno de la lista, el sistema consulta `/api/alumno/mi-ficha` y puebla instantáneamente todos los selectores e inputs con los datos del Excel.
- **Botón de envío contextual**:
  - Si el alumno no dio el presente hoy: `✅ DAR MI PRESENTE Y GUARDAR DATOS`.
  - Si el alumno ya dio el presente hoy: `💾 GUARDAR CAMBIOS EN MIS DATOS`.
- **Actualización reactiva sin recarga de página**: Al guardar cambios, la vista se actualiza en tiempo real sin recargar la página (`location.reload()`), manteniendo al alumno siempre en control de su ficha.

### Corregido
- **🔒 Bloqueo Estricto de Doble Presente Diario**: En `/api/registro`, si el alumno ya figura en la hoja de asistencia de hoy (`DD-MM-YYYY`), se preserva su estado de asistencia original y su hora de registro previa, bloqueando cualquier duplicación o alteración del presente diario mientras se actualizan sus datos en la planilla principal.
- **Eliminación del bloqueo indiscriminado 403**: Se eliminó el rechazo por IP que impedía a un estudiante actualizar sus propios datos o responder nuevas consignas desde el mismo dispositivo.

---

## [4.2.0] - 2026-09-06
### Añadido
- **Badge de versión visible en interfaz**: Se incorporó el badge de versión del sistema en la pantalla de alumnos (`index.html`), pantalla de login docente y encabezado administrativo (`admin.html`).
- **Endpoint público de versión (`GET /api/version`)**: Lee dinámicamente la versión desde `package.json` para evitar texto estático quemado.
- **Barra de herramientas en nómina de alumnos (`tab-alumnos`)**:
  - Buscador reactivo en tiempo real por nombre, apellido o DNI.
  - Filtro desplegable directo por Grupo.
  - Contador dinámico de estudiantes mostrados (`Mostrando X de Y alumnos`).
  - Alternador de vista entre Cuadrícula Ampliada y Tabla Detallada con persistencia en `localStorage`.
- **Vista de Tabla Administrativa Responsiva (`.admin-table-glass`)**: Muestra la nómina con columnas claras (Avatar, Apellido y Nombre completo, DNI, Grupo, Título, Estado Hoy, Historial de asistencias y Acciones rápidas).

### Corregido
- **Truncamiento de nombres en tarjetas de alumnos**: Se amplió el ancho mínimo de las tarjetas a `280px` y se configuró `white-space: normal` con altura de línea adecuada para mostrar nombres y apellidos completos sin puntos suspensivos.

---

## [4.1.1] y versiones previas
- Consulte la carpeta [`Docs/planes/`](file:///media/delm/SanDExt-2TB2/TTE%202026%202do%20Semestre/AulaInicial/Docs/planes) para el registro histórico y la especificación detallada de cada fase y funcionalidad previa.
