const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
require('dotenv').config();

const logger = require('../config/logger');
const walletsRoutes = require('../routes/wallets.routes');
const transactionsRoutes = require('../routes/transactions.routes');
const groupsRoutes = require('../routes/groups.routes');
const eventsRoutes = require('../routes/events.routes');
const authRoutes = require('../routes/auth.routes');
const paymentRoutes = require('../routes/payment.routes');
const webhookRoutes = require('../routes/webhooks.routes');

// Architecture Hexagonale (v2)
const bootstrap = require('../infrastructure/di');
const { 
    transactionRoutesHex, 
    walletRoutesHex, 
    authRoutesHex,
    groupRoutesHex,
    eventRoutesHex,
    paymentRoutesHex
} = bootstrap();

const app = express();
const PORT = process.env.API_PORT || 3000;

// Security middleware
// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
            "script-src-attr": ["'self'"],
            "style-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
            "font-src": ["'self'", "https://fonts.gstatic.com"],
            "connect-src": ["'self'", "https://fonts.googleapis.com", "https://checkout.stripe.com"],
            "img-src": ["'self'", "data:", "blob:"]
        },
    },
}));

// CORS configuration
const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean)
    : null;
const isProd = process.env.NODE_ENV === 'production';
if (isProd && (!corsOrigins || corsOrigins.length === 0)) {
    logger.error('CORS_ORIGIN est obligatoire en production. Arrêt du serveur.');
    process.exit(1);
}
app.use(cors({
    origin: corsOrigins || (isProd ? false : true),
    credentials: process.env.CORS_CREDENTIALS === 'true',
}));

// Rate limiting
const defaultLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 500, // Reasonable default
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again later',
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: 'Too many auth requests, please try again later',
});

const webhookLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: 'Too many webhook requests, please try again later',
});

app.use('/api/auth', authLimiter);
app.use('/api/webhooks', webhookLimiter);
app.use('/api/', defaultLimiter);

// Body parsing and compression
// Body parsing and compression
app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
        if (req.originalUrl.startsWith('/api/webhooks/stripe')) {
            req.rawBody = buf.toString();
        }
    }
}));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// Request logging
app.use((req, res, next) => {
    const ipHash = req.ip
        ? crypto.createHash('sha256').update(String(req.ip)).digest('hex')
        : null;
    logger.info('Incoming request', {
        method: req.method,
        path: req.path,
        ip_hash: ipHash,
    });
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// API documentation endpoint
app.get('/api', (req, res) => {
    res.json({
        name: 'Epicoin Exchange API',
        version: '1.0.0',
        description: 'API for inter-group Epicoin exchange system',
        endpoints: {
            wallets: '/api/wallets',
            transactions: '/api/transactions',
            groups: '/api/groups',
        },
        documentation: 'https://github.com/nicolas-sainty/Wallet-IAsansIA',
    });
});

// API Routes
app.use('/api/wallets', walletsRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/webhooks', webhookRoutes);

// Architecture Hexagonale (v2 API)
app.use('/api/v2/transactions', transactionRoutesHex);
app.use('/api/v2/wallets', walletRoutesHex);
app.use('/api/v2/auth', authRoutesHex);
app.use('/api/v2/groups', groupRoutesHex);
app.use('/api/v2/events', eventRoutesHex);
app.use('/api/v2/payment', paymentRoutesHex);

// Static files (frontend)
app.use(express.static('public'));

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
    });
});

// Global error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
    });

    res.status(err.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message,
    });
});

// Start server
const server = app.listen(PORT, () => {
    logger.info(`🚀 Epicoin API server running on port ${PORT}`);
    logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🔗 API Documentation: http://localhost:${PORT}/api`);
    console.log(`\n✓ Server ready at http://localhost:${PORT}`);
    console.log(`✓ API Documentation: http://localhost:${PORT}/api`);
    console.log(`✓ Health Check: http://localhost:${PORT}/health\n`);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(() => {
        logger.info('HTTP server closed');
        // Close database connections if needed
        // supabase client handles its own connection pooling generally, but if we had explicit disconnect logic it would go here.
        process.exit(0);
    });

    // Force close after 10s if hangs
    setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle Nodemon restart signal
process.on('SIGUSR2', () => {
    logger.info('SIGUSR2 received (Nodemon restart), closing server');
    server.close(() => {
        logger.info('HTTP server closed');
        process.kill(process.pid, 'SIGUSR2');
    });
});

module.exports = app;
