const { v4: uuidv4 } = require('uuid');

/**
 * Cas d'utilisation: Inscription d'un nouvel utilisateur
 */
class RegisterUser {
    constructor(userRepository, walletRepository, emailProvider, hashProvider, logger) {
        this.userRepository = userRepository;
        this.walletRepository = walletRepository;
        this.emailProvider = emailProvider;
        this.hashProvider = hashProvider;
        this.logger = logger;
    }

    async execute({ email, password, fullName, role = 'student' }) {
        // Validation basique (déjà faite au niveau middleware mais bonne pratique ici aussi)
        const ALLOWED_PUBLIC_ROLES = ['student'];
        if (!ALLOWED_PUBLIC_ROLES.includes(role)) {
            throw new Error('Rôle non autorisé pour l\'inscription publique');
        }

        // Vérifier si l'utilisateur existe
        const userExists = await this.userRepository.exists(email);
        if (userExists) {
            throw new Error('Cet email est déjà utilisé.');
        }

        const userId = uuidv4();
        const hashedPassword = await this.hashProvider.hash(password);
        const verificationToken = uuidv4();

        // Créer l'entité utilisateur
        const userData = {
            userId,
            email,
            passwordHash: hashedPassword,
            fullName,
            role,
            verificationToken,
            isVerified: false
            // bdeId peut être ajouté ici via une recherche supplémentaire si nécessaire
        };

        const user = await this.userRepository.create(userData);

        // Envoyer l'email de vérification via le port
        try {
            await this.emailProvider.sendVerificationEmail(email, verificationToken);
        } catch (emailError) {
            this.logger.error('Échec de l\'envoi de l\'email de vérification', { email, error: emailError.message });
            // On continue quand même l'inscription, l'utilisateur pourra demander un renvoi
        }

        // Création automatique du wallet par défaut
        try {
            await this.walletRepository.create({
                walletId: uuidv4(),
                userId,
                currency: 'CREDITS',
                balance: 0,
                status: 'active'
            });
        } catch (walletError) {
            this.logger.error('Échec de la création du wallet post-inscription', { userId, error: walletError.message });
        }

        this.logger.info('Utilisateur inscrit (Architecture Hexagonale)', { userId });

        return {
            userId: user.userId,
            email: user.email,
            message: 'Inscription réussie. Veuillez vérifier votre email.'
        };
    }
}

module.exports = RegisterUser;
