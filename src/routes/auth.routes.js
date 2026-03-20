const express = require('express');
const { body, query } = require('express-validator');
const authService = require('../services/auth.service');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/database');
const {
    getJwtSecret,
    getJwtRefreshSecret,
    getAccessTtl,
} = require('../config/jwt');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();
const getCookie = (req, name) => {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return null;
    const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
};

router.post(
    '/register',
    [
        body('email').isEmail(),
        body('password').isLength({ min: parseInt(process.env.MIN_PASSWORD_LENGTH || '12', 10) }),
        body('fullName').notEmpty(),
    ],
    async (req, res) => {
        try {
            const { email, password, fullName } = req.body;
            // Security: never allow role escalation via public registration endpoint.
            const result = await authService.register(email, password, fullName, 'student');
            res.status(201).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
);

router.post(
    '/login',
    [
        body('email').isEmail(),
        body('password').exists()
    ],
    async (req, res) => {
        try {
            const { email, password } = req.body;
            const result = await authService.login(email, password);
            // Set refresh token in an HttpOnly cookie (not readable by JS).
            res.cookie('refresh_token', result.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            });

            res.json({ token: result.token, user: result.user });
        } catch (error) {
            res.status(401).json({ error: error.message });
        }
    }
);

router.get(
    '/verify-email',
    [query('token').notEmpty()],
    async (req, res) => {
        try {
            const { token } = req.query;
            const result = await authService.verifyEmail(token);
            res.json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
);

router.get('/me', requireAuth, async (req, res) => {
    try {
        const user = await authService.getUserById(req.user.user_id);
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GDPR: export personal data (self-service)
router.get('/me/export', requireAuth, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const limit = Math.min(parseInt(req.query.limit || '1000', 10), 5000);
        const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

        const user = await authService.getUserById(userId);
        const { data: wallets } = await supabase
            .from('wallets')
            .select('wallet_id, group_id, currency, balance, status, created_at, updated_at')
            .eq('user_id', userId);

        const walletIds = (wallets || []).map(w => w.wallet_id);
        let transactions = [];
        if (walletIds.length > 0) {
            const txQuery = supabase
                .from('transactions')
                .select('*')
                .or(`source_wallet_id.in.(${walletIds.join(',')}),destination_wallet_id.in.(${walletIds.join(',')})`)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            const { data, error } = await txQuery;
            if (!error && data) transactions = data;
        }

        return res.json({
            success: true,
            data: {
                user,
                wallets: wallets || [],
                transactions,
                pagination: { limit, offset },
            }
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

// GDPR: delete account + related data (best-effort)
router.delete('/me', requireAuth, async (req, res) => {
    try {
        const userId = req.user.user_id;

        // Find wallet ids first to delete related transactions.
        const { data: wallets } = await supabase
            .from('wallets')
            .select('wallet_id')
            .eq('user_id', userId);

        const walletIds = (wallets || []).map(w => w.wallet_id);

        if (walletIds.length > 0) {
            // Delete event participations linked to user wallets
            await supabase
                .from('event_participants')
                .delete()
                .in('wallet_id', walletIds);

            await supabase
                .from('transactions')
                .delete()
                .or(`source_wallet_id.in.(${walletIds.join(',')}),destination_wallet_id.in.(${walletIds.join(',')})`);
        }

        await supabase
            .from('payment_requests')
            .delete()
            .eq('student_user_id', userId);

        // Delete Stripe processing records
        await supabase
            .from('stripe_checkout_processed_sessions')
            .delete()
            .eq('user_id', userId);

        // Delete audit logs referencing this user
        await supabase
            .from('audit_logs')
            .delete()
            .eq('performed_by', userId);

        await supabase
            .from('wallets')
            .delete()
            .eq('user_id', userId);

        await supabase
            .from('users')
            .delete()
            .eq('user_id', userId);

        res.clearCookie('refresh_token');
        return res.json({ success: true, message: 'Account deleted' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/refresh', async (req, res) => {
    try {
        const refreshToken = getCookie(req, 'refresh_token');
        if (!refreshToken) return res.status(401).json({ error: 'Refresh token manquant' });

        const decoded = jwt.verify(refreshToken, getJwtRefreshSecret());
        if (!decoded || decoded.type !== 'refresh') {
            return res.status(401).json({ error: 'Refresh token invalide' });
        }

        const userId = decoded.userId;
        const { data: user } = await supabase
            .from('users')
            .select('user_id, email, full_name, role, is_verified, bde_id')
            .eq('user_id', userId)
            .single();

        if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });
        if (process.env.REQUIRE_VERIFICATION === 'true' && !user.is_verified) {
            return res.status(403).json({ error: 'Email non vérifié' });
        }

        const accessToken = jwt.sign(
            {
                userId: user.user_id,
                email: user.email,
                role: user.role,
            },
            getJwtSecret(),
            { expiresIn: getAccessTtl() }
        );

        return res.json({
            token: accessToken,
            user: {
                userId: user.user_id,
                email: user.email,
                fullName: user.full_name,
                role: user.role,
                bde_id: user.bde_id,
            }
        });
    } catch (error) {
        return res.status(401).json({ error: 'Refresh token expiré ou invalide' });
    }
});

router.post('/logout', async (req, res) => {
    try {
        res.clearCookie('refresh_token');
    } catch (e) {
        // Ignore cookie clear errors.
    }
    res.json({ success: true });
});

module.exports = router;
