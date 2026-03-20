const jwt = require('jsonwebtoken');

/**
 * Cas d'utilisation: Rafraîchir un token d'accès
 */
class RefreshToken {
    constructor(userRepository, logger, jwtConfig) {
        this.userRepository = userRepository;
        this.logger = logger;
        this.jwtConfig = jwtConfig;
    }

    async execute(refreshToken) {
        try {
            const decoded = jwt.verify(refreshToken, this.jwtConfig.refreshSecret);
            
            if (decoded.type !== 'refresh') {
                throw new Error('Token de rafraîchissement invalide');
            }

            const user = await this.userRepository.findById(decoded.userId);
            if (!user) {
                throw new Error('Utilisateur non trouvé');
            }

            const accessToken = jwt.sign(
                { userId: user.userId, email: user.email, role: user.role, bde_id: user.bdeId },
                this.jwtConfig.secret,
                { expiresIn: this.jwtConfig.expiresIn }
            );

            return { token: accessToken };
        } catch (error) {
            this.logger.error('Refresh token failed', { error: error.message });
            throw new Error('Token de rafraîchissement invalide ou expiré');
        }
    }
}

module.exports = RefreshToken;
