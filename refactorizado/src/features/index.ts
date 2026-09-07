import type { Express } from 'express';
import { registerCoursesRoutes } from './courses.js';
import { registerStudentsRoutes } from './students.js';
import { registerAttendanceRoutes } from './attendance.js';
import { registerRegistrationRoutes } from './registration.js';
import { registerConfigRoutes } from './config.js';
import { registerExportRoutes } from './export.js';
import { registerAuthRoutesFeature } from './auth.js';

export function registerAllRoutes(app: Express): void {
  registerAuthRoutesFeature(app);
  registerCoursesRoutes(app);
  registerStudentsRoutes(app);
  registerAttendanceRoutes(app);
  registerRegistrationRoutes(app);
  registerConfigRoutes(app);
  registerExportRoutes(app);
}