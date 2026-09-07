import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = process.cwd();
const DIST_PUBLIC_DIR = join(ROOT_DIR, 'dist', 'public');
const SRC_FRONTEND_DIR = join(ROOT_DIR, 'src', 'frontend');

// Asegurar que el directorio de destino existe
if (!existsSync(DIST_PUBLIC_DIR)) {
  mkdirSync(DIST_PUBLIC_DIR, { recursive: true });
}

const filesToCopy = [
  { src: join(SRC_FRONTEND_DIR, 'admin', 'index.html'), dest: join(DIST_PUBLIC_DIR, 'admin.html') },
  { src: join(SRC_FRONTEND_DIR, 'student', 'index.html'), dest: join(DIST_PUBLIC_DIR, 'index.html') }
];

for (const { src, dest } of filesToCopy) {
  if (existsSync(src)) {
    copyFileSync(src, dest);
    console.log(`Copied ${src} -> ${dest}`);
  } else {
    console.warn(`Source not found: ${src}`);
  }
}