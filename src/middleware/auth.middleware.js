/**
 * Authentication Middleware
 * Provides user authentication and role-based access control
 */

/**
 * Require user to be authenticated
 */
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            error: 'Authentication required',
            message: 'Vous devez être connecté pour effectuer cette action'
        });
    }

    // Attach user to request
    req.user = req.session.user;
    next();
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
 * Optional auth - attaches user if session exists, but doesn't require it
 */
const optionalAuth = (req, res, next) => {
    if (req.session && req.session.user) {
        req.user = req.session.user;
    }
    next();
};

module.exports = {
    requireAuth,
    requireAdmin,
    optionalAuth
};
