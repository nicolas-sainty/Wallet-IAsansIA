const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const emailService = require('./email.service');
const { supabase } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_me';
const SALT_ROUNDS = 10;

class AuthService {
    async register(email, password, fullName, role = 'student') {
        // Check if email already exists
        const { data: existingUsers, error: checkError } = await supabase
            .from('users')
            .select('user_id')
            .eq('email', email);

        if (checkError) {
            logger.error('Error checking existing user', checkError);
            throw new Error('Erreur lors de la vérification de l\'email');
        }

        if (existingUsers && existingUsers.length > 0) {
            throw new Error('Cet email est déjà utilisé.');
        }

        const userId = uuidv4();
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const verificationToken = uuidv4();

        try {
            // Get default BDE (first active group) if not specified
            let bdeId = null;
            const { data: groups, error: groupError } = await supabase
                .from('groups')
                .select('group_id')
                .eq('status', 'active')
                .limit(1);

            if (!groupError && groups && groups.length > 0) {
                bdeId = groups[0].group_id;
            }

            // Insert new user
            const { error: insertError } = await supabase
                .from('users')
                .insert({
                    user_id: userId,
                    email,
                    password_hash: hashedPassword,
                    full_name: fullName,
                    role,
                    bde_id: bdeId,
                    verification_token: verificationToken
                });

            if (insertError) {
                logger.error('Error inserting user', insertError);
                throw new Error('Erreur lors de l\'insertion de l\'utilisateur');
            }

            // Send Verification Email
            await emailService.sendVerificationEmail(email, verificationToken);

            // Auto-create Wallet (Default Personal Wallet)
            const { error: walletError } = await supabase
                .from('wallets')
                .insert({
                    user_id: userId,
                    balance: 0,
                    currency: 'CREDITS',
                    status: 'active'
                });

            if (walletError) {
                logger.error('Error creating wallet', walletError);
            } else {
                logger.info(`Wallet created for user: ${userId}`);
            }

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
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email);

        if (error) {
            logger.error('Error fetching user', error);
            throw new Error('Erreur lors de la connexion');
        }

        const user = users && users.length > 0 ? users[0] : null;

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
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .eq('verification_token', token);

        if (error) {
            logger.error('Error fetching user by token', error);
            throw new Error('Erreur lors de la vérification');
        }

        const user = users && users.length > 0 ? users[0] : null;

        if (!user) {
            throw new Error('Token de vérification invalide');
        }

        const { error: updateError } = await supabase
            .from('users')
            .update({
                is_verified: true,
                verification_token: null
            })
            .eq('user_id', user.user_id);

        if (updateError) {
            logger.error('Error updating user verification', updateError);
            throw new Error('Erreur lors de la mise à jour');
        }

        logger.info(`Email verified for user: ${user.user_id}`);
        return { success: true, message: 'Email vérifié avec succès' };
    }

    async getUserById(userId) {
        const { data: users, error } = await supabase
            .from('users')
            .select('user_id, email, full_name, role, is_verified, bde_id, created_at')
            .eq('user_id', userId);

        if (error) {
            logger.error('Error fetching user by ID', error);
            return null;
        }

        return users && users.length > 0 ? users[0] : null;
    }
}

module.exports = new AuthService();
