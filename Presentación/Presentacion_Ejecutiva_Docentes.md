### Diapositiva 1: AulaInicial: Gestión y Organización Portátil del Aula [1]

*   **Título de la Diapositiva:** **AulaInicial: Control y Organización Autónoma en el Aula** [1]
*   **Elementos Visuales a Mostrar:** 
    *   Una ilustración conceptual que muestre un aula de clases donde los alumnos interactúan con sus teléfonos móviles conectados a una laptop central. 
    *   Logotipo de AulaInicial resaltando conceptos clave: *Portabilidad, Autonomía y Cero Configuración (Zero-Config)* [1].
*   **Viñetas Ejecutivas:**
    *   **Plataforma portátil y autónoma** para la gestión de asistencia, recopilación de datos y organización de grupos [1].
    *   Diseñada tanto para **aulas presenciales como virtuales** [1].
    *   **Cero configuración (*Zero-Config*)**: Lista para usarse sin despliegues complejos [1].
*   **Guion del Orador:** 
    > *"Estimados colegas y autoridades, hoy queremos presentarles AulaInicial, una solución diseñada para simplificar uno de los procesos diarios que más tiempo consume en el aula: el registro de asistencia y la organización de los alumnos [1]. Su filosofía se basa en dar autonomía total al docente, eliminando las barreras tecnológicas habituales y permitiendo un control en tiempo real, de manera sumamente sencilla y sin configuraciones previas [1, 2]."*

---

### Diapositiva 2: Máxima Portabilidad y Persistencia en Excel [1, 3]

*   **Título de la Diapositiva:** **Filosofía Portátil: Ejecución Directa y Sencilla** [1, 3]
*   **Elementos Visuales a Mostrar:** 
    *   Un gráfico simple que muestre una unidad USB (pendrive) conectándose a una computadora de escritorio y abriendo de forma transparente un archivo de Microsoft Excel ubicado en la carpeta `registros/` [1].
*   **Viñetas Ejecutivas:**
    *   **Ejecución directa desde USB/Pendrive**: No requiere instalación en el sistema operativo [1].
    *   **Compatibilidad multiplataforma**: Funciona con un doble clic en entornos Windows y Linux [1, 3].
    *   **Persistencia en tiempo real**: Toda la información se guarda automáticamente en archivos de Microsoft Excel **(.xlsx)** [1].
    *   **Sin bases de datos complejas**: No requiere servidores externos ni configuraciones SQL/NoSQL [1, 3].
*   **Guion del Orador:** 
    > *"Una de las mayores ventajas de AulaInicial es su portabilidad extrema [1]. El docente solo necesita llevar la aplicación en un pendrive, conectarlo en cualquier computadora con Windows o Linux, y ejecutarlo con un doble clic [1, 3]. No requiere instalar nada ni lidiar con complejos servidores de bases de datos, ya que toda la información se guarda y sincroniza en tiempo real en una hoja de Excel tradicional dentro de la carpeta de registros del sistema [1]."*

---

### Diapositiva 3: Conectividad Inteligente e Independencia de Internet [3, 4]

*   **Título de la Diapositiva:** **Conectividad Local Sin Dependencia de Internet** [3, 4]
*   **Elementos Visuales a Mostrar:** 
    *   Captura de pantalla de la interfaz real: `proyeccion_codigo_qr.png` proyectada en pantalla grande [5].
    *   Un esquema de red local (Wi-Fi institucional o hotspot móvil del docente) que conecta los dispositivos sin salir a la nube [4].
*   **Viñetas Ejecutivas:**
    *   **Operación 100% local**: Funciona de manera independiente, sin conexión obligatoria a Internet [1].
    *   **Detección automática de IP**: El servidor Node.js/Express identifica la red local y genera los accesos [3].
    *   **Código QR proyectable**: Los estudiantes escanean el QR de alta resolución proyectado para ingresar [6, 7].
    *   **Flexibilidad de red**: Solo requiere que los dispositivos estén en la misma red Wi-Fi o punto de acceso [4].
*   **Guion del Orador:** 
    > *"Sabemos que la conectividad a Internet en las escuelas puede ser inestable o inexistente. AulaInicial resuelve esto operando de manera 100% desconectada [1, 4]. Al iniciarse, la plataforma detecta automáticamente la IP de la red local (ya sea el Wi-Fi de la escuela o un punto de acceso generado desde el celular del docente) y crea un código QR en alta resolución [3, 4, 6]. Los estudiantes simplemente escanean este código para acceder al instante, sin consumir datos móviles ni requerir internet [4, 7]."*

---

### Diapositiva 4: El Panel de Control del Docente [2]

*   **Título de la Diapositiva:** **Panel de Control: Monitoreo Activo en Tiempo Real** [2]
*   **Elementos Visuales a Mostrar:** 
    *   Captura de pantalla de la interfaz real: `vista_docente_panel.png`, destacando las tarjetas de colores en modo oscuro [5].
*   **Viñetas Ejecutivas:**
    *   **Interfaz moderna**: Diseño basado en Glassmorphism y modo oscuro [2].
    *   **Monitoreo de asistencia en vivo**: Tarjetas dinámicas de estados de alumnos [2]:
        *   🟢 **Presente**: Alumno que ya envió su registro de la jornada [2].
        *   🔴 **Ausente**: Alumno en nómina que no ha registrado su asistencia [2].
        *   ⚪ **Pendiente**: Alumno que aún no completa su formulario [2].
    *   **Edición ágil**: Herramientas para agregar o editar alumnos de forma manual [2].
