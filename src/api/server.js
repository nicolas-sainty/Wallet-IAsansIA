const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const logger = require('../config/logger');
const walletsRoutes = require('../routes/wallets.routes');
const transactionsRoutes = require('../routes/transactions.routes');
const groupsRoutes = require('../routes/groups.routes');
const eventsRoutes = require('../routes/events.routes');
const authRoutes = require('../routes/auth.routes');
const paymentRoutes = require('../routes/payment.routes');
const webhookRoutes = require('../routes/webhooks.routes');

const app = express();
const PORT = process.env.API_PORT || 3000;

// Security middleware
// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            "script-src-attr": ["'unsafe-inline'"],
            "connect-src": ["'self'", "https://fonts.googleapis.com"]
        },
    },
}));

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: process.env.CORS_CREDENTIALS === 'true',
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 1000, // Relaxed limit for development
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again later',
});
app.use('/api/', limiter);

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
    logger.info('Incoming request', {
        method: req.method,
        path: req.path,
        ip: req.ip,
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
