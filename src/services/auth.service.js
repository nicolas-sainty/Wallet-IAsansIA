const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const emailService = require('./email.service');

const dbPath = path.join(__dirname, '../../database/epicoin.sqlite');
const db = new sqlite3.Database(dbPath);

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_me';
const SALT_ROUNDS = 10;

const runQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

const getQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

class AuthService {
    async register(email, password, fullName, role = 'student') {
        // Validation
        const existing = await getQuery('SELECT user_id FROM users WHERE email = ?', [email]);
        if (existing) {
            throw new Error('Cet email est déjà utilisé.');
        }

        const userId = uuidv4();
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const verificationToken = uuidv4();

        try {
            await runQuery(
                `INSERT INTO users (user_id, email, password_hash, full_name, role, verification_token) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [userId, email, hashedPassword, fullName, role, verificationToken]
            );

            // Send Verification Email
            await emailService.sendVerificationEmail(email, verificationToken);

            logger.info(`User registered: ${email} (${userId})`);

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
        const user = await getQuery('SELECT * FROM users WHERE email = ?', [email]);

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
        const user = await getQuery('SELECT * FROM users WHERE verification_token = ?', [token]);

        if (!user) {
            throw new Error('Token de vérification invalide');
        }

        await runQuery(
            'UPDATE users SET is_verified = 1, verification_token = NULL WHERE user_id = ?',
            [user.user_id]
        );

        logger.info(`Email verified for user: ${user.user_id}`);
        return { success: true, message: 'Email vérifié avec succès' };
    }

    async getUserById(userId) {
        const user = await getQuery('SELECT user_id, email, full_name, role, is_verified, created_at FROM users WHERE user_id = ?', [userId]);
        return user;
    }
}

module.exports = new AuthService();
