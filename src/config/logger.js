const winston = require('winston');

// PII Redaction: mask emails and sensitive patterns in log output
const redactPII = winston.format((info) => {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    if (typeof info.message === 'string') {
        info.message = info.message.replace(emailRegex, '[EMAIL_REDACTED]');
    }
    // Also redact in splat args if present
    if (info[Symbol.for('splat')]) {
        info[Symbol.for('splat')] = JSON.parse(
            JSON.stringify(info[Symbol.for('splat')]).replace(emailRegex, '[EMAIL_REDACTED]')
        );
    }
    return info;
});

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    redactPII(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'epicoin-api' },
    transports: [
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5242880,
            maxFiles: 5,
        }),
    ],
});

// Console logging in development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        ),
    }));
}

module.exports = logger;