*   **Guion del Orador:** 
    > *"El docente gestiona su clase desde un Panel de Control moderno y de diseño intuitivo [2]. A medida que los estudiantes envían sus respuestas, el panel se actualiza en tiempo real mostrando tarjetas dinámicas de colores para identificar visualmente quién ya está Presente (verde), quién sigue Pendiente (blanco) o quién ha quedado Ausente en la jornada (rojo) [2]. Además, el docente puede dar de alta o corregir datos de los alumnos manualmente desde el panel sin necesidad de abrir la planilla de Excel [2]."*

---

### Diapositiva 5: Formularios Adaptables y Reutilización Ágil [4, 8]

*   **Título de la Diapositiva:** **Formularios Dinámicos y Limpieza en un Solo Clic** [8]
*   **Elementos Visuales a Mostrar:** 
    *   Captura de pantalla de la interfaz real: `gestion_formularios_desplegables.png`, señalando con un recuadro el botón de limpieza rápida y las opciones de campos [5].
*   **Viñetas Ejecutivas:**
    *   **Campos parametrizables**: Datos Personales (DNI, nivel tecnológico, especialidad) y Datos de Clase (preguntas del día) [8].
    *   **Editor dinámico de desplegables**: Panel interactivo modal para modificar opciones en vivo [8].
    *   **Botón "Desmarcar Todas las Tildes"**: Limpieza rápida de registros para la siguiente clase [4, 8].
    *   **Sincronización segura**: Guarda cambios de forma automática sin borrar la estructura del formulario [4, 8].
*   **Guion del Orador:** 
    > *"La plataforma permite adaptar el formulario según las necesidades pedagógicas de cada sesión, categorizando campos entre datos personales y consultas específicas de la clase [8]. El docente cuenta con un editor interactivo para configurar opciones desplegables en tiempo real [8]. Al terminar la jornada, gracias al botón 'Desmarcar Todas las Tildes', el docente puede limpiar el estado de selección de los campos con un solo clic, dejándolos listos para la siguiente clase sin alterar las configuraciones previas [4, 8]."*

---

### Diapositiva 6: La Experiencia Sin Fricciones del Alumno [7]

*   **Título de la Diapositiva:** **Acceso Simple, Rápido y Seguro para el Estudiante** [7]
*   **Elementos Visuales a Mostrar:** 
    *   Captura de pantalla de la interfaz real: `vista_alumno_formulario.png`, mostrando el selector de autocompletado y el botón verde destacado [5].
*   **Viñetas Ejecutivas:**
    *   **Sin barreras de acceso**: No requiere descargar aplicaciones, crear cuentas ni usar contraseñas [7].
    *   **Buscador predictivo**: El alumno escribe las primeras letras de su nombre para autocompletar su identificación [7].
    *   **Validación de seguridad**: Botón verde destacado **"✅ DAR MI PRESENTE Y ENVIAR"** [7].
    *   **Prevención de duplicados**: Control de dispositivo por IP para evitar reenvíos múltiples [7].
*   **Guion del Orador:** 
    > *"Para el alumno, la experiencia está libre de complicaciones [7]. No tienen que recordar contraseñas ni descargar aplicaciones pesadas [7]. Simplemente escanean el QR, escriben las primeras letras de su nombre en el buscador inteligente para autocompletar sus datos, responden a las preguntas del día y presionan el botón destacado para enviar su presente [7]. Para garantizar la honestidad académica, el sistema bloquea de manera automática reenvíos múltiples desde un mismo dispositivo [7]."*

---

### Diapositiva 7: Estadísticas, Grupos e Informes Consolidados [6, 7]

*   **Título de la Diapositiva:** **Análisis de Datos y Reportes Ejecutivos** [6, 7]
*   **Elementos Visuales a Mostrar:** 
    *   Captura de pantalla de la interfaz real: `estadisticas_graficos.png`, mostrando las gráficas de distribución de especialidades y nivel tecnológico [5].
    *   Iconos de los formatos de descarga de informes (Excel, Word, Texto Plano) [7].
*   **Viñetas Ejecutivas:**
    *   **Gráficos interactivos**: Visualizaciones integradas (Chart.js) de especialidad y nivel tecnológico de los alumnos [6].
    *   **Gestor de grupos de trabajo**: Módulo interactivo con normalización inteligente de nombres [6].
    *   **Descarga de reportes consolidados**: Exportación directa de la información en tres formatos clave [7]:
        *   📊 **Excel (.xlsx)**: Planilla estructurada para el análisis detallado [7].
        *   📄 **Word (.docx)**: Informe ejecutivo con formato listo para entregar [7].
        *   📝 **Texto Plano (.txt)**: Resumen rápido y de fácil acceso [7].
*   **Guion del Orador:** 
    > *"Finalmente, AulaInicial convierte los datos del día en información valiosa [6, 7]. Ofrece gráficos interactivos inmediatos sobre el perfil tecnológico y las especialidades del grupo, además de un gestor inteligente para armar equipos de trabajo [6]. Para cumplir con las responsabilidades administrativas, el docente puede exportar con un solo clic reportes detallados en Excel, informes institucionales formateados en Word o resúmenes rápidos en texto plano [7]. Todo esto convierte a AulaInicial en el aliado perfecto para optimizar el tiempo docente y potenciar la gestión escolar [1, 7]."*

---

📊 ¿Te gustaría que preparemos un informe ejecutivo formal en formato de documento para que puedas entregarlo a las autoridades educativas como material complementario a esta presentación?