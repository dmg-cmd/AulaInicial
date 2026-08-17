const MAX_FOTO_BYTES = 5 * 1024 * 1024; // 5 MB
const rateBuckets = new Map(); // "accion:ip" -> { count, resetAt }
const RATE_LIMIT_MAX = 12;
const RATE_LIMIT_WINDOW_MS = 20000;

function rateLimitExceeded(ip, action) {
    if (!ip) return false;
    const key = `${action}:${ip}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || now > bucket.resetAt) {
        rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return false;
    }
    bucket.count++;
    return bucket.count > RATE_LIMIT_MAX;
}

function validateFotoBase64(base64Data) {
    if (!base64Data || typeof base64Data !== 'string') {
        return { valid: false, error: 'Datos de foto inválidos.' };
    }
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches) {
        return { valid: false, error: 'Formato de imagen no reconocido.' };
    }
    const mime = matches[1].toLowerCase();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
        return { valid: false, error: 'Solo se permiten imágenes JPEG, PNG o WebP.' };
    }
    const buffer = Buffer.from(matches[2], 'base64');
    if (buffer.length === 0) {
        return { valid: false, error: 'La imagen está vacía.' };
    }
    if (buffer.length > MAX_FOTO_BYTES) {
        return { valid: false, error: 'La imagen supera el tamaño máximo de 5 MB.' };
    }
    const magicOk =
        (mime === 'image/jpeg' && buffer.length > 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) ||
        (mime === 'image/png' && buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) ||
        (mime === 'image/webp' && buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP');
    if (!magicOk) {
        return { valid: false, error: 'El archivo no es una imagen real (firma de bytes no válida).' };
    }
    return { valid: true, buffer, error: null };
}

function normalizeClientIP(ip) {
    if (!ip) return '';
    return ip.replace(/^::ffff:/, '').replace(/^::1$/, '127.0.0.1');
}

function isFullyRegistered(row) {
    return !!(row && row['Fecha Registro']);
}

module.exports = {
    MAX_FOTO_BYTES, rateBuckets, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS,
    rateLimitExceeded, validateFotoBase64, normalizeClientIP, isFullyRegistered
};
