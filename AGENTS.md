# Reglas del proyecto

## Idioma
- Pensar y comunicarse SIEMPRE en español (salvo que el usuario pida lo contrario).
- Nombres de variables, funciones y mensajes internos de código pueden quedar en inglés o español según la convención existente, pero toda comunicación con el usuario, comentarios y resúmenes deben ser en español.
También los nombres de variables y funciones deberían estar en español para mantener la coherencia del proyecto.

## Planes y recuperación ante cortes de energía
- **OBLIGATORIO ANTES DE EMPEZAR CUALQUIER TAREA:** crear el plan en `Docs/planes/<descripcion>.md` **antes** de escribir código, para que el usuario pueda leerlo directamente y guiar el trabajo. El entorno se suele quedar colgado y hay que reiniciarlo, por lo que sin este archivo se pierde el hilo del trabajo.
- El plan debe listar los pasos concretos (archivos a tocar, endpoints, verificaciones) y el estado de cada uno (pendiente / en curso / hecho).
- Actualizar el archivo a medida que el plan avanza, reflejando progreso y cambios (marcar `✅` lo terminado y `⏸️` lo pausado).
- **Al terminar o cancelar la tarea, BORRAR el archivo de plan** para no dejar pendientes colgando.
- Al iniciar cada sesión, **primero** revisar si hay archivos de plan en `Docs/planes/` para retomar el trabajo anterior tras un corte de energía antes de hacer otra cosa.

## Versionado
- Ante cualquier modificación de código funcional (nueva feature, bugfix de comportamiento o cambio de seguridad), **incrementar la versión en `package.json`** siguiendo SemVer (`mayor.minor.parche`):
  - `parche`: correcciones menores sin cambio de comportamiento observable.
  - `minor`: nuevas funcionalidades compatibles (p. ej. reloj de tardanza, llegada tarde).
  - `mayor`: cambios incompatibles o ruptura de comportamiento.
- Reflejar la versión en el mensaje de commit (ej. `v2.14.0`) y en la documentación (`Docs/SETUP_GUIDE.md` y `README.md`).
- La versión vive solo en `package.json`; no duplicarla en el código salvo documentación. Verificar consistencia antes de commitear.
