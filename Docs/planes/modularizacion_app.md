# Plan: Modularizar la aplicación AulaInicial

**Estado:** 🟡 Backend modularizado y verificado ✅ · Frontend pendiente ⏸️.

## Decisiones tomadas
- **Alcance:** Backend **+** Frontend.
- **Frontend:** Módulos ES (`type="module"`, `import`/`export`).
- **Backend:** módulos CommonJS (`require`) para no romper `pkg`.
- **Frontend serving:** mover todo el frontend a carpeta **`public/`** y servirla con `express.static` restringido (mejor seguridad y soporte de módulos ES).
- **Versión final:** **4.0.0** (reestructuración mayor; comportamiento idéntico).

## Estructura objetivo
```
server.js                 # Entry mínimo: express, middleware, montar routers, arranque + CLI
src/
  config/env.js           # PORT, ALLOWED_ORIGINS, HMAC_SECRET (loadOrCreateHmacSecret), getLocalIPs
  config/paths.js         # ROOT_DIR, CURSOS_DIR, REGISTROS_DIR, FOTOS_DIR, CONFIG_PATH, PUBLIC dir
  config/formConfig.js    # defaultConfig, load/saveFormConfig, rutas /api/form-config
  core/state.js           # estado compartido mutable: activeCourse, formConfig, registeredIPs, serverInfo, sessions
  core/tokens.js          # generateStudentToken / verifyStudentToken (HMAC)
  core/auth.js            # ADMIN_PASS carga, login/logout/check/info/change-password, requireAdmin
  data/xlsx.js            # loadWorkbook, writeWorkbookSafely, withCourseLock, consolidarPresentismo, helpers Excel
  data/courses.js         # /api/cursos, /api/active-course
  data/students.js        # alumnos CRUD, grupos, restaurar, reconciliar ausentes
  features/registration.js# registro, auto-presente, mi-perfil, mi-presente/remarcar, check-registration, borrar-foto
  features/attendance.js  # asistencia tomar/cfg/tomar-lista/borrar-dia/consultar, fechas-disponibles, stats, ausencias
  features/export.js      # export excel/word/texto
  routes.js               # agrupa y monta los routers en /api
public/
  index.html  admin.html  style.css
  student/ (formRender.js, autoPresente.js, profile.js)   # antes index.js
  admin/   (auth.js, students.js, attendance.js, formConfig.js, export.js, uiHelpers.js)  # antes admin.js
```

## Estrategia (sin romper comportamiento)
Cada paso se verifica con `npm run lint` + `npm test` (y al final `npm run build` + prueba manual).

### Backend ✅ COMPLETO Y VERIFICADO
1. ✅ `src/config/env.js`, `src/config/paths.js`.
2. ✅ `src/core/state.js`, `src/core/tokens.js`, `src/core/auth.js` (con `isAdminAuthenticated` export).
3. ✅ `src/data/xlsx.js` (helpers Excel, foto, consolidar).
4. ✅ `src/data/courses.js`, `src/data/students.js` (incluye `/api/alumnos` y `/api/update-alumno-grupo`).
5. ✅ `src/features/registration.js`, `attendance.js`, `export.js`, `src/config/formConfig.js` (con `loadFormConfig`).
6. ✅ `src/utils/validation.js` (rate-limit, validación foto, normalizeClientIP, isFullyRegistered), `src/features/late.js` (cfg tardanza, todaySheetName, normalizeSheetDate).
7. ✅ `src/routes.js` monta todo; `server.js` es entry mínimo (arranque, `open`, QR, static).
8. ✅ `server.js` arranca y sirve (verificado en puerto 3999): `/api/admin/check`, `/api/cursos`, `/api/active-course`, `/api/alumnos` (53 alumnos), `/api/fechas-disponibles`, `/api/grupos`, `/api/asistencia/consultar`, `/api/form-config`, `/` OK.
9. ⚠️ `server.js` mantiene fallback `express.static(ROOT_DIR)` hasta mover el frontend a `public/`.
10. 🔜 `package.json` → 4.0.0 al finalizar TODO (incluido frontend).

### Frontend (ES modules)
8. Crear `public/`, mover HTML/CSS.
9. `index.js` → `public/student/{formRender,autoPresente,profile}.js` (un `main.js` importa y arranca).
10. `admin.js` → `public/admin/{auth,students,attendance,formConfig,export,uiHelpers}.js` + `main.js`.
11. HTML: `<script type="module" src="...main.js">`; exponer en `window` las funciones usadas en `onclick` inline.

## Verificación global
- `npm run lint` y `npm test` en verde tras cada módulo.
- `npm run build` (pkg) genera ejecutables y el server arranca/funciona igual.
- Prueba manual: registro → presente → asistencia tomar → llegada tarde → export.

## Versionado
- Al terminar: `package.json` → 4.0.0; reflejar en commit, `README.md`, `Docs/SETUP_GUIDE.md`.
