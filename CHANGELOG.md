# Historial de Cambios (CHANGELOG) - AulaInicial

Todos los cambios notables en este proyecto están documentados en este archivo.
El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/), y este proyecto se adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
