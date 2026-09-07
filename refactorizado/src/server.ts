import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer } from 'node:http';
import open from 'open';
import QRCode from 'qrcode';
import { PATHS, ENV, ensureDirs } from './config/index.js';
import { registerAllRoutes } from './features/index.js';
import { stateManager } from './core/StateManager.js';
import { ConfigService } from './services/ConfigService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || ENV.ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true
}));

app.use('/registros/fotos', express.static(PATHS.FOTOS_DIR));
app.use(express.static(PATHS.PUBLIC_DIR));
app.use(express.static(PATHS.ROOT_DIR));

app.get('/', (_req, res) => {
  const target = join(PATHS.PUBLIC_DIR, 'index.html');
  res.sendFile(target);
});

app.get('/api/server-info', (_req, res) => {
  res.json(stateManager.serverInfo);
});

registerAllRoutes(app);

// Inicializar configuración y directorios
ensureDirs();
ConfigService.loadFormConfig();

// Seleccionar IP de la red Wi-Fi/LAN
const ips = ENV.getLocalIPs();
const serverIP = ips.length > 0 ? ips[0] : 'localhost';

const server = createServer(app);

server.listen(ENV.PORT, '0.0.0.0', async () => {
  const url = `http://${serverIP}:${ENV.PORT}`;
  const adminUrl = `http://localhost:${ENV.PORT}/admin.html`;

  try {
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 1024,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#ffffff' }
    });
    stateManager.serverInfo = { url, qr: qrDataUrl };
  } catch (err) {
    console.error('Error generando QR code');
  }

  console.log(`\n🚀 Servidor ejecutándose en:`);
  console.log(`- Alumnos:  ${url}`);
  console.log(`- Panel:    ${adminUrl}`);
  console.log(`\nAbriendo el Panel de Control en el navegador...\n`);

  open(adminUrl).catch((err: unknown) => console.log('No se pudo abrir el navegador automáticamente.'));
});

export { app, server };