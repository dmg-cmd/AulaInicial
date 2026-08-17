# Plan: Auto-instalación del binario desde Releases en el arranque

**Estado:** 🟡 En curso.

## Objetivo
Que los docentes puedan ejecutar `start.sh`/`start.bat` sin descargar manualmente el binario de Releases ni tener Node: el script auto-descarga el binario de `latest` la primera vez, con un aviso claro en español.

## Decisiones
- Método: descargar binario precompilado de GitHub Releases (`latest`).
- Sin Node requerido (el binario ya trae Node embebido vía pkg).
- Aviso visible en español; descarga automática (sin pedir confirmación).
- Fallback amigable si no hay internet.

## Pasos
1. ✅ Crear este plan.
2. ✅ Reescribir `start.sh`: binario → Node → auto-descargar `AulaInicial-linux` (Linux) / aviso Mac → fallback.
3. ✅ Reescribir `start.bat`: binario → Node → auto-descargar `AulaInicial.exe` vía PowerShell.
4. ✅ Validar `bash -n start.sh` y revisar `start.bat`.
5. ✅ `package.json` → 4.1.0; reflejar en `README.md` y `Docs/SETUP_GUIDE.md`.
6. ⏳ Commit local.
7. ⏳ Push a `origin/main` (requiere nuevo token PAT con alcance `repo`).
8. ✅ Borrar este plan al terminar.

## Notas
- `bin/` en `.gitignore` → el binario descargado no se commitea.
- Asset names: `AulaInicial-linux`, `AulaInicial.exe`.
- Mac (`Darwin`): no hay binario Mac; si falta Node se avisa a instalarlo.
