/**
 * Cas d'utilisation: Vérification de l'adresse email
 */
class VerifyEmail {
    constructor(userRepository, logger) {
        this.userRepository = userRepository;
        this.logger = logger;
    }

    async execute(token) {
        const user = await this.userRepository.findByVerificationToken(token);
        if (!user) {
            throw new Error('Token de vérification invalide');
        }

        user.verify();
        await this.userRepository.save(user);

        this.logger.info('Email vérifié (Architecture Hexagonale)', { userId: user.userId });

        return { success: true, message: 'Email vérifié avec succès' };
    }
}

module.exports = VerifyEmail;
