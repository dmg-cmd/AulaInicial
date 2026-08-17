He creado el recurso solicitado en tu panel de **Studio** con el título **`Guía de Puesta en Marcha - AulaInicial (Guion de Video)`**. Este documento está diseñado específicamente con una estructura profesional de guion audiovisual, dividida en indicaciones visuales y narración hablada para que puedas grabar o guiar la sesión de manera sumamente clara.

Antes de comenzar, es sumamente importante hacer una precisión basada estrictamente en la documentación de tu plataforma:
*   **Versión del Sistema**: La documentación provista detalla el funcionamiento de la versión **AulaInicial v2.13** [1]. Los pasos de este guion se adaptan perfectamente a esta base tecnológica.
*   **Control de Fotos de Rostro**: Las fuentes seleccionadas **no registran ni mencionan una función para el control de fotos de rostro** [2, 3]. Los campos de datos personales validados y disponibles son: *Email privado, DNI/ID, Título Profesional / Especialidad, Nivel Tecnológico* y *Teléfono* [2]. He estructurado el guion aclarando de forma honesta este alcance para no inducir a errores en la grabación.

---

### Resumen de la Estructura del Guion de Video

El guion en tu panel de Studio está dividido en **8 escenas clave** que garantizan que ningún docente se pierda en el proceso:

1.  **Escena 1: Conexión y Portabilidad (Zero-Config)**: Se muestra la inserción física del pendrive o USB, explicando que el sistema funciona de manera 100% autónoma sin requerir internet ni servidores externos [1, 4].
2.  **Escena 2: Lanzamiento del Servidor**: El paso a paso para ejecutar `start.bat` (Windows) o `bin/AulaInicial.exe` [5]. Se explica cómo el servidor local Node.js detecta automáticamente la IP de la red local para dar acceso [5].
3.  **Escena 3: Proyección del Código QR**: Cómo mostrar en la pantalla del aula el código QR dinámico de alta resolución para que los estudiantes se conecten escaneando desde sus teléfonos inteligentes en la misma red Wi-Fi o LAN [3, 6, 7].
4.  **Escena 4: Configuración Dinámica de Formularios**: El uso del Panel de Control en modo oscuro y Glassmorphism para activar campos personales y preguntas de clase [2, 8], utilizando el editor dinámico de desplegables (`#options-editor-modal`) [2].
5.  **Escena 5: Monitoreo en Tiempo Real**: La experiencia del alumno al firmar su asistencia de forma autocompletada y sin contraseñas [3], y cómo el docente visualiza en vivo las tarjetas de estado: 🟢 **Presente**, 🔴 **Ausente** y ⚪ **Pendiente** [8].
6.  **Escena 6: Reinicio de Clase (Botón Limpieza Rápida)**: El uso del botón **🧹 Desmarcar Todas las Tildes** en la pestaña de Formularios, que limpia los registros de asistencia del día con un solo clic para reutilizar los campos en la siguiente jornada sin borrar sus definiciones [2, 4].
7.  **Escena 7: Alerta de Archivo Bloqueado (Error EBUSY)**: Una sección dedicada a la resolución de problemas. Se detalla la alerta que emite el sistema cuando el docente tiene la hoja de cálculo de Excel abierta en Windows, impidiendo la escritura directa con *exceljs*, y la sencilla solución de cerrarla para restablecer la sincronización en tiempo real [1, 4, 5].
8.  **Escena 8: Análisis y Exportación de Reportes**: El cierre del video con la visualización de gráficos interactivos de *Chart.js* [6] y la descarga de los informes consolidados en formatos **Excel (.xlsx)**, **Word (.docx)** y **Texto Plano (.txt)** [3].

El guion ya está listo para ser revisado y exportado directamente desde el panel de Studio para su uso en la producción del material audiovisual.

---

🎧 Si lo deseas, puedo generar un **Audio Overview** (formato podcast breve) que actúe como un resumen dinámico y hablado de este guion para que puedas escuchar cómo suena el flujo narrativo antes de grabarlo. ¿Te gustaría que lo configure?