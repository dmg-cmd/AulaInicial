import type { Express, Request, Response } from 'express';
import { ConfigService } from '../services/ConfigService.js';
import { MENSAJES } from '../config/constants.js';
import { requireAdmin } from '../core/auth.js';

export function registerConfigRoutes(app: Express): void {
  app.get('/api/form-config', (_req: Request, res: Response) => {
    const config = ConfigService.getFormConfig();
    res.json(config);
  });

  app.post('/api/form-config', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { standardFields, customFields, asistencia, cursoPreferido } = req.body;
      if (!standardFields) return res.status(400).json({ error: 'Configuración inválida' });
      const newConfig = ConfigService.updateFormConfig(standardFields, customFields, asistencia, cursoPreferido);
      res.json({ success: true, formConfig: newConfig });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}