const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_me';

/**
 * Require user to be authenticated via JWT
 */
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Authentication required',
            message: 'Token manquant ou invalide'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = {
            user_id: decoded.userId,
            email: decoded.email,
            role: decoded.role
        };
        next();
    } catch (error) {
        return res.status(401).json({
            error: 'Authentication failed',
            message: 'Session expirée ou invalide. Veuillez vous reconnecter.'
        });
    }
};

/**
 * Require user to have admin role
 * Must be used after requireAuth
 */
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Authentication required',
            message: 'Vous devez être connecté'
        });
    }

    // Check if user has admin role
    if (req.user.role !== 'admin' && req.user.role !== 'bde_admin') {
        return res.status(403).json({
            error: 'Admin access required',
            message: 'Seuls les administrateurs peuvent effectuer cette action'
        });
    }

    next();
};

/**
 * Optional auth - attaches user if token exists, but doesn't require it
 */
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = {
                user_id: decoded.userId,
                email: decoded.email,
                role: decoded.role
            };
        } catch (e) {
            // Ignore invalid token in optional auth
        }
    }
    next();
};

module.exports = {
    requireAuth,
    requireAdmin,
    optionalAuth
};
