# 🖥️ Guía de Configuración Rápida - AulaInicial

## Resumen Ejecutivo

**AulaInicial** es una plataforma portátil, autónoma y de cero configuración para gestionar asistencia, registros iniciales y identificación visual de alumnos en aulas presenciales o virtuales.

Esta guía paso a paso muestra cómo iniciar el sistema desde USB y comenzar a administrar un curso de manera efectiva.

---

## 🏃‍♂️ Paso 1: Preparación del USB

### Materiales necesarios:
- Una memoria USB con al menos 2 GB de espacio libre
- La carpeta **AulaInicial** (descargada desde el repositorio de GitHub)
- El ejecutable **AulaInicial-linux** (Linux) o **AulaInicial.exe** (Windows), descargado desde **GitHub Releases** (etiqueta `v4.0.0`); desde la v4.0.0 los binarios ya no se incluyen en el repositorio

### Instrucciones:

#### Para Linux o Mac:
1. **Conectar el USB** al dispositivo (PC del aula)
2. **Extraer** todo el contenido de la carpeta AulaInicial en el USB (no en subcarpetas)
3. **Ejecutar** el script: `./start.sh` desde el USB

#### Para Windows:
1. **Conectar el USB** al dispositivo (PC del aula)
2. **Extraer** todo el contenido de la carpeta AulaInicial en el USB (no en subcarpetas)
3. **Ejecutar** el script: `start.bat` desde el USB

⚠️ **Importante**: **Siempre** debe iniciar el sistema desde la memoria USB, **nunca** desde el disco duro del aula.

---

## 📝 Paso 2: Primeros pasos tras el inicio del sistema

### 2.1 Ingreso al panel docente

1. **Abrir el navegador** en cualquier dispositivo (computadora, laptop, tablet)
2. **Conectar a la misma red Wi-Fi/LAN** que tiene el AulaInicial iniciada
3. **Abrir**: `http://<IP_DEL_AULA_INICIAL>:3000/admin.html`

   - La IP se muestra en pantalla en el módulo **"Lista y QR"** del panel
   - Ejemplo: `http://192.168.1.100:3000/admin.html`

4. **Ingresar la contraseña** del panel docente (definida en el archivo `.adminpass` del USB; quien prepara el sistema la indica)
5. **Si la contraseña es la predeterminada**, el sistema le pedirá cambiarla en el primer ingreso

### 2.2 Cambiar contraseña (si es necesario)

- En la pantalla de login, si aparece el banner "Debe cambiar la contraseña por defecto", complete ambos campos con la nueva contraseña deseada.

---

## 📚 Paso 3: Seleccionar un curso

### 3.1 En el panel del docente:

1. **Hacer clic** en el selector de curso (ubicado en la esquina superior derecha)
2. **Seleccionar** un curso de la lista desplegable

   - Si no hay cursos disponibles, debe haber una plantilla .xlsx en la carpeta `cursos/` del USB

### 3.2 Seleccionar curso predeterminado:

Si hay al menos un archivo .xlsx en `cursos/`, el sistema seleccionará automáticamente uno (el más reciente)

---

## 👥 Paso 4: Primeras tareas tras seleccionar un curso

### 4.1 Ver la lista de alumnos (si hay asistencias registradas)

1. **Hacer clic** en el botón **"Manejo de Alumnos"** (primera pestaña)
2. **Ver** las tarjetas con fotos y estado de asistencia

   - Los alumnos con el borde verde neón están **PRESENTES** de la clase anterior
   - Los alumnos sin foto muestran las iniciales (si no hay foto, o escala de grises)

### 4.2 Abrir formulario para agregar un alumno manualmente

Si algún alumno no aparece en la lista (por ejemplo, fue re-agregado sin completar los datos), puede agregarlo manualmente:

1. **Hacer clic** en **"Abrir Formulario"** (desplegable)
2. **Completar** los campos obligatorios
3. **Opcionalmente** marcar **"Marcar PRESENTE inmediatamente para hoy"
4. **Hacer clic** en **"Guardar Alumno en Excel"**

---

## 📱 Paso 5: Configurar campos del formulario (opcional)

### 5.1 Ingresar al módulo "Formularios"

- **Hacer clic** en la pestaña **"⚙️ Formularios"**

### 5.2 Ocultar campos no deseados:

- **Toggle** los campos que desea ocultar (Email, DNI, Título, Grupo, Teléfono, Foto de Rostro)
- **Solo para cursos de menores**, puede desactivar completamente el campo **Foto de Rostro**
- **Guardar** los cambios con el botón **"Guardar Configuración"**

---

## 📲 Paso 6: Generar código QR para que los alumnos se registren

### 6.1 Ingresar al módulo "Lista y QR"

- **Hacer clic** en la pestaña **"📲 Lista y QR"**

### 6.2 Obtener el código QR

1. **Scannear el código QR** con un teléfono (o abrir `http://<IP>:3000` en el móvil)
2. **Verificar** que los alumnos pueden escanearlo exitosamente
3. **Copiar** el QR grande para proyectar en pantalla

### 6.3 Pasos para los alumnos:

1. Escanear el código QR con su móvil → aparecerá la pantalla de registro
2. Completar sus datos (el docente debe haber configurado los campos obligatorios)
3. Tomar su foto real (si está habilitada)
4. Enviar el formulario → su PRESENTE queda registrado **automáticamente**

