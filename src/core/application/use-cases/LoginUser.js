const jwt = require('jsonwebtoken');

/**
 * Cas d'utilisation: Connexion d'un utilisateur
 */
class LoginUser {
    constructor(userRepository, hashProvider, logger, jwtConfig) {
        this.userRepository = userRepository;
        this.hashProvider = hashProvider;
        this.logger = logger;
        this.jwtConfig = jwtConfig;
    }

    async execute({ email, password }) {
        const user = await this.userRepository.findByEmail(email);
        if (!user) {
            throw new Error('Email ou mot de passe incorrect');
        }

        const match = await this.hashProvider.compare(password, user.passwordHash);
        if (!match) {
            throw new Error('Email ou mot de passe incorrect');
        }

        if (!user.isVerified && this.jwtConfig.requireVerification) {
            throw new Error('Email non vérifié. Veuillez vérifier votre email.');
        }

        const accessToken = jwt.sign(
            { userId: user.userId, email: user.email, role: user.role },
            this.jwtConfig.secret,
            { expiresIn: this.jwtConfig.expiresIn }
        );

        const refreshToken = jwt.sign(
            { userId: user.userId, type: 'refresh' },
            this.jwtConfig.refreshSecret,
            { expiresIn: this.jwtConfig.refreshExpiresIn }
        );

        return {
            token: accessToken,
            refreshToken,
            user: {
                userId: user.userId,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                bde_id: user.bdeId
            }
        };
    }
}

module.exports = LoginUser;
