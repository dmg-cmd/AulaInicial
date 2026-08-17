# 📚 Fuente Principal de Conocimiento: AulaInicial v2.13
> **Documento optimizado para subir como Fuente (Source) a Google NotebookLM**

---

## 📑 1. Resumen Ejecutivo del Proyecto

**AulaInicial** es una plataforma web portátil, autónoma y de cero configuración (*Zero-Config*) diseñada para la gestión integral de asistencia, registro inicial de datos personales/de clase y organización de grupos en aulas presenciales o virtuales.

El sistema funciona de forma 100% independiente sin requerir servidores de base de datos externos ni conexión obligatoria a Internet, operando directamente desde unidades USB/Pendrives en cualquier equipo con Windows o Linux. Toda la información se persiste y sincroniza en tiempo real en hojas de cálculo de **Microsoft Excel (`.xlsx`)** ubicadas en la carpeta de trabajo `registros/`.

---

## 🌟 2. Arquitectura y Características Principales

### 🖥️ Filosofía Portátil Zero-Config
- **Ejecución Directa**: Se inicia haciendo doble clic en `start.bat` (Windows) o `start.sh` (Linux), o bien mediante los ejecutables compilados en `bin/` (`AulaInicial.exe`).
- **Detección Automática de IP Local**: El servidor Node.js/Express detecta la dirección IP de la red local (LAN/Wi-Fi) y genera automáticamente la URL y el código QR de acceso para los alumnos.
- **Persistencia en Excel**: No requiere bases de datos SQL/NoSQL. Lee y escribe directamente en archivos `.xlsx` usando `exceljs`.

---

## 👨‍🏫 3. Guía y Flujo de Trabajo del Docente (Vista Administrador)

El docente accede a través del Panel de Control (`admin.html`) que cuenta con una interfaz moderna basada en **Glassmorphism y modo oscuro**:

### A. 🎓 Manejo de Alumnos y Asistencia
- **Monitoreo en Tiempo Real**: Tarjetas con el estado de asistencia de cada alumno:
  - 🟢 **Presente**: Marcado automáticamente al enviar el formulario.
  - 🔴 **Ausente**: Alumno en nómina que no registró asistencia.
  - ⚪ **Pendiente**: Alumno que aún no ha completado su registro en la jornada.
- **Alta y Edición Manual**: Permite agregar o editar alumnos manualmente desde el panel sin abrir Excel.

### B. ⚙️ Configuración Dinámica de Formularios
- **Categorización de Campos**:
  - 👤 **Datos Personales**: Email privado, DNI/ID, Título Profesional / Especialidad, Nivel Tecnológico y Teléfono.
  - 📚 **Datos de Clase**: Preguntas, consultas o encuestas específicas activadas para la jornada.
- **🧹 Desmarcar Todas las Tildes (Limpieza Rápida)**:
  Botón para desmarcar con un solo clic todas las casillas activas tras finalizar una clase, guardando los cambios de forma automática sin borrar la definición de los campos para que puedan reutilizarse.
- **Editor Dinámico de Desplegables (`#options-editor-modal`)**:
  Panel interactivo para **Agregar**, **Editar** y **Eliminar** opciones en tiempo real de campos desplegables (como *Título Profesional* o *Relación con la Tecnología*).

### C. 📲 Lista y Código QR
- Muestra el código QR dinámico proyectable en pantalla de alta resolución para que los alumnos escaneen desde sus teléfonos inteligentes en la misma red Wi-Fi/LAN.

### D. 📊 Estadísticas Interactivas
- Gráficos interactivos construidos con **Chart.js**:
  - Distribución de alumnos según Título Profesional / Especialidad.
  - Distribución según Nivel Tecnológico / Relación con la Tecnología.

### E. 👥 Gestor de Grupos
- Módulo para visualizar y editar grupos de trabajo en el aula con normalización de nombres e insensibilidad a tildes o espacios.

### F. 📥 Exportación de Reportes
- Permite descargar informes consolidados en tres formatos:
  - 📊 **Excel (`.xlsx`)**: Planilla estructurada completa.
  - 📄 **Word (`.docx`)**: Informe ejecutivo formateado.
  - 📝 **Texto Plano (`.txt`)**: Resumen accesible y rápido.

---

## 🎓 4. Guía y Flujo del Alumno (Vista Formulario)

El alumno accede desde su teléfono móvil o laptop leyendo el código QR o ingresando la IP local en el navegador:

1. **Sin Contraseñas ni Descargas**: No requiere instalar aplicaciones ni crear cuentas.
2. **Búsqueda e Identificación Autocompletada**: Selector dinámico donde el alumno escribe las primeras letras de su nombre/apellido para encontrarse en la nómina precargada.
3. **Formulario Adaptable**:
   - Completa sus datos personales (👤) o de clase (📚) configurados por el docente para el día.
4. **Confirmación Explícita**:
   - Presiona el botón verde destacado **`✅ DAR MI PRESENTE Y ENVIAR`**.
   - El sistema valida el envío, bloquea reenvíos múltiples desde la misma IP (control de dispositivo) y muestra una tarjeta verde de confirmación exitosa.

---

## 🖼️ 5. Galería de Imágenes Reales de la Interfaz

Para asegurar que las presentaciones muestren la interfaz **real** de la aplicación (y no imágenes generadas ficticias), utiliza las capturas guardadas en la carpeta `Docs/Imagenes/`:

1. **`vista_docente_panel.png`**: Vista principal del Panel de Control del Docente con tarjetas de estado de asistencia en vivo (Presente, Ausente, Pendiente).
2. **`gestion_formularios_desplegables.png`**: Vista de la pestaña Formularios mostrando la categorización de datos y el botón `🧹 Desmarcar Todas las Tildes`.
3. **`proyeccion_codigo_qr.png`**: Vista del código QR proyectable en alta resolución con la IP de la red local.
4. **`estadisticas_graficos.png`**: Vista de los gráficos interactivos de Chart.js (Título Profesional y Nivel Tecnológico).
5. **`vista_alumno_formulario.png`**: Formulario móvil del alumno con selector autocompletado y botón verde `✅ DAR MI PRESENTE Y ENVIAR`.

---

## ❓ 6. Preguntas Frecuentes y Diagnóstico de Errores

1. **¿Qué ocurre si Excel está abierto durante la clase?**
   - El sistema detecta la condición de archivo bloqueado en Windows (`EBUSY`) y muestra una alerta solicitando al docente cerrar la planilla en Excel para sincronizar las asistencias.
2. **¿Requiere Internet?**
   - No. Solo requiere que los teléfonos y la computadora del docente estén conectados a la misma red local (Wi-Fi de la institución o punto de acceso generado por el docente).
3. **¿Cómo se reutiliza el formulario para una nueva clase?**
   - El docente presiona el botón **`🧹 Desmarcar Todas las Tildes`** en la pestaña Formularios para limpiar el estado de selección manteniendo las configuraciones listas.
