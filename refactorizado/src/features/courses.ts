import type { Express, Request, Response } from 'express';
import { CourseService } from '../services/CourseService.js';
import { MENSAJES } from '../config/constants.js';

export function registerCoursesRoutes(app: Express): void {
  app.get('/api/cursos', (_req: Request, res: Response) => {
    try {
      const cursos = CourseService.listarCursos();
      console.log(`📂 Cursos detectados en la carpeta: ${cursos.length} archivos`);
      res.json(cursos);
    } catch (error) {
      console.error('Error al leer cursos:', error);
      res.status(500).json({ error: 'Error al leer la carpeta de cursos' });
    }
  });

  app.get('/api/active-course', (_req: Request, res: Response) => {
    res.json({ activeCourse: CourseService.getActiveCourse() });
  });

  app.post('/api/active-course', (req: Request, res: Response) => {
    const curso = req.body.course;
    if (!curso) return res.status(400).json({ error: MENSAJES.CURSO_NO_SELECCIONADO });
    CourseService.setActiveCourse(curso);
    res.json({ success: true, activeCourse: curso });
  });

  app.get('/api/grupos', (req: Request, res: Response) => {
    const curso = req.query.curso as string;
    try {
      const grupos = CourseService.obtenerGrupos(curso);
      res.json(grupos);
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener grupos' });
    }
  });

  app.get('/api/grupos-miembros', (req: Request, res: Response) => {
    const curso = req.query.curso as string;
    try {
      const gruposMap = CourseService.obtenerGruposConMiembros(curso);
      res.json(gruposMap);
    } catch (error) {
      res.status(500).json({ error: 'Error al procesar grupos e integrantes' });
    }
  });
}