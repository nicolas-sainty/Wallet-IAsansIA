const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const emailService = require('./email.service');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_me';
const SALT_ROUNDS = 10;

class AuthService {
    async register(email, password, fullName, role = 'student') {
        const queryText = 'SELECT user_id FROM users WHERE email = $1';
        const { rows } = await db.query(queryText, [email]);

        if (rows.length > 0) {
            throw new Error('Cet email est déjà utilisé.');
        }

        const userId = uuidv4();
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const verificationToken = uuidv4();

        try {
            // Get default BDE (first active group) if niet specified
            let bdeId = null;
            const bdeResult = await db.query(
                'SELECT group_id FROM groups WHERE status = $1 LIMIT 1',
                ['active']
            );
            if (bdeResult.rows.length > 0) {
                bdeId = bdeResult.rows[0].group_id;
            }

            await db.query(
                `INSERT INTO users (user_id, email, password_hash, full_name, role, bde_id, verification_token) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [userId, email, hashedPassword, fullName, role, bdeId, verificationToken]
            );

            // Send Verification Email
            await emailService.sendVerificationEmail(email, verificationToken);

            // Auto-create Wallet (Default Personal Wallet)
            await db.query(
                `INSERT INTO wallets (user_id, balance, currency, status) VALUES ($1, 0, 'CREDITS', 'active')`,
                [userId]
            );
            logger.info(`Wallet created for user: ${userId}`);

            logger.info(`User registered: ${email} (${userId}) with BDE: ${bdeId}`);

            return {
                userId,
                email,
                message: 'Inscription réussie. Veuillez vérifier votre email.'
            };
        } catch (error) {
            logger.error('Registration error', error);
            throw new Error('Erreur lors de l\'inscription');
        }
    }

    async login(email, password) {
        const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = rows[0];

        if (!user) {
            throw new Error('Email ou mot de passe incorrect');
        }

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            throw new Error('Email ou mot de passe incorrect');
        }

        if (!user.is_verified && process.env.REQUIRE_VERIFICATION === 'true') {
            // Optional: Force verification
        }

        const token = jwt.sign(
            {
                userId: user.user_id,
                email: user.email,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        logger.info(`User logged in: ${email}`);

        return {
            token,
            user: {
                userId: user.user_id,
                email: user.email,
                fullName: user.full_name,
                role: user.role
            }
        };
    }

    async verifyEmail(token) {
        const { rows } = await db.query('SELECT * FROM users WHERE verification_token = $1', [token]);
        const user = rows[0];

        if (!user) {
            throw new Error('Token de vérification invalide');
        }

        await db.query(
            'UPDATE users SET is_verified = 1, verification_token = NULL WHERE user_id = $1',
            [user.user_id]
        );

        logger.info(`Email verified for user: ${user.user_id}`);
        return { success: true, message: 'Email vérifié avec succès' };
    }

    async getUserById(userId) {
        const { rows } = await db.query('SELECT user_id, email, full_name, role, is_verified, created_at FROM users WHERE user_id = $1', [userId]);
        return rows[0];
    }
}

module.exports = new AuthService();
