const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const emailService = require('./email.service');
const groupService = require('./group.service');
const { supabase } = require('../config/database');
const {
    getJwtSecret,
    getJwtRefreshSecret,
    getAccessTtl,
    getRefreshTtl,
} = require('../config/jwt');
const SALT_ROUNDS = 10;

class AuthService {
    issueTokens(user) {
        const jwtSecret = getJwtSecret();
        const accessToken = jwt.sign(
            {
                userId: user.user_id,
                email: user.email,
                role: user.role
            },
            jwtSecret,
            { expiresIn: getAccessTtl() }
        );

        const refreshToken = jwt.sign(
            {
                userId: user.user_id,
                type: 'refresh',
            },
            getJwtRefreshSecret(),
            { expiresIn: getRefreshTtl() }
        );

        return { accessToken, refreshToken };
    }

    async register(email, password, fullName, role = 'student') {
        // Security: only allow public registration with safe roles.
        const ALLOWED_PUBLIC_ROLES = ['student'];
        if (!ALLOWED_PUBLIC_ROLES.includes(role)) {
            throw new Error('Rôle non autorisé pour l\'inscription publique');
        }

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
                logger.info(`Wallet created for user`, { userId });
            }

            logger.info(`User registered`, { userId, bdeId });

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
            throw new Error('Email non vérifié. Veuillez vérifier votre email.');
        }

        const { accessToken, refreshToken } = this.issueTokens(user);

        return {
            token: accessToken,
            refreshToken,
            user: {
                userId: user.user_id,
                email: user.email,
                fullName: user.full_name,
                role: user.role,
                bde_id: user.bde_id
            }
        };
    }

    async registerBDE(bdeName, email, password, fullName) {
        if (!bdeName || !email || !password || !fullName) {
            throw new Error('Champs requis manquants');
        }

        const { data: existingUsers, error: checkError } = await supabase
            .from('users')
            .select('user_id')
            .eq('email', email);

        if (checkError) {
            logger.error('Error checking existing user for BDE registration', checkError);
            throw new Error('Erreur lors de la vérification de l\'email');
        }
        if (existingUsers && existingUsers.length > 0) {
            throw new Error('Cet email est déjà utilisé.');
        }

        const userId = uuidv4();
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // 1) Create admin user
        const { error: insertUserError } = await supabase
            .from('users')
            .insert({
                user_id: userId,
                email,
                password_hash: hashedPassword,
                full_name: fullName,
                role: 'bde_admin',
                is_verified: true,
                verification_token: null
            });

        if (insertUserError) {
            logger.error('Error inserting BDE admin user', insertUserError);
            throw new Error('Erreur lors de la création du compte administrateur');
        }

        try {
            // 2) Create BDE group and group EUR wallet
            const group = await groupService.createGroup(bdeName, userId, {});
            const bdeId = group.group_id;

            // 3) Link admin to the created group
            const { error: updateUserError } = await supabase
                .from('users')
                .update({ bde_id: bdeId })
                .eq('user_id', userId);
            if (updateUserError) throw updateUserError;

            // 4) Create a CREDITS wallet for admin account (optional but useful in UI)
            await supabase
                .from('wallets')
                .insert({
                    wallet_id: uuidv4(),
                    user_id: userId,
                    group_id: bdeId,
                    balance: 0,
                    currency: 'CREDITS',
                    status: 'active'
                });

            const user = {
                user_id: userId,
                email,
                full_name: fullName,
                role: 'bde_admin',
                bde_id: bdeId
            };
            const { accessToken, refreshToken } = this.issueTokens(user);

            return {
                token: accessToken,
                refreshToken,
                user: {
                    userId,
                    email,
                    fullName,
                    role: 'bde_admin',
                    bde_id: bdeId,
                },
            };
        } catch (error) {
            logger.error('BDE registration error', error);
            throw new Error('Erreur lors de la création du BDE');
        }
    }

    async createMemberAccess(email, password, fullName, bdeId) {
        if (!bdeId) throw new Error('BDE non associé à cet administrateur');
        if (!email || !password || !fullName) throw new Error('Champs requis manquants');

        const { data: existingUsers, error: checkError } = await supabase
            .from('users')
            .select('user_id')
            .eq('email', email);
        if (checkError) {
            logger.error('Error checking existing user for member creation', checkError);
            throw new Error('Erreur lors de la vérification de l\'email');
        }
        if (existingUsers && existingUsers.length > 0) {
            throw new Error('Cet email est déjà utilisé.');
        }

        const userId = uuidv4();
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const { error: insertUserError } = await supabase
            .from('users')
            .insert({
                user_id: userId,
                email,
                password_hash: hashedPassword,
                full_name: fullName,
                role: 'student',
                bde_id: bdeId,
                is_verified: true,
                verification_token: null
            });
        if (insertUserError) {
            logger.error('Error inserting member user', insertUserError);
            throw new Error('Erreur lors de la création du compte étudiant');
        }

        const { error: walletError } = await supabase
            .from('wallets')
            .insert({
                wallet_id: uuidv4(),
                user_id: userId,
                group_id: bdeId,
                balance: 0,
                currency: 'CREDITS',
                status: 'active'
            });
        if (walletError) {
            logger.error('Error creating wallet for member', walletError);
            throw new Error('Compte créé, mais impossible de créer le wallet étudiant');
        }

        return {
            user: {
                userId,
                email,
                fullName,
                role: 'student',
                bde_id: bdeId,
            },
            message: 'Accès étudiant créé avec succès',
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

        // Best-effort expiry without schema changes:
        // Use user.created_at as a proxy for token creation time.
        const ttlHours = parseInt(process.env.VERIFICATION_TOKEN_TTL_HOURS || '24', 10);
        if (ttlHours > 0 && user.created_at) {
            const createdAt = new Date(user.created_at).getTime();
            const ageMs = Date.now() - createdAt;
            const ttlMs = ttlHours * 60 * 60 * 1000;

            if (ageMs > ttlMs) {
                // Expired token: clear it to prevent reuse.
                await supabase
                    .from('users')
                    .update({ verification_token: null })
                    .eq('user_id', user.user_id);
                throw new Error('Token de vérification expiré');
            }
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
