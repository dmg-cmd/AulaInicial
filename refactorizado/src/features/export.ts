import type { Express, Request, Response } from 'express';
import { ExportService } from '../services/ExportService.js';
import { requireAdmin } from '../core/auth.js';

export function registerExportRoutes(app: Express): void {
  app.get('/api/export/excel', requireAdmin, async (req: Request, res: Response) => {
    try {
      const curso = req.query.curso as string;
      const { buffer, filename } = ExportService.exportExcel(curso);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error: any) {
      console.error('Error al exportar Excel:', error);
      res.status(500).json({ error: 'Error al exportar a Excel' });
    }
  });

  app.get('/api/export/word', requireAdmin, async (req: Request, res: Response) => {
    try {
      const curso = req.query.curso as string;
      const { content, filename } = ExportService.exportWord(curso);
      res.setHeader('Content-Type', 'application/msword');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(content);
    } catch (error: any) {
      console.error('Error al exportar Word:', error);
      res.status(500).json({ error: 'Error al exportar a Word' });
    }
  });

  app.get('/api/export/texto', requireAdmin, async (req: Request, res: Response) => {
    try {
      const curso = req.query.curso as string;
      const { content, filename } = ExportService.exportTexto(curso);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(content);
    } catch (error: any) {
      console.error('Error al exportar Texto:', error);
      res.status(500).json({ error: 'Error al exportar a Texto' });
    }
  });
}