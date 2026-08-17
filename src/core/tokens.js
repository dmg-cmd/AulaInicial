const crypto = require('crypto');
const { HMAC_SECRET } = require('../config/env');

function generateStudentToken(studentName, studentId) {
    const nameClean = (studentName || '').trim().toLowerCase();
    const payload = `${nameClean}||${studentId !== undefined && studentId !== null ? studentId : ''}`;
    const hmac = crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');
    const base64Data = Buffer.from(payload).toString('base64url');
    return `${base64Data}.${hmac}`;
}

function verifyStudentToken(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    try {
        const [base64Data, signature] = parts;
        const payload = Buffer.from(base64Data, 'base64url').toString('utf8');
        const expectedHmac = crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');

        if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedHmac))) {
            const [studentName, studentId] = payload.split('||');
            return { studentName, studentId: studentId !== '' ? parseInt(studentId, 10) : null };
        }
    } catch (e) {
        console.error('Error al verificar token criptográfico de alumno:', e);
    }
    return null;
}

module.exports = { generateStudentToken, verifyStudentToken };
