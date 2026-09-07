import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT_DIR = process.cwd();
const EXEC_DIR = dirname(process.execPath);

// Directorio de build de Vite (producción)
const DIST_PUBLIC_DIR = join(ROOT_DIR, 'dist', 'public');

function findCursosDir(): string {
  const candidates = [
    join(ROOT_DIR, 'cursos'),
    join(EXEC_DIR, 'cursos'),
    join(EXEC_DIR, '..', 'cursos')
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  return join(ROOT_DIR, 'cursos');
}

// Directorio público: usa build output si existe (producción), sino source (desarrollo)
const PUBLIC_DIR = existsSync(DIST_PUBLIC_DIR) ? DIST_PUBLIC_DIR : join(ROOT_DIR, 'public');

export const PATHS = {
  ROOT_DIR,
  EXEC_DIR,
  CURSOS_DIR: findCursosDir(),
  REGISTROS_DIR: join(ROOT_DIR, 'registros'),
  FOTOS_DIR: join(ROOT_DIR, 'registros', 'fotos'),
  CONFIG_PATH: join(ROOT_DIR, 'form-config.json'),
  PUBLIC_DIR,
  SECRET_PATH: join(ROOT_DIR, '.secret'),
  ADMIN_PASS_PATH: join(ROOT_DIR, '.adminpass')
} as const;

import { mkdirSync } from 'node:fs';

export function ensureDirs(): void {
  for (const dir of [PATHS.REGISTROS_DIR, PATHS.FOTOS_DIR, join(ROOT_DIR, 'public')]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}