---

## ⏰ Reloj de tardanza y llegada tarde

El módulo **"📲 Lista y QR"** ahora incluye un **reloj en vivo** y control de llegadas tarde:

### Reloj y detección de tardanza (panel docente)
- En la parte superior del módulo hay un **reloj en vivo** (`🕒 HH:MM:SS`) que muestra la hora actual y el **límite de tardanza** configurado.
- Configurar la tardanza con el botón **"💾 Guardar configuración"** (se guarda por curso en el Excel):
  - **Manual**: sin detección automática.
  - **Horario fijo de clase**: hora de inicio + margen de gracia (min).
  - **Minutos tras tomar lista**: el límite se calcula N minutos después de pulsar **"📋 Tomar lista"**.
- El botón **"📋 Tomar lista"** registra la hora en que se tomó lista y habilita la detección de tarde.

### Llegada tarde del alumno (desde el celular)
- Si un alumno llega después de que se tomó lista, desde su celular (pantalla de registro) puede pulsar **"📝 DAR MI PRESENTE (LLEGUÉ TARDE)"**.
- El sistema registra su **hora de llegada** y lo cuenta como **PRESENTE** (estado `PRESENTE TARDÍO`).
- En el panel docente, la lista en vivo muestra esos alumnos marcados como **🟠 LLEGÓ TARDE** con su hora.

---

## 📊 Paso 7: Tomar asistencia de la clase

### 7.1 Ingresar al módulo "Lista y QR"

- **Hacer clic** en la pestaña **"📲 Lista y QR"**

### 7.2 Establecer la fecha de la clase

1. **Hacer clic** en el campo de fecha (formato dd-mm-yyyy)
2. **Seleccionar** la fecha actual o la de la clase anterior

### 7.3 Marcar la asistencia

1. **Iterar** por cada tarjeta de alumno
2. **Hacer clic** en **"Presente", "Tarde" o "Ausente"
3. **Opcionalmente**, hacer clic en **"🗑️ Foto"** para eliminar fotos inválidas

### 7.4 Guardar la asistencia

- **Hacer clic** en **"💾 Guardar Asistencia de Hoy"**
- El sistema espera 3 segundos antes de confirmar el guardado

---

## 🧹 Paso 8: Limpiar casillas tras la clase

### 8.1 Limpiar asistencias

- **Hacer clic** en el botón **"🧹 Desmarcar Todas las Tildes"**
- Esto desmarca todas las casillas **sin borrar** los datos de alumnos

### 8.2 Hacer una breve pausa

- Es recomendable **no abrir** los archivos .xlsx de `registros/` en Microsoft Excel mientras corre el sistema (previene conflictos EBUSY)

---

## 📥 Paso 9: Exportar reportes (opcional)

### 9.1 Ingresar al módulo "Exportar"

- **Hacer clic** en la pestaña **"📥 Exportar"**

### 9.2 Elegir el formato:

- **Excel (.xlsx)**: reporte completo con todas las pestañas
- **Word (.docx)**: formato profesional para impresión
- **Texto (.txt)**: lista simple de nombres por grupo

### 9.3 Descargar:

- **Hacer clic** en el botón **"Descargar"** correspondiente

---

## 📋 Paso 10: Respaldo de la información

### 10.1 Copiar la carpeta `registros/`

- **Al finalizar la jornada** o tras cualquier modificación importante
- **Copiar** toda la carpeta `registros/` a otra ubicación (USB externo, disco duro, nube)

### 10.2 Verificar integridad:

- Abrir `registros/Titulodelcurso.xlsx` en Excel → verificar que todas las pestañas existan
- Verificar que las fotos estén actualizadas (si están habilitadas)

---

## 🚨 Errores comunes y soluciones

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| No se muestra el código QR | Falta la IP o el curso no está seleccionado | Verificar curso activo y estar en red local |
| Los alumnos no pueden registrarse | Error de CORS o firewall bloquea conexión | Desactivar firewall local o usar VPN en dispositivos |
| Mensaje "Archivo Excel bloqueado" | El archivo .xlsx está abierto en Excel/WPS | **Cerrar** todos los programas de oficina que usen estos archivos |
| La foto del alumno no aparece | Campo de foto desactivado o foto inválida | Habilitar campo de foto en configuración |

---

## 📞 Ayuda y soporte

Si encuentra algún problema:

1. **Verificar** la IP de la red local en la pantalla
2. **Recargar** la página con Ctrl+F5
3. **Cerrar** el navegador y volver a ingresar
4. **Revisar** la contraseña del panel del docente
5. **Si persiste**, reiniciar el sistema (conectar USB, reiniciar PC del aula, ejecutar `start.sh`)

---

## 🖨️ Versión imprimible

Este documento se puede guardar como PDF y imprimir para consulta rápida del docente.

```markdown
# AulaInicial - Guía Rápida
## Página 1
## Página 2
```

---

**Versión:** 4.0.0
**Fecha:** 17 de agosto de 2026
**Contacto:** docente@aulainicial.org

---

### Nota final:

Esta guía asume que los **ejecutables** ya están presentes en el USB. Si no, no hay una instalación portátil de Node.js disponible.

Además, **todas las acciones** en el panel del docente se graban automáticamente en archivos .xlsx; nunca es necesario realizar copias de seguridad manuales de los archivos.

¡Feliz clase!