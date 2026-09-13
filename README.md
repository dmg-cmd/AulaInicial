# 🏫 AulaInicial

Plataforma **portátil, autónoma y de cero configuración** para gestionar asistencia, registros iniciales de alumnos, verificación interactiva de datos e identificación visual en aulas presenciales o virtuales. Diseñada para funcionar directamente desde una memoria USB en la PC del aula, sin requerir instalación de software en los dispositivos de los estudiantes ni en el equipo docente.

![Versión](https://img.shields.io/badge/versi%C3%B3n-4.4.0-6366f1.svg)
![Node](https://img.shields.io/badge/node->=22.0.0-green.svg)
![Licencia](https://img.shields.io/badge/licencia-Educativa-blue.svg)

> Los estudiantes acceden escaneando un código QR proyectado en el aula; completan o verifican sus datos desde su celular y dan el presente diario. El docente administra las clases, toma asistencia, proyecta el QR y supervisa las planillas desde un panel de control web.

---

## ✨ Características Principales

### 📱 Experiencia del Alumno (Móvil / Web)
- **Registro y Presente vía QR:** Acceso instantáneo mediante escaneo de código QR sin instalar aplicaciones.
- **Ficha Dinámica y Verificación Reactiva (v4.3.0):** Los estudiantes pueden consultar y actualizar sus datos en tiempo real sin pantallas de bloqueo ciego.
- **Badges de Verificación por Campo:**
  - `✓ Guardado`: Indica datos preexistentes en la planilla Excel listos para verificar.
  - `⭐ Nuevo`: Destaca campos vacíos o nuevas preguntas asignadas por el docente para la clase.
- **Buscador Inteligente de Alumnos (v4.3.1):** Desplegable flotante optimizado con ventana amplia (hasta 8 alumnos visibles simultáneamente) con jerarquía visual sin solapamientos.
- **Bloqueo Estricto de Doble Presente Diario (v4.3.0):** Si el alumno ya dio el presente en el día, el sistema preserva su asistencia y hora original inalteradas, permitiéndole únicamente modificar sus datos complementarios.
- **Identificación con Foto Real:** Captura o subida de foto de rostro desde el dispositivo para identificación en clase.
- **Auto-presente y Llegadas Tarde:** Detección de dispositivos vinculados y botón de presente tardío si el alumno llega después del pase de lista.

### 👨‍🏫 Panel de Control Docente
- **Gestión Visual de Nómina (v4.2.0):** Visualización en formato cuadrícula (*grid*) con fotos reales o formato tabla tradicional, nombres completos sin recortes y buscador en vivo.
- **Pase de Asistencia Rápido:** Estados unificados: *Presente*, *Tarde* y *Ausente*, con resumen cuantitativo y cálculo de porcentajes.
- **⏰ Reloj de Tardanza en Vivo:** Control de tiempo transcurrido desde el inicio de la clase con alertas automáticas.
- **Proyección de Código QR:** Generación de código QR con resolución nítida y detección automática de la IP física de la red Wi-Fi/LAN del aula.
- **Formularios Configurables:** Posibilidad de activar, desactivar o agregar campos personalizados (consignas, preguntas de clase, encuestas) desde `form-config.json`.
- **Exportación de Informes:** Exportación de registros y asistencia a Excel (.xlsx) y texto estructurado.

---

## 🚀 Inicio Rápido

### Opción 1: Ejecución Portátil desde USB (Recomendada para Docentes)
1. Copiar la carpeta del proyecto a una memoria USB.
2. Hacer doble clic en **`start.bat`** (Windows) o ejecutar **`./start.sh`** (Linux/Mac).
3. El script iniciará el servidor local y abrirá automáticamente el **Panel Docente** en `http://localhost:3000/admin.html`.
4. Proyectar el código QR para que los estudiantes ingresen desde su celular a `http://<IP_LOCAL>:3000`.

### 🍎 Guía para Computadoras Apple (macOS)

#### 1. Macs con Apple Silicon (chips M1, M2, M3 o M4):
- **Automático:** Al ejecutar `./start.sh`, el script detecta la Mac y descarga automáticamente el ejecutable `AulaInicial-macos-arm64` desde [GitHub Releases](https://github.com/dmg-cmd/AulaInicial/releases).
- **Manual:** Descarga `AulaInicial-macos-arm64` desde Releases, colócalo dentro de `bin/` y ejecuta `./start.sh`.

#### 2. Macs con procesador Intel (modelos anteriores a 2020):
En Macs con arquitectura Intel x86_64 existen tres métodos sencillos para ejecutar AulaInicial:
- **Método A (Recomendado y nativo con Node.js):**
  Instala Node.js en la Mac desde [nodejs.org](https://nodejs.org) (descarga el instalador `.pkg` para macOS). Luego abre la terminal en la carpeta del proyecto y ejecuta:
  ```bash
  ./start.sh
  ```
  *(o directamente `node server.js`)*. Arranca de inmediato al 100% de rendimiento.
- **Método B (A través del binario para Linux con Docker o contenedor):**
  Dado que los ejecutables de Linux (`AulaInicial-linux`) requieren un entorno con kernel Linux, si dispones de **Docker Desktop**, **OrbStack** o **Lima** en tu Mac Intel, puedes ejecutar el sistema montando la carpeta con una sola línea:
  ```bash
  docker run --rm -it -v "$(pwd)":/app -w /app -p 3000:3000 node:22 node server.js
  ```
  O corriendo directamente el ejecutable Linux dentro de un contenedor:
  ```bash
  docker run --rm -it -v "$(pwd)":/app -w /app -p 3000:3000 ubuntu:22.04 ./bin/AulaInicial-linux
  ```
- **Método C (Compilar localmente tu propio binario para Intel Mac):**
  Teniendo Node instalado en tu Mac Intel, puedes generar tu ejecutable independiente corriendo:
  ```bash
  npm run build:macos-x64
  ```
  Esto creará `bin/AulaInicial-macos-x64` para usarlo directamente.

### Opción 2: Modo Desarrollo con Node.js
Requiere **Node.js >= 22.0.0**.

```bash
# 1. Clonar el repositorio
git clone https://github.com/dmg-cmd/AulaInicial.git
cd AulaInicial

# 2. Instalar dependencias
npm install

# 3. Iniciar el servidor
npm start
```

Comandos útiles:
```bash
npm run lint               # Análisis estático de sintaxis
npm test                   # Pruebas de integración de endpoints
npm run build:win          # Compila el binario bin/AulaInicial.exe (Windows)
npm run build:linux        # Compila el binario bin/AulaInicial-linux (Linux)
npm run build:macos-arm64  # Compila el binario bin/AulaInicial-macos-arm64 (Apple Silicon M1-M4)
npm run build:macos-x64    # Compila el binario bin/AulaInicial-macos-x64 (Intel Mac)
npm run build:macos        # Compila ambas arquitecturas para Mac
```

---

## 📋 Novedades Recientes

### Versión 4.4.0 (2026-09-12)
- **Compatibilidad con Computadoras Apple (macOS):** Soporte oficial para computadoras Mac con arquitecturas Apple Silicon (`arm64`, chips M1/M2/M3/M4) y procesadores Intel (`x86_64`).
- **Scripts de Compilación para macOS:** Comandos `build:macos-arm64`, `build:macos-x64` y `build:macos` integrados en el ecosistema de empaquetado.
- **Script de Inicio Universal (`start.sh`):** Detección automática de macOS (`Darwin`) y arquitectura de hardware, asignación de permisos de ejecución (`chmod +x`), arranque con Node.js y descarga autónoma del binario adecuado desde GitHub Releases.
- **Automatización en GitHub Actions:** Actualización del flujo `release.yml` incorporando runners oficiales `macos-latest` y `macos-13` para compilar y generar los binarios de Apple automáticamente al crear cada Release.

### Versión 4.3.1 (2026-09-07)
- **Corrección de Capa en Desplegable (*Stacking Context*):** Se elevó el apilamiento de la sección de búsqueda y la lista de sugerencias (`z-index: 1000`), evitando que la tarjeta inferior de grupos con `backdrop-filter` solape la lista.
- **Ampliación de Altura Visible:** Incremento del contenedor de resultados a `320px`, mostrando de 6 a 8 alumnos simultáneos de forma nítida.
- **Espaciado y Ergonomía Táctil:** Separación de `2.5rem` para el botón de consulta de grupos, evitando pulsaciones accidentales en pantallas móviles.
- **Auditoría de Seguridad DLP:** Blindaje exhaustivo de `.gitignore` para bloquear de forma universal cualquier planilla de alumnos (`*.xlsx`), fotos y builds en todas las carpetas.
- **Binario Actualizado:** Generación del nuevo ejecutable `bin/AulaInicial.exe` con los cambios de la versión 4.3.1.

### Versión 4.3.0 (2026-09-06)
- **Ficha Dinámica del Estudiante:** Se eliminó la pantalla ciega de bloqueo post-registro; el estudiante puede acceder, verificar y corregir sus datos cuando lo necesite.
- **Endpoint Seguro `/api/alumno/mi-ficha`:** Precarga instantánea de información personal desde el Excel de origen.
- **Badges Visuales de Campo:** Etiquetas dinámicas `✓ Guardado` y `⭐ Nuevo`.
- **Bloqueo Estricto de Doble Presente:** Protección contra sobrescritura de hora o estado de asistencia del día.

### Versión 4.2.0 (2026-09-06)
- **Nómina Flexible:** Modos de visualización en tabla y cuadrícula para el panel docente.
- **Buscador en Tiempo Real:** Filtrado instantáneo de alumnos en la lista del docente.
- **Insignia de Versión en UI:** Visualización permanente de la versión activa en el encabezado y pie de página.

---

## 🛡️ Privacidad y Seguridad (DLP)

- **Protección de Datos Personales:** Las planillas de alumnos (`*.xlsx`), asistencias y fotos reales están estrictamente ignoradas por Git para prevenir cualquier fuga involuntaria hacia repositorios públicos.
- **Políticas CORS y Sanitización:** CORS configurado para admitir solo orígenes autorizados, cabeceras seguras (`X-Content-Type-Options: nosniff`) y sanitización de entradas para prevenir ataques XSS.
- **Autenticación Docente:** Clave maestra protegida fuera del árbol de archivos estáticos públicos.

---

## 📄 Documentación Adicional

- [DOCUMENTACION.md](DOCUMENTACION.md): Bitácora técnica y trazabilidad de todos los planes de acción.
- [CHANGELOG.md](CHANGELOG.md): Historial de cambios siguiendo el estándar *Keep a Changelog*.
- [Docs/HISTORIAL_MEJORAS.md](Docs/HISTORIAL_MEJORAS.md): Historial consolidado de versiones y mejoras.

---

## 📜 Licencia

Proyecto de uso educativo y académico. Desarrollado por **DmG**.
