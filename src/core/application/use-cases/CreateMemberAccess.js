const { v4: uuidv4 } = require('uuid');

/**
 * Cas d'utilisation: Création d'un accès Membre / Étudiant par un BDE
 */
class CreateMemberAccess {
    constructor(userRepository, walletRepository, hashProvider, logger) {
        this.userRepository = userRepository;
        this.walletRepository = walletRepository;
        this.hashProvider = hashProvider;
        this.logger = logger;
    }

    async execute({ email, fullName, password, bdeId, adminUserId }) {
        if (!email || !fullName || !password || !bdeId) {
            throw new Error('Informations manquantes pour la création du compte');
        }

        // Optionnel : vérifier que le 'adminUserId' est bien un admin du bdeId cible.

        const userExists = await this.userRepository.exists(email);
        if (userExists) {
            throw new Error('Cet étudiant possède déjà un compte (email existant).');
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
            role: 'student',
            verificationToken,
            isVerified: true, // Vérifié par défaut puisque créé par le BDE
            bdeId: bdeId 
        };

        const user = await this.userRepository.create(userData);

        // Création automatique du wallet CREDITS
        try {
            await this.walletRepository.create({
                walletId: uuidv4(),
                userId,
                groupId: bdeId,
                currency: 'CREDITS',
                balance: 0,
                status: 'active'
            });
        } catch (walletError) {
            this.logger.error('Échec de la création du wallet pour l\'étudiant', { userId, error: walletError.message });
        }

        this.logger.info('Accès étudiant créé par BDE', { studentId: userId, bdeId });

        return {
            userId: user.userId,
            email: user.email,
            bdeId: user.bdeId,
            message: 'Accès étudiant créé avec succès.'
        };
    }
}

module.exports = CreateMemberAccess;
