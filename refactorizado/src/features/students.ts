import type { Express, Request, Response } from 'express';
import { StudentService } from '../services/StudentService.js';
import { RegistrationService } from '../services/RegistrationService.js';
import { MENSAJES } from '../config/constants.js';
import { requireAdmin, isAdminAuthenticated } from '../core/auth.js';

export function registerStudentsRoutes(app: Express): void {
  app.post(['/api/agregar-alumno', '/api/alumnos/agregar', '/api/alumno/agregar'], requireAdmin, async (req: Request, res: Response) => {
    try {
      const { curso, nombre, apellido, dni, grupo, titulo, tecnologia, presente, fecha } = req.body;
      const result = await StudentService.agregarAlumno(curso, { nombre, apellido, dni, grupo, titulo, tecnologia }, presente, fecha);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/borrar-alumno', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { curso, nombreAlumno, definitivo } = req.body;
      if (!nombreAlumno) return res.status(400).json({ error: 'Nombre de alumno no especificado.' });
      const result = await StudentService.borrarAlumno(curso, nombreAlumno, definitivo);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/restaurar-alumno', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { curso, nombreAlumno } = req.body;
      if (!nombreAlumno) return res.status(400).json({ error: 'Nombre de alumno no especificado.' });
      const result = await StudentService.restaurarAlumno(curso, nombreAlumno);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/admin/reconciliar-ausentes', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { curso } = req.body;
      const result = await StudentService.reconciliarAusentes(curso);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/modificar-alumno', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { curso, nombreOriginal, ...cambios } = req.body;
      if (!nombreOriginal) return res.status(400).json({ error: 'Nombre original de alumno no especificado.' });
      const result = await StudentService.modificarAlumno(curso, nombreOriginal, cambios);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/alumnos', async (req: Request, res: Response) => {
    try {
      if (req.query.full === 'true' && !isAdminAuthenticated(req)) {
        return res.status(401).json({ error: MENSAJES.NO_AUTORIZADO, adminRequired: true });
      }
      const curso = req.query.curso as string;
      const full = req.query.full === 'true';
      const incluirBorrados = req.query.incluirBorrados === 'true';
      const alumnos = StudentService.obtenerAlumnos(curso, full, incluirBorrados);
      res.json(alumnos);
    } catch (error: any) {
      res.status(500).json({ error: 'Error al procesar el archivo Excel' });
    }
  });

  app.post('/api/update-alumno-grupo', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { curso, nombreAlumno, nuevoGrupo } = req.body;
      if (!nombreAlumno) return res.status(400).json({ error: 'Nombre de alumno no válido.' });
      const result = await StudentService.actualizarGrupoAlumno(curso, nombreAlumno, nuevoGrupo);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/borrar-foto-alumno', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { nombreCompleto, dni } = req.body;
      if (!nombreCompleto) return res.status(400).json({ error: 'Nombre de alumno no especificado' });
      const result = await RegistrationService.borrarFotoAlumno(nombreCompleto, dni);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
}