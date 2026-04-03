const { v4: uuidv4 } = require('uuid');

/**
 * Cas d'utilisation: Inscription d'un nouveau BDE (Administrateur + Groupe)
 */
class RegisterBDE {
    constructor(userRepository, groupRepository, walletRepository, hashProvider, logger) {
        this.userRepository = userRepository;
        this.groupRepository = groupRepository;
        this.walletRepository = walletRepository;
        this.hashProvider = hashProvider;
        this.logger = logger;
    }

    async execute({ bdeName, email, password, fullName }) {
        // Validation basique
        if (!bdeName || !email || !password || !fullName) {
            throw new Error('Champs manquants obligatoires');
        }

        // Vérification de l'utilisateur
        const userExists = await this.userRepository.exists(email);
        if (userExists) {
            throw new Error('Cet email est déjà utilisé.');
        }

        // TODO: Optionnel - Vérifier si le nom de BDE existe déjà s'il y a une méthode "exists" dans GroupRepo

        const userId = uuidv4();
        const groupId = uuidv4();
        const hashedPassword = await this.hashProvider.hash(password);
        const verificationToken = uuidv4();

        // 1. Créer le profil administrateur sans 'bde_id' pour le moment
        const userData = {
            userId,
            email,
            passwordHash: hashedPassword,
            fullName,
            role: 'bde_admin',
            verificationToken,
            isVerified: false,
            bdeId: null // Avoid foreign key constraint violation
        };
        const user = await this.userRepository.create(userData);

        // 2. Créer le groupe BDE lié à cet admin
        const groupData = {
            groupId,
            groupName: bdeName,
            adminUserId: userId,
            settings: {},
            status: 'active'
        };
        const group = await this.groupRepository.create(groupData);

        // Mettre à jour l'utilisateur pour lier le BDE
        user.bdeId = group.groupId;
        await this.userRepository.save(user);

        // 3. Créer le Wallet du BDE (EUR) => Unités partagées
        try {
            await this.walletRepository.create({
                walletId: uuidv4(),
                userId: null, // BDE Wallet n'est pas limité à un User précis
                groupId: groupId,
                currency: 'EUR',
                balance: 0,
                status: 'active'
            });
            await this.walletRepository.create({
                walletId: uuidv4(),
                userId: null, 
                groupId: groupId,
                currency: 'CREDITS',
                balance: 0,
                status: 'active'
            });
        } catch (walletError) {
            this.logger.error('Échec de la création des wallets du BDE', { groupId, error: walletError.message });
        }

        this.logger.info('BDE Registered successfully', { userId, groupId });

        return {
            bdeId: group.groupId,
            userId: user.userId,
            email: user.email,
            message: 'Inscription du BDE réussie !'
        };
    }
}

module.exports = RegisterBDE;
