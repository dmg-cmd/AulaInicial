# 🏫 AulaInicial

Plataforma **portátil, autónoma y de cero configuración** para gestionar asistencia, registros iniciales de alumnos e identificación visual en aulas presenciales o virtuales. Pensada para correr desde una memoria USB en la PC del aula, sin instalar nada en los equipos de los estudiantes.

> Los alumnos se registran escaneando un código QR con su celular; el docente toma lista y controla asistencia desde un panel web. Incluye reloj de tardanza en vivo y registro de llegadas tarde.

---

## ✨ Características

- **Registro desde el celular vía QR**, con foto de rostro para identificación visual.
- **Pase de lista** (Presente / Tarde / Ausente) con **lista en vivo** de presentes.
- **⏰ Reloj de tardanza en vivo** y detección automática de llegadas tarde (manual, por horario de clase o minutos tras tomar lista).
- **Llegada tarde desde el celular**: el alumno se marca "Llegué tarde" y queda registrado con su hora de llegada.
- **Panel docente** con fotos, búsqueda y gestión de alumnos.
- **Exportación** a Excel / Word / texto.
- **Autenticación del docente** y protección de datos (CORS restrictivo, validación y sanitización de entradas para prevenir XSS).
- **Ejecutable portátil** desde USB (Windows/Linux) sin necesidad de instalar Node.js.

---

## 🚀 Inicio rápido (desde USB)

1. Copiar toda la carpeta `AulaInicial` a la memoria USB (sin subcarpetas).
2. Ejecutar `start.sh` (Linux/Mac) o `start.bat` (Windows) desde el USB.
3. Abrir en el celular `http://<IP_DEL_AULA>:3000` para registrarse, y en el docente `http://<IP_DEL_AULA>:3000/admin.html`.
   - La IP se muestra en pantalla al iniciar el sistema.

⚠️ Siempre inicie el sistema desde la memoria USB, **nunca** desde el disco duro del aula.

---

## 🛠️ Ejecutar desde el código fuente

Requiere **Node.js 22**.

```bash
git clone https://github.com/<usuario>/AulaInicial.git
cd AulaInicial
npm install
npm start            # arranca server.js en el puerto 3000 (PUERTO configurable con env PORT)
```

Scripts disponibles:

| Script | Descripción |
|--------|-------------|
| `npm start` | Inicia el servidor en el puerto 3000. |
| `npm run lint` | Valida la sintaxis de `server.js`, `index.js` y `admin.js`. |
| `npm test` | Smoke test de endpoints críticos (no toca datos reales). |
| `npm run build` | Genera los ejecutables portátiles en `bin/` (requiere `pkg`). |

Para regenerar los binarios del USB:

```bash
npm run build:win      # bin/AulaInicial.exe  (node22-win-x64)
npm run build:linux    # bin/AulaInicial-linux (node22-linux-x64)
```

---

## 🔐 Seguridad

- La contraseña del panel docente se define en **`.adminpass`** (no se commitea; está en `.gitignore`). Quien prepara el USB la indica.
- CORS restrictivo y validación/sanitización de entradas para prevenir XSS.
- **No edite los `.xlsx`** de `cursos/` y `registros/` mientras corre el sistema (evita bloqueos `EBUSY`).
- Las planillas de alumnos (`cursos/*.xlsx`, `registros/*.xlsx`) y las fotos son datos sensibles e están ignoradas por git.

---

## 📁 Estructura del proyecto

| Ruta | Descripción |
|------|-------------|
| `server.js` | API Express y lógica de asistencia/registro. |
| `index.html` / `index.js` | Portal del alumno (registro y presente). |
| `admin.html` / `admin.js` | Panel del docente (lista, QR, tardanza, export). |
| `style.css` | Estilos (incluye clases de migración de estilos inline). |
| `form-config.json` | Configuración de campos del formulario. |
| `cursos/`, `registros/` | Planillas Excel por curso (datos sensibles, ignoradas). |
| `bin/` | Ejecutables portátiles generados. |
| `Docs/` | Guías de configuración y planes de trabajo. |

---

## 📄 Documentación

- Guía de configuración paso a paso para el docente: [`Docs/SETUP_GUIDE.md`](Docs/SETUP_GUIDE.md).

---

## 📌 Notas de versión

La versión vive en [`package.json`](package.json) y sigue SemVer. Ver historial de commits para los cambios por versión (p. ej. `v4.0.0`).

### Descarga de los ejecutables (docentes)
El código fuente se versiona en este repositorio; los binarios compilados (`AulaInicial.exe` para Windows y `AulaInicial-linux` para Linux) **no se guardan en el repo** (superan el límite de 100 MB de GitHub). Se generan automáticamente con `npm run build` y se publican en **[Releases](https://github.com/dmg-cmd/AulaInicial/releases)** en cada etiqueta `v*`. El docente solo descarga el ejecutable correspondiente y lo corre (no necesita Node ni npm).

---

## 📜 Licencia

Proyecto de uso educativo. Consultar al autor antes de redistribuir.
