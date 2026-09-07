import { createHmac, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import { PATHS } from './paths.js';

const PORT = Number(process.env.PORT) || 3000;

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

function loadOrCreateHmacSecret(): string {
  if (process.env.AULA_INICIAL_SECRET?.trim()) {
    return process.env.AULA_INICIAL_SECRET.trim();
  }
  try {
    if (existsSync(PATHS.SECRET_PATH)) {
      const stored = readFileSync(PATHS.SECRET_PATH, 'utf8').trim();
      if (stored) return stored;
    }
    const generated = randomBytes(32).toString('hex');
    writeFileSync(PATHS.SECRET_PATH, generated, { encoding: 'utf8', mode: 0o600 });
    console.log('🔑 Secreto HMAC generado y persistido en .secret');
    return generated;
  } catch (err) {
    console.error('No se pudo persistir el secreto HMAC, se genera uno en memoria:', err);
    return randomBytes(32).toString('hex');
  }
}

const HMAC_SECRET_VALUE = loadOrCreateHmacSecret();

function getLocalIPs(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];

  for (const [devName, iface] of Object.entries(interfaces)) {
    const devLow = devName.toLowerCase();
    if (
      devLow.includes('vmware') ||
      devLow.includes('virtualbox') ||
      devLow.includes('vbox') ||
      devLow.includes('vethernet') ||
      devLow.includes('wsl') ||
      devLow.includes('bluetooth') ||
      devLow.includes('hyper-v')
    ) continue;

    for (const alias of iface || []) {
      if (
        alias.family === 'IPv4' &&
        alias.address !== '127.0.0.1' &&
        !alias.internal &&
        !alias.address.startsWith('169.254.')
      ) {
        ips.push(alias.address);
      }
    }
  }

  if (ips.length === 0) {
    for (const iface of Object.values(interfaces)) {
      for (const alias of iface || []) {
        if (
          alias.family === 'IPv4' &&
          alias.address !== '127.0.0.1' &&
          !alias.internal &&
          !alias.address.startsWith('169.254.')
        ) {
          ips.push(alias.address);
        }
      }
    }
  }

  return ips;
}

export const ENV = {
  PORT,
  ALLOWED_ORIGINS,
  HMAC_SECRET: HMAC_SECRET_VALUE,
  getLocalIPs
} as const;