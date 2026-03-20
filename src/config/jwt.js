const logger = require('./logger');

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (secret && secret.trim().length > 0) return secret;

    // Never allow a fallback secret — not even in development.
    throw new Error('JWT_SECRET est obligatoire. Définissez-le dans .env');
}

function getJwtRefreshSecret() {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (secret && secret.trim().length > 0) return secret;

    // Fallback: derive from access secret (less secure but backward-compatible).
    logger.warn('JWT_REFRESH_SECRET manquant, dérivé de JWT_SECRET. Configurez une clé dédiée en prod.');
    return `${getJwtSecret()}_refresh`;
}

function getAccessTtl() {
    return process.env.JWT_EXPIRATION || '15m';
}

function getRefreshTtl() {
    return process.env.JWT_REFRESH_EXPIRATION || '30d';
}

module.exports = {
    getJwtSecret,
    getJwtRefreshSecret,
    getAccessTtl,
    getRefreshTtl,
};

