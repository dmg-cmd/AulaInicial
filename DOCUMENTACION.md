# Historial de Mejoras y Trazabilidad del Proyecto (AulaInicial)

Este documento es mantenido por el rol de **Documentador Técnico** para preservar el registro exhaustivo de todas las fases, planes de acción, versiones alcanzadas y estado de cada tarea realizada en el sistema.

---

## 📌 Estado de Planes Recientes

| Plan | Versión | Título / Objetivo | Estado | Fecha de Cierre |
| :--- | :---: | :--- | :---: | :---: |
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
