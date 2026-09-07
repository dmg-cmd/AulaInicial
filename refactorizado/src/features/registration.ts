import type { Express, Request, Response } from 'express';
import { RegistrationService } from '../services/RegistrationService.js';
import { MENSAJES } from '../config/constants.js';
import { normalizeClientIP } from '../utils/validation.js';

export function registerRegistrationRoutes(app: Express): void {
  app.post('/api/registro', async (req: Request, res: Response) => {
    try {
      const { alumnoId, email, titulo, telefono, dni, tecnologia, grupo, fotoData, customValues, curso } = req.body;
      const clientIP = normalizeClientIP(req.ip || req.socket.remoteAddress);
      const result = await RegistrationService.registrarAlumno(curso, { alumnoId, email, titulo, telefono, dni, tecnologia, grupo, fotoData, customValues }, clientIP);
      res.json(result);
    } catch (error: any) {
      const status = error.message === MENSAJES.RATE_LIMIT_EXCEEDIDO ? 429 : 400;
      res.status(status).json({ error: error.message });
    }
  });

  app.post('/api/auto-presente', async (req: Request, res: Response) => {
    try {
      const { token, curso, fotoData } = req.body;
      const clientIP = normalizeClientIP(req.ip || req.socket.remoteAddress);
      const result = await RegistrationService.autoPresente(curso, token, clientIP, fotoData);
      res.json(result);
    } catch (error: any) {
      const status = error.message === MENSAJES.TOKEN_INVALIDO ? 401 : (error.message === MENSAJES.RATE_LIMIT_EXCEEDIDO ? 429 : 400);
      res.status(status).json({ error: error.message, invalidToken: error.message === MENSAJES.TOKEN_INVALIDO });
    }
  });

  app.post('/api/mi-perfil', async (req: Request, res: Response) => {
    try {
      const { token, curso } = req.body;
      const clientIP = normalizeClientIP(req.ip || req.socket.remoteAddress);
      const result = await RegistrationService.obtenerPerfil(curso, token, clientIP);
      res.json(result);
    } catch (error: any) {
      const status = error.message === MENSAJES.TOKEN_INVALIDO ? 401 : (error.message === MENSAJES.RATE_LIMIT_EXCEEDIDO ? 429 : 400);
      res.status(status).json({ error: error.message, invalidToken: error.message === MENSAJES.TOKEN_INVALIDO });
    }
  });

  app.post('/api/mi-perfil/guardar', async (req: Request, res: Response) => {
    try {
      const { token, curso, email, dni, titulo, tecnologia, grupo, telefono, customValues, fotoData } = req.body;
      const clientIP = normalizeClientIP(req.ip || req.socket.remoteAddress);
      const result = await RegistrationService.guardarPerfil(curso, token, { email, dni, titulo, tecnologia, grupo, telefono, customValues, fotoData }, clientIP);
      res.json(result);
    } catch (error: any) {
      const status = error.message === MENSAJES.TOKEN_INVALIDO ? 401 : (error.message === MENSAJES.RATE_LIMIT_EXCEEDIDO ? 429 : 400);
      res.status(status).json({ error: error.message, invalidToken: error.message === MENSAJES.TOKEN_INVALIDO });
    }
  });

  app.post('/api/mi-presente/remarcar', async (req: Request, res: Response) => {
    try {
      const { token, curso } = req.body;
      const clientIP = normalizeClientIP(req.ip || req.socket.remoteAddress);
      const result = await RegistrationService.remarcarPresenteTardio(curso, token, clientIP);
      res.json(result);
    } catch (error: any) {
      const status = error.message === MENSAJES.TOKEN_INVALIDO ? 401 : (error.message === MENSAJES.RATE_LIMIT_EXCEEDIDO ? 429 : 403);
      res.status(status).json({ error: error.message });
    }
  });

  app.get('/api/check-registration', (req: Request, res: Response) => {
    const clientIP = normalizeClientIP(req.ip || req.socket.remoteAddress);
    res.json(RegistrationService.checkRegistration(clientIP));
  });
}