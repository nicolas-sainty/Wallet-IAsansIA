const jwt = require('jsonwebtoken');
const { supabase } = require('../config/database');
const {
    getJwtSecret,
} = require('../config/jwt');

/**
 * Require user to be authenticated via JWT
 */
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Authentication required',
            message: 'Token manquant ou invalide'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, getJwtSecret());

        const { data: user, error } = await supabase
            .from('users')
            .select('user_id, email, role, is_verified, bde_id')
            .eq('user_id', decoded.userId)
            .single();

        if (error || !user) {
            return res.status(401).json({
                error: 'Authentication failed',
                message: 'Utilisateur introuvable'
            });
        }

        if (process.env.REQUIRE_VERIFICATION === 'true' && !user.is_verified) {
            return res.status(403).json({
                error: 'Email non vérifié',
                message: 'Veuillez vérifier votre email avant de continuer.'
            });
        }

        req.user = {
            user_id: user.user_id,
            email: user.email,
            role: user.role,
            is_verified: user.is_verified,
            bde_id: user.bde_id,
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
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, getJwtSecret());

            const { data: user } = await supabase
                .from('users')
                .select('user_id, email, role, is_verified, bde_id')
                .eq('user_id', decoded.userId)
                .single();

            if (user) {
                req.user = {
                    user_id: user.user_id,
                    email: user.email,
                    role: user.role,
                    is_verified: user.is_verified,
                    bde_id: user.bde_id,
                };
            }
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
