const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const open = require('open');
const qrcode = require('qrcode');

const { PORT, ALLOWED_ORIGINS, ROOT_DIR, getLocalIPs } = require('./src/config/env');
const { PUBLIC_DIR, FOTOS_DIR } = require('./src/config/paths');
const { state } = require('./src/core/state');
const { loadFormConfig } = require('./src/config/formConfig');
const { registerAllRoutes } = require('./src/routes');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));
app.use(cors({
    origin: (origin, cb) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
        return cb(null, false);
    },
    credentials: true
}));

app.use('/registros/fotos', express.static(FOTOS_DIR));
app.use(express.static(PUBLIC_DIR));
// Fallback mientras el frontend se migra a public/ (luego se puede quitar)
app.use(express.static(ROOT_DIR));
app.get('/', (req, res) => {
    const target = path.join(PUBLIC_DIR, 'index.html');
    res.sendFile(fs.existsSync(target) ? target : path.join(ROOT_DIR, 'index.html'));
});

registerAllRoutes(app);
loadFormConfig();

// Seleccionar automáticamente la IP de la red Wi-Fi/LAN física sin pausar la ejecución del servidor
const ips = getLocalIPs();
let serverIP = ips.length > 0 ? ips[0] : 'localhost';

app.listen(PORT, '0.0.0.0', async () => {
    const url = `http://${serverIP}:${PORT}`;
    const adminUrl = `http://localhost:${PORT}/admin.html`;

    try {
        const qrDataUrl = await qrcode.toDataURL(url, {
            width: 1024,
            margin: 2,
            errorCorrectionLevel: 'H',
            color: { dark: '#000000', light: '#ffffff' }
        });
        state.serverInfo = { url, qr: qrDataUrl };
    } catch (err) {
        console.error('Error generando QR code');
    }

    console.log(`\n🚀 Servidor ejecutándose en:`);
    console.log(`- Alumnos:  ${url}`);
    console.log(`- Panel:    ${adminUrl}`);
    console.log(`\nAbriendo el Panel de Control en el navegador...\n`);

    open(adminUrl).catch(err => console.log('No se pudo abrir el navegador automáticamente.'));
});
