import type { Express, Request, Response } from 'express';
import { registerAuthRoutes } from '../core/auth.js';

export function registerAuthRoutesFeature(app: Express): void {
  registerAuthRoutes(app);
}