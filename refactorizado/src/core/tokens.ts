import { createHmac, timingSafeEqual } from 'node:crypto';
import { ENV } from '../config/env.js';

export interface StudentTokenPayload {
  studentName: string;
  studentId: number | null;
}

export function generateStudentToken(studentName: string, studentId: number | null): string {
  const nameClean = (studentName || '').trim().toLowerCase();
  const payload = `${nameClean}||${studentId !== null && studentId !== undefined ? studentId : ''}`;
  const hmac = createHmac('sha256', ENV.HMAC_SECRET).update(payload).digest('hex');
  const base64Data = Buffer.from(payload).toString('base64url');
  return `${base64Data}.${hmac}`;
}

export function verifyStudentToken(token: string): StudentTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  try {
    const [base64Data, signature] = parts;
    const payload = Buffer.from(base64Data, 'base64url').toString('utf8');
    const expectedHmac = createHmac('sha256', ENV.HMAC_SECRET).update(payload).digest('hex');

    if (timingSafeEqual(Buffer.from(signature), Buffer.from(expectedHmac))) {
      const [studentName, studentId] = payload.split('||');
      return {
        studentName,
        studentId: studentId !== '' ? parseInt(studentId, 10) : null
      };
    }
  } catch (e) {
    console.error('Error al verificar token criptográfico de alumno:', e);
  }
  return null;
}