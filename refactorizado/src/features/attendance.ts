import type { Express, Request, Response } from 'express';
import { AttendanceService } from '../services/AttendanceService.js';
import { MENSAJES } from '../config/constants.js';
import { requireAdmin } from '../core/auth.js';

export function registerAttendanceRoutes(app: Express): void {
  app.get('/api/fechas-disponibles', async (req: Request, res: Response) => {
    try {
      const curso = req.query.curso as string;
      const fechas = await AttendanceService.obtenerFechasDisponibles(curso);
      res.json(fechas);
    } catch (error) {
      console.error('Error al obtener fechas disponibles:', error);
      res.json([{ id: 'TODAS', label: '🌐 Acumulado General (Todas las Fechas)' }]);
    }
  });

  app.get('/api/stats', requireAdmin, async (req: Request, res: Response) => {
    try {
      const curso = req.query.curso as string;
      const campo = (req.query.campo || 'titulo') as string;
      const grupo = (req.query.grupo || 'TODOS') as string;
      const fecha = (req.query.fecha || 'TODOS') as string;
      const stats = AttendanceService.obtenerEstadisticas(curso, campo, grupo, fecha);
      res.json(stats);
    } catch (error) {
      console.error('Error en /api/stats:', error);
      res.status(500).json({ error: 'Error al generar estadísticas' });
    }
  });

  app.get('/api/ausencias', requireAdmin, async (req: Request, res: Response) => {
    try {
      const curso = req.query.curso as string;
      const mes = (req.query.mes || '') as string;
      const grupo = (req.query.grupo || 'TODOS') as string;
      const ausencias = AttendanceService.obtenerAusencias(curso, mes, grupo);
      res.json(ausencias);
    } catch (error) {
      console.error('Error en /api/ausencias:', error);
      res.status(500).json({ error: 'Error al generar ausencias por mes' });
    }
  });

  app.post('/api/asistencia/tomar', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { curso, fecha, asistencias } = req.body;
      if (!Array.isArray(asistencias)) return res.status(400).json({ error: 'Listado de asistencias inválido.' });
      const result = await AttendanceService.tomarAsistencia(curso, fecha, asistencias);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/asistencia/cfg', requireAdmin, async (req: Request, res: Response) => {
    try {
      const curso = req.query.curso as string;
      const config = AttendanceService.getTardanzaConfig(curso);
      res.json({ success: true, ...config });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/asistencia/cfg', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { curso, modo, horaInicio, margenGracia, minDespues } = req.body;
      const result = await AttendanceService.saveTardanzaConfig(curso, { modo, horaInicio, margenGracia, minDespues });
      res.json({ success: true, cfg: result.cfg });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/asistencia/tomar-lista', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { curso, fecha } = req.body;
      const result = AttendanceService.tomarLista(curso, fecha);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/asistencia/borrar-dia', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { curso, fecha } = req.body;
      if (!fecha) return res.status(400).json({ error: 'Debe indicar la fecha a borrar.' });
      const result = await AttendanceService.borrarDiaAsistencia(curso, fecha);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/asistencia/consultar', async (req: Request, res: Response) => {
    try {
      const curso = req.query.curso as string;
      const fecha = req.query.fecha as string;
      const data = AttendanceService.consultarAsistencia(curso, fecha);
      res.json(data);
    } catch (error) {
      console.error('Error al consultar asistencia por fecha:', error);
      res.status(500).json({ error: 'Error al leer la asistencia por fecha.' });
    }
  });
